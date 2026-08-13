from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig
from drain3.file_persistence import FilePersistence
from pathlib import Path
from torch.utils.data import DataLoader

from ingest import get_logs, preprocess_ssh, postprocess_ssh
from drain import Drain
from dataset import LogDataset

import pprint

miner_persistence_path = "../../data/templateminerstate"

miner=TemplateMiner(FilePersistence(miner_persistence_path))
drain = Drain(miner, miner_persistence_path, preprocess_ssh, postprocess_ssh)

dataset = drain.build_dataset(get_logs("../../data/SSH.log"))

# for i in range(100):
#     print(f"Log {i}:")
#     pprint.pprint(dataset[i])
j=0
for i in range(1000):
# for i in range(len(dataset)):
    data = dataset[i]
    # if data["template_id"] == 9:
    if i == 33:
        # if data["parameters"][-1] 7!= "ByeBye":
        print(f"Log {i}")
        pprint.pprint(data)

pprint.pprint(drain.get_templates())

# torch_dataset = LogDataset(dataset)
# dataloader = DataLoader(torch_dataset, batch_size=1, shuffle=True)
