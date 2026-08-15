from collections.abc import Iterator
import re

SYSLOG_REGEX = re.compile(
    r"^(?P<timestamp>"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}"
    r")\s+"
    r"(?P<host>\S+)\s+"
    r"(?P<process>[\w-]+)"
    r"\[(?P<pid>\d+)\]:\s+"
    r"(?P<message>.*)$"
)

IP_REGEX = re.compile(
    r"(?<!\d)(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}"
    r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?!\d)"
)
# hostname is technically variable, but should really only ever be tested on same system anyways
# technically would be an anomaly if hostname changed, but that example doesnt exist
SSH_PREFX = "<TIMESTAMP> hostname sshd[<PID>]:"

# pre templates
ssh_mapping: dict[str, str] = {
    "Bye Bye": "ByeBye"
}

#goofy
ssh_backmap = {v: k for k, v in ssh_mapping.items()}


def get_logs(path: str) -> list[str]:
    logs = []
    with open(path, "r") as logfile:
        for line in logfile:
            clean = line.rstrip("\r\n")
            if clean: logs.append(clean)

    return logs

def preprocess_ssh(line) -> dict:
    for k, v in ssh_mapping.items():
        line = line.replace(k, v)

    # line = re.sub(IP_REGEX, r" \g<0> ", line)

    match = SYSLOG_REGEX.match(line)

    if not match:
        print(f"Line did not match syslog format: {line}")
        return {"message": line, "parameters": []}
    
    match = match.groupdict()
    match["parameters"] = [match["timestamp"], match["pid"]]
    return match

def postprocess_ssh(line: str) -> str:
    for k, v in ssh_backmap.items():
        line = line.replace(k, v)

    return SSH_PREFX + line
