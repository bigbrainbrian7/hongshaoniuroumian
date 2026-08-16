from collections.abc import Iterable
from pathlib import Path
from typing import Callable

from drain3 import TemplateMiner

from template import Itemplate2Vec

import torch
import torch.nn.functional as F

class Drain:
    def __init__(
        self,
        miner: TemplateMiner,
        persistence_path: str,
        preprocesser: Callable[[str], dict] = lambda s: {
            "message": s,
            "parameters": [],
        },
        postprocesser: Callable[[str], str] = lambda s: s,
        template_vectorizer: Itemplate2Vec | None = None
    ) -> None:
        self.miner = miner
        self.persistence_path = Path(persistence_path)
        self.preprocesser = preprocesser
        self.postprocessor = postprocesser
        self.templates: dict[int, str]
        self.template_embedder = template_vectorizer
        self.template_vectors = None


    def build_miner(self, lines: Iterable[str]) -> None:
        for line in lines:
            self.miner.add_log_message(line)

    def get_templates(self) -> dict[int, str]:
        return self.templates

    # def get_unique_template_words(self) -> list[str]:
    #     return list(
    #         {
    #             word
    #             for cluster in self.templates.values()
    #             for word in cluster.split()
    #         }
    #     )

    def match_line(self, line: str) -> dict | None:
        result = self.miner.match(line)
        if result is None:
            if self.template_embedder:
                if self.template_vectors is None:
                    self.template_vectors = {
                        template_id: vector.cpu()
                        for template_id, vector in self.template_embedder.encode_templates(
                            self.templates
                        ).items()
                    }

                template_ids = list(self.template_vectors)
                template_matrix = torch.stack(
                    [self.template_vectors[template_id] for template_id in template_ids]
                )
                vector = self.template_embedder._encode(
                    [self.postprocessor(line)]
                )[0].cpu()
                similarities = F.cosine_similarity(
                    template_matrix,
                    vector.unsqueeze(0),
                    dim=1,
                )
                best_index = int(similarities.argmax().item())
                template_id = template_ids[best_index]
                return {
                    "template_id": template_id,
                    "template": self.templates[template_id],
                    "parameters": [],
                    "matched_by_similarity": True,
                    "matched_template_similarity": similarities[best_index].item(),
                }
            else:
                return None

        template = result.get_template()
        parameters = [
            param.value
            for param in self.miner.extract_parameters(template, line) or []
        ]
        return {
            "template_id": result.cluster_id,
            "template": template,
            "parameters": parameters,
        }

    def build_dataset(self, logs: Iterable[str]) -> list[dict]:
        processed_logs = [self.preprocesser(line) for line in logs]

        if not self.persistence_path.is_file():
            self.build_miner(log["message"] for log in processed_logs)
        self.templates = {
            int(cluster.cluster_id): self.postprocessor(cluster.get_template())
            for cluster in self.miner.drain.clusters
        }

        dataset = []
        for log in processed_logs:
            match = self.match_line(log["message"])
            if match is None:
                print("didn't match to any template")
                continue
            match["template"] = self.templates[match["template_id"]]
            match["parameters"] = log["parameters"] + match["parameters"]
            dataset.append(match)

        return dataset

    def get_template_vectors(self):
        return self.template_vectors
