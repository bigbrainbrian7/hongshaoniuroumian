from collections.abc import Iterator
import re

SYSLOG_REGEX = re.compile(
    r"^(?P<timestamp>"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}"
    r")\s+"
    r"(?P<host>\S+)\s+"
    r"(?P<process>\w+)"
    r"\[(?P<pid>\d+)\]:\s+"
    r"(?P<message>.*)$"
)

# hostname is technically variable, but should really only ever be tested on same system anyways
# technically would be an anomaly if hostname changed, but that example doesnt exist
SSH_PREFX = "<TIMESTAMP> hostname sshd[<PID>]:"


def get_logs(path: str) -> list[str]:
    logs = []
    with open(path, "r") as logfile:
        for line in logfile:
            clean = line.rstrip("\r\n")
            if clean: logs.append(clean)

    return logs

def preprocess_ssh(line) -> dict:
    match = SYSLOG_REGEX.match(line)
    if match:
        match = match.groupdict()
        match["parameters"] = [match["timestamp"], match["pid"]]
        return match
    else:
        print(f"Line did not match syslog format: {line}")
        return {}