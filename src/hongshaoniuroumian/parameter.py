import re
import math
from enum import StrEnum
from datetime import datetime

import torch
import torch.nn as nn

NUMBER_PATTERN = re.compile(
    r"^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$"
)

TIME_FORMATS = (
    "%b %d %H:%M:%S",
    "%Y-%m-%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
)


class ParameterType(StrEnum):
    TIME = "time"
    NUMBER = "number"
    OTHER = "other"


def is_time(value: str) -> bool:
    return parse_time(value) is not None


def parse_time(value: str) -> datetime | None:
    for time_format in TIME_FORMATS:
        try:
            return datetime.strptime(value, time_format)
        except ValueError:
            continue
    return None


def classify_parameter(value: str) -> ParameterType:
    value = str(value).strip()

    if is_time(value):
        return ParameterType.TIME
    if NUMBER_PATTERN.fullmatch(value):
        return ParameterType.NUMBER
    return ParameterType.OTHER


def classify_parameters(parameters: list[str]) -> list[ParameterType]:
    return [classify_parameter(parameter) for parameter in parameters]


class Parameter2Vec:
    EMBEDDING_DIM = 10

    def encode_parameter(self, parameters: str) -> torch.Tensor:
        for parameter in parameters:
            parameter_type = classify_parameter(parameter)
            if parameter_type is ParameterType.TIME:
                return self.encode_time(parameter)

        #itll error out but at least ill know something went wrong
        return torch.zeros((1,997))

    def encode_time(self, value: str) -> torch.Tensor:
        parsed = parse_time(str(value).strip())
        if parsed is None:
            raise ValueError(f"Unsupported time parameter: {value!r}")

        units = (
            (parsed.month, 12),
            (parsed.day, 31),
            (parsed.hour, 24),
            (parsed.minute, 60),
            (parsed.second, 60),
        )
        vector = []
        for unit, maximum in units:
            angle = 2 * math.pi * unit / maximum
            vector.extend((math.sin(angle), math.cos(angle)))

        return torch.tensor(vector, dtype=torch.float32)


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
