import hmac
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


PROJECT_SOURCE = Path(
    os.environ.get(
        "PROJECT_SOURCE",
        Path(__file__).parents[1] / "src" / "hongshaoniuroumian",
    )
).resolve()
if not PROJECT_SOURCE.is_dir():
    raise RuntimeError(f"project source directory not found: {PROJECT_SOURCE}")
sys.path.insert(0, str(PROJECT_SOURCE))

from generation import LogGenerator
from ingest import postprocess_bruh, preprocess_bruh


class ScoreRequest(BaseModel):
    source_id: str = Field(min_length=1, max_length=128)
    history_lines: list[str] = Field(max_length=100)
    line: str = Field(min_length=1, max_length=16_384)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.generator = LogGenerator(
        checkpoint=os.environ.get("MODEL_CHECKPOINT", "data/bruh-final_model.pt"),
        miner_state=os.environ.get(
            "MINER_STATE", "data/bruh-templateminerstate"
        ),
        preprocesser=preprocess_bruh,
        postprocesser=postprocess_bruh,
    )
    yield


app = FastAPI(title="Local HongShaoNiuRouMian scorer", lifespan=lifespan)


@app.post("/score")
def score(
    request: ScoreRequest,
    x_api_key: str | None = Header(default=None),
) -> dict:
    expected_key = os.environ["INGEST_API_KEY"]
    if x_api_key is None or not hmac.compare_digest(x_api_key, expected_key):
        raise HTTPException(status_code=401, detail="invalid API key")

    generator = app.state.generator
    if len(request.history_lines) < generator.window_size:
        _, _, event = generator.vectorize_log(request.line)
        if not event:
            raise HTTPException(status_code=422, detail="could not parse log line")
        return {
            "template_id": event["template_id"],
            "template": generator.get_templates()[event["template_id"]],
            "template_similarity": 1.0,
            "parameter_similarity": 1.0,
            "scored": False,
        }

    result = generator.score_inputs(request.history_lines, request.line)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    result["template"] = generator.get_templates()[result["template_id"]]
    result["scored"] = True
    return result
