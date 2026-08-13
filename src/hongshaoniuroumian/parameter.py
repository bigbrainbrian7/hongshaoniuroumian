import ipaddress
import re
from enum import StrEnum
from datetime import datetime

import torch
import torch.nn as nn

#TODO: unchatgpt and actually implement a logical embedding system

IPV4_PATTERN = re.compile(
    r"^\d{1,3}(?:\.\d{1,3}){3}$"
)

INTEGER_PATTERN = re.compile(
    r"^-?\d+$"
)

NUMBER_PATTERN = re.compile(
    r"^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$"
)

HOSTNAME_PATTERN = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)

URL_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")

STATE_VALUES = {
    "accepted",
    "closed",
    "connected",
    "disconnect",
    "disconnected",
    "failed",
    "failure",
    "invalid",
    "no",
    "open",
    "preauth",
    "[preauth]"
    "ssh2",
    "success",
    "true",
    "false",
    "yes",
}

TIME_FORMATS = (
    "%b %d %H:%M:%S",
    "%Y-%m-%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
)


class ParameterType(StrEnum):
    TIME = "time"
    USER = "user"
    NUMBER = "number"
    STATE = "state"
    RESOURCE = "resource"


def is_time(value: str) -> bool:
    for time_format in TIME_FORMATS:
        try:
            datetime.strptime(value, time_format)
            return True
        except ValueError:
            continue
    return False


def is_resource(value: str) -> bool:
    if URL_PATTERN.match(value) or value.startswith(("/", "./", "../", "~")):
        return True

    if HOSTNAME_PATTERN.match(value):
        return True

    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def classify_parameter(value: str) -> ParameterType:
    value = str(value).strip()

    if is_time(value):
        return ParameterType.TIME
    if NUMBER_PATTERN.match(value):
        return ParameterType.NUMBER
    if value.lower() in STATE_VALUES:
        return ParameterType.STATE
    if is_resource(value):
        return ParameterType.RESOURCE
    return ParameterType.USER


def classify_parameters(parameters: list[str]) -> list[ParameterType]:
    return [classify_parameter(parameter) for parameter in parameters]


def is_ipv4(value: str) -> bool:
    if not IPV4_PATTERN.match(value):
        return False

    try:
        ipaddress.IPv4Address(value)
        return True
    except ValueError:
        return False


def extract_parameter_features(
    parameters: list[str],
) -> list[float]:

    num_parameters = len(parameters)

    num_ips = 0
    num_integers = 0
    num_strings = 0

    string_lengths = []

    for parameter in parameters:
        parameter = str(parameter)

        if is_ipv4(parameter):
            num_ips += 1

        elif INTEGER_PATTERN.match(parameter):
            num_integers += 1

        else:
            num_strings += 1
            string_lengths.append(len(parameter))

    if string_lengths:
        avg_string_length = (
            sum(string_lengths)
            / len(string_lengths)
        )

        max_string_length = max(string_lengths)
        min_string_length = min(string_lengths)

    else:
        avg_string_length = 0.0
        max_string_length = 0.0
        min_string_length = 0.0

    return [
        float(num_parameters),
        float(num_ips),
        float(num_integers),
        float(num_strings),
        avg_string_length,
        max_string_length,
        min_string_length,
    ]


class ParameterEmbedding(nn.Module):
    """
    Converts fixed numerical parameter features
    into a learned dense parameter representation.
    """

    def __init__(
        self,
        input_dim: int = 7,
        output_dim: int = 32,
    ):
        super().__init__()

        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, output_dim),
        )

    def forward(
        self,
        parameter_features: torch.Tensor,
    ) -> torch.Tensor:

        return self.encoder(parameter_features)
