import hmac
import os
import sys
from pathlib import Path

import modal
from fastapi import Header, HTTPException
from pydantic import BaseModel, Field


PROJECT_SOURCE = Path(__file__).parents[1] / "src" / "hongshaoniuroumian"
MODEL_DIRECTORY = "/models"
MODEL_VOLUME = modal.Volume.from_name(
    "hongshaoniuroumian-models",
    create_if_missing=True,
)
MODEL_SECRET = modal.Secret.from_name("hongshaoniuroumian-modal")
IMAGE = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi", "torch", "transformers", "drain3")
    .add_local_dir(PROJECT_SOURCE, remote_path="/app")
)
app = modal.App("hongshaoniuroumian-inference")


class ScoreRequest(BaseModel):
    source_id: str = Field(min_length=1, max_length=128)
    history_lines: list[str] = Field(max_length=100)
    line: str = Field(min_length=1, max_length=16_384)


@app.cls(
    image=IMAGE,
    gpu="T4",
    timeout=300,
    volumes={MODEL_DIRECTORY: MODEL_VOLUME},
    secrets=[MODEL_SECRET],
)
class LogScorer:
    @modal.enter()
    def load_model(self) -> None:
        sys.path.insert(0, "/app")

        from generation import LogGenerator
        from ingest import postprocess_bruh, preprocess_bruh

        self.generator = LogGenerator(
            checkpoint=f"{MODEL_DIRECTORY}/bruh-final_model.pt",
            miner_state=f"{MODEL_DIRECTORY}/bruh-templateminerstate",
            preprocesser=preprocess_bruh,
            postprocesser=postprocess_bruh,
        )

    @modal.fastapi_endpoint(method="POST", docs=True)
    def score(
        self,
        request: ScoreRequest,
        x_api_key: str | None = Header(default=None),
    ) -> dict:
        expected_key = os.environ["INGEST_API_KEY"]
        if x_api_key is None or not hmac.compare_digest(x_api_key, expected_key):
            raise HTTPException(status_code=401, detail="invalid API key")

        if len(request.history_lines) < self.generator.window_size:
            _, _, event = self.generator.vectorize_log(request.line)
            if not event:
                raise HTTPException(status_code=422, detail="could not parse log line")
            return {
                "template_id": event["template_id"],
                "template": self.generator.get_templates()[event["template_id"]],
                "template_similarity": 1.0,
                "parameter_similarity": 1.0,
                "scored": False,
            }

        result = self.generator.score_inputs(request.history_lines, request.line)
        if "error" in result:
            raise HTTPException(status_code=422, detail=result["error"])

        result["template"] = self.generator.get_templates()[result["template_id"]]
        result["scored"] = True
        return result
