import argparse
import json
import sys
from pathlib import Path
import matplotlib.pyplot as plt
from generation import LogGenerator

import numpy as np


def parse_args() -> argparse.Namespace:
    miner_persistence_path = "../../data/templateminerstate"
    checkpoint_path = "../../data/best_model.pt"

    parser = argparse.ArgumentParser(
        description="Score SSH/syslog events from standard input."
    )
    parser.add_argument("--checkpoint", type=str, default=checkpoint_path)
    parser.add_argument("--miner-state", type=str, default=miner_persistence_path)
    parser.add_argument("--window-size", type=int, default=100)
    parser.add_argument("--hidden-size", type=int, default=128)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--dropout", type=float, default=0.2)
    parser.add_argument("--output", type=Path, default=Path("../../data/stream-results.jsonl"))
    return parser.parse_args()


def main() -> None:
    bruh = []
    args = parse_args()
    generator = LogGenerator(
        args.checkpoint,
        args.miner_state,
        args.window_size,
        args.hidden_size,
        args.num_layers,
        args.dropout,
    )

    with args.output.open("w") as output_file:
        for counter, raw_line in enumerate(sys.stdin, start=1):
            raw_line = raw_line.rstrip("\r\n")
            if not raw_line:
                continue

            result = generator.score(raw_line)
            if result is None:
                continue

            record = {"line_number": counter, "line": raw_line, **result}
            output_file.write(json.dumps(record) + "\n")

            if result.get("scored"):
                bruh.append(result["template_similarity"])
                if result["template_similarity"] < 0.95:
                    print(counter, json.dumps(record))

    plt.hist(bruh, bins=np.arange(0.90, 0.98, 0.001))
    plt.show()


if __name__ == "__main__":
    main()
