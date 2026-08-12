from collections.abc import Iterator


def get_logs(path: str) -> list[str]:
    logs = []
    with open(path, "r") as logfile:
        for line in logfile:
            clean = line.rstrip("\r\n")
            if clean: logs.append(clean)

    return logs
