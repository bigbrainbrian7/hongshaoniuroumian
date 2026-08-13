import argparse
from collections import deque
import json
import sys

import torch
import torch.nn.functional as F
from drain3 import TemplateMiner
from drain3.file_persistence import FilePersistence

from drain import Drain
from ingest import postprocess_ssh, preprocess_ssh
from model import SequenceEncoder
from parameter import Parameter2Vec
from template import Itemplate2Vec


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Score SSH/syslog events from standard input."
    )
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--miner-state", required=True)
    parser.add_argument("--window-size", type=int, default=100)
    parser.add_argument("--hidden-size", type=int, default=128)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--dropout", type=float, default=0.2)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    miner = TemplateMiner(FilePersistence(args.miner_state))
    drain = Drain(miner, args.miner_state, preprocess_ssh, postprocess_ssh)
    drain.build_dataset(())

    template_encoder = Itemplate2Vec(device=device)
    template_vectors = {
        template_id: vector.cpu()
        for template_id, vector in template_encoder.encode_templates(
            drain.get_templates()
        ).items()
    }
    template_dim = next(iter(template_vectors.values())).shape[0]
    model = SequenceEncoder(
        template_dim,
        Parameter2Vec.EMBEDDING_DIM,
        template_hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        dropout=args.dropout,
    ).to(device)
    model.load_state_dict(torch.load(args.checkpoint, weights_only=True, map_location=device))
    model.eval()

    templates = deque(maxlen=args.window_size)
    parameters = deque(maxlen=args.window_size)
    parameter_encoder = Parameter2Vec()

    for raw_line in sys.stdin:
        raw_line = raw_line.rstrip("\r\n")
        if not raw_line:
            continue

        processed = preprocess_ssh(raw_line)
        if not processed:
            continue
        event = drain.match_line(processed["message"])
        if event is None or event["template_id"] not in template_vectors:
            print(json.dumps({"line": raw_line, "error": "unrecognized template"}))
            continue

        event_parameters = processed["parameters"] + event["parameters"]
        target_template = template_vectors[event["template_id"]]
        target_parameter = parameter_encoder.encode_parameter(event_parameters)

        if len(templates) == args.window_size:
            input_templates = torch.stack(tuple(templates)).unsqueeze(0).to(device)
            input_parameters = torch.stack(tuple(parameters)).unsqueeze(0).to(device)
            with torch.no_grad():
                predicted_template, predicted_parameter = model(
                    input_templates,
                    input_parameters,
                )

            template_score = F.cosine_similarity(
                predicted_template,
                target_template.unsqueeze(0).to(device),
            ).item()
            parameter_score = F.cosine_similarity(
                predicted_parameter,
                target_parameter.unsqueeze(0).to(device),
            ).item()
            print(json.dumps({
                "template_id": event["template_id"],
                "template_similarity": template_score,
                "parameter_similarity": parameter_score,
            }))

        templates.append(target_template)
        parameters.append(target_parameter)


if __name__ == "__main__":
    main()
