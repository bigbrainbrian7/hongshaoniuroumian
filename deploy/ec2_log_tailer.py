import os
import subprocess
import time

import requests


JOURNAL_UNIT = os.environ.get("SSH_JOURNAL_UNIT", "ssh.service")
INGEST_URL = os.environ.get("EC2_INGEST_URL", "http://127.0.0.1:8000/api/ingest")


def follow_journal(unit: str):
    command = [
        "journalctl",
        "--follow",
        "--lines=0",
        "--no-pager",
        "--output=short",
        "--unit",
        unit,
    ]
    while True:
        with subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        ) as journal:
            assert journal.stdout is not None
            for line in journal.stdout:
                yield line.rstrip("\r\n")
        time.sleep(1)


def main() -> None:
    for line in follow_journal(JOURNAL_UNIT):
        if not line:
            continue
        try:
            response = requests.post(INGEST_URL, json={"line": line}, timeout=30)
            response.raise_for_status()
        except requests.RequestException as error:
            print(f"failed to ingest log line: {error}")


if __name__ == "__main__":
    main()
