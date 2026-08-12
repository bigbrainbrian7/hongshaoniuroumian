import torch
import torch.nn as nn


class TemplateEmbedding(nn.Module):
    def __init__(
        self,
        num_templates: int,
        embedding_dim: int = 64,
    ):
        super().__init__()

        self.embedding = nn.Embedding(
            num_embeddings=num_templates,
            embedding_dim=embedding_dim,
        )

    def forward(self, template_ids: torch.Tensor) -> torch.Tensor:
        return self.embedding(template_ids)