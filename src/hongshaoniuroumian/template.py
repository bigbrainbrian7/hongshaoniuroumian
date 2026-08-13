import torch
from transformers import AutoModel, AutoTokenizer


class Itemplate2Vec:
    def __init__(
        self,
        model_name: str = "bert-base-uncased",
        device: torch.device | None = None,
        max_length: int = 128,
    ):
        self.device = device or torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )
        self.max_length = max_length
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(self.device)
        self.model.eval()

        for parameter in self.model.parameters():
            parameter.requires_grad = False

    def _encode(self, templates: list[str]) -> torch.Tensor:
        normalized_templates = [
            template.replace("<*>", "")
            for template in templates
        ]
        tokens = self.tokenizer(
            normalized_templates,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
            return_special_tokens_mask=True,
        ).to(self.device)

        with torch.no_grad():
            token_vectors = self.model(
                input_ids=tokens["input_ids"],
                attention_mask=tokens["attention_mask"],
            ).last_hidden_state

        template_vectors = []
        for vector, attention_mask, special_tokens_mask in zip(
            token_vectors,
            tokens["attention_mask"],
            tokens["special_tokens_mask"],
        ):
            word_vectors = vector[(attention_mask == 1) & (special_tokens_mask == 0)]
            if len(word_vectors) == 1:
                template_vectors.append(word_vectors[0])
                continue

            normalized_words = torch.nn.functional.normalize(word_vectors, dim=1)
            similarities = normalized_words @ normalized_words.T
            similarities.fill_diagonal_(0)
            weights = similarities.sum(dim=1) / (len(word_vectors) - 1)
            template_vectors.append((weights.unsqueeze(1) * word_vectors).mean(dim=0))

        return torch.stack(template_vectors)

    # just to be safe for index mismatches in templates (one-based)
    def encode_templates(self, templates: dict[int, str]) -> dict[int, torch.Tensor]:
        template_ids = list(templates)
        vectors = self._encode([templates[template_id] for template_id in template_ids])
        return dict(zip(template_ids, vectors))
