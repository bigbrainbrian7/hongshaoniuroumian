from collections import deque

import torch
import torch.nn.functional as F
from drain3 import TemplateMiner
from drain3.file_persistence import FilePersistence

from drain import Drain
from ingest import postprocess_ssh, preprocess_ssh
from model import SequenceEncoder
from parameter import Parameter2Vec
from template import Itemplate2Vec


class LogGenerator:
    def __init__(
        self,
        checkpoint: str,
        miner_state: str,
        window_size: int = 100,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2,
    ) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.window_size = window_size
        miner = TemplateMiner(FilePersistence(miner_state))
        self.drain = Drain(miner, miner_state, preprocess_ssh, postprocess_ssh)
        self.drain.build_dataset(())

        template_encoder = Itemplate2Vec(device=self.device)
        self.template_vectors = {
            template_id: vector.cpu()
            for template_id, vector in template_encoder.encode_templates(
                self.drain.get_templates()
            ).items()
        }
        template_dim = next(iter(self.template_vectors.values())).shape[0]
        self.model = SequenceEncoder(
            template_dim,
            Parameter2Vec.EMBEDDING_DIM,
            template_hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout,
        ).to(self.device)
        self.model.load_state_dict(
            torch.load(checkpoint, weights_only=True, map_location=self.device)
        )
        self.model.eval()

        self.templates = deque(maxlen=window_size)
        self.parameters = deque(maxlen=window_size)
        self.parameter_encoder = Parameter2Vec()

    # if it works it works
    def vectorize_log(self, raw_line: str)-> tuple[torch.Tensor | None, torch.Tensor | None, dict]:
        processed = preprocess_ssh(raw_line)
        if not processed:
            print("invalid syslog line")
            return None, None, {}

        event = self.drain.match_line(processed["message"])
        if event is None or event["template_id"] not in self.template_vectors:
            print("unrecognized template")
            return None, None, {}

        template = self.template_vectors[event["template_id"]]
        parameter = self.parameter_encoder.encode_parameter(
            processed["parameters"] + event["parameters"]
        )

        return template, parameter, event

    def score_inputs(self, input_lines: list[str], real_line: str) -> dict[str, float]:
        if len(input_lines) != self.window_size:
            raise ValueError(f"Expected {self.window_size} input lines")

        vectors = [self.vectorize_log(line) for line in input_lines]
        if any(template is None or parameter is None for template, parameter, _ in vectors):
            return {"error": "invalid input line"}

        input_templates, input_parameters, _ = zip(*vectors)
        input_templates = torch.stack(input_templates)
        input_parameters = torch.stack(input_parameters)

        input_templates = input_templates.unsqueeze(0).to(self.device)
        input_parameters = input_parameters.unsqueeze(0).to(self.device)

        target_template, target_parameter, event = self.vectorize_log(real_line)
        if target_template is None or target_parameter is None:
            return {"error": "invalid real output line"}

        target_template = target_template.unsqueeze(0).to(self.device)
        target_parameter = target_parameter.unsqueeze(0).to(self.device)

        with torch.no_grad():
            predicted_template, predicted_parameter = self.model(
                input_templates,
                input_parameters,
            )

        return {
            "template_id": event["template_id"],
            "template_similarity": F.cosine_similarity(
                predicted_template,
                target_template,
            ).item(),
            "parameter_similarity": F.cosine_similarity(
                predicted_parameter,
                target_parameter,
            ).item(),
        }

    def score(self, raw_line: str) -> dict | None:

        target_template, target_parameter, event = self.vectorize_log(raw_line)
        # so pylance dont get mad
        if target_template is None or target_parameter is None:
            return {"error": "ts dont work"}

        result = None
        if len(self.templates) == self.window_size:
            input_templates = torch.stack(tuple(self.templates)).unsqueeze(0).to(self.device)
            input_parameters = torch.stack(tuple(self.parameters)).unsqueeze(0).to(self.device)
            with torch.no_grad():
                predicted_template, predicted_parameter = self.model(
                    input_templates,
                    input_parameters,
                )

            result = {
                "template_id": event["template_id"],
                "template_similarity": F.cosine_similarity(
                    predicted_template,
                    target_template.unsqueeze(0).to(self.device),
                ).item(),
                "parameter_similarity": F.cosine_similarity(
                    predicted_parameter,
                    target_parameter.unsqueeze(0).to(self.device),
                ).item(),
            }

        self.templates.append(target_template)
        self.parameters.append(target_parameter)
        return result

    def get_templates(self):
        return self.drain.get_templates()