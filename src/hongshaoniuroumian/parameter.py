import ipaddress
import re

import torch
import torch.nn as nn

#TODO: unchatgpt and actually implement a logical embedding system

IPV4_PATTERN = re.compile(
    r"^\d{1,3}(?:\.\d{1,3}){3}$"
)

INTEGER_PATTERN = re.compile(
    r"^-?\d+$"
)


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