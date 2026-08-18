import argparse
import time
from pathlib import Path

import requests


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument(
        "--ingest-url",
        default="http://127.0.0.1:8000/api/ingest",
    )
    parser.add_argument("--delay", type=float, default=0.1)
    args = parser.parse_args()

    with args.path.open() as log_file:
        for raw_line in log_file:
            line = raw_line.rstrip("\r\n")
            if not line:
                continue
            response = requests.post(args.ingest_url, json={"line": line}, timeout=1800)
            response.raise_for_status()
            if args.delay:
                time.sleep(args.delay)


if __name__ == "__main__":
    main()
