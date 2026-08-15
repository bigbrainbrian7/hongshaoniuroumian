import argparse
import json
import sys

from generation import LogGenerator


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
    generator = LogGenerator(
        args.checkpoint,
        args.miner_state,
        args.window_size,
        args.hidden_size,
        args.num_layers,
        args.dropout,
    )

    for raw_line in sys.stdin:
        raw_line = raw_line.rstrip("\r\n")
        if not raw_line:
            continue

        result = generator.score(raw_line)
        if result is not None:
            print(json.dumps(result))


if __name__ == "__main__":
    main()
