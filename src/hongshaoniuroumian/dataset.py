import torch
from torch.utils.data import Dataset, Subset

from parameter import extract_parameter_features


WINDOW_SIZE = 20

#TODO: change to sliding window
class LogDataset(Dataset):
    def __init__(self, logs):
        self.logs = torch.tensor(
            [log["template_id"] for log in logs],
            dtype=torch.long,
        )
        self.parameter_features = torch.tensor(
            [extract_parameter_features(log["parameters"]) for log in logs],
            dtype=torch.float32,
        )

    def __len__(self):
        return max(0, (len(self.logs) - 1) // WINDOW_SIZE)

    def __getitem__(self, index):
        start = index * WINDOW_SIZE
        end = start + WINDOW_SIZE
        return (
            self.logs[start:end],
            self.parameter_features[start:end],
        ), (
            self.logs[end],
            self.parameter_features[end]
        )


def split_dataset(
    dataset: Dataset,
    train_fraction: float = 0.7,
    validation_fraction: float = 0.15,
) -> tuple[Subset, Subset, Subset]:
    if not 0 < train_fraction < 1:
        raise ValueError("train_fraction must be between 0 and 1")
    if not 0 < validation_fraction < 1 - train_fraction:
        raise ValueError("validation_fraction must leave examples for testing")

    total = len(dataset)
    train_end = int(total * train_fraction)
    validation_end = train_end + int(total * validation_fraction)

    return (
        Subset(dataset, range(0, train_end)),
        Subset(dataset, range(train_end, validation_end)),
        Subset(dataset, range(validation_end, total)),
    )
