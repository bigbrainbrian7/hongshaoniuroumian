import torch
from torch.utils.data import Dataset

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
