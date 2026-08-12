from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig
from drain3.file_persistence import FilePersistence
from pathlib import Path

from ingest import get_logs, preprocess_ssh, SSH_PREFX
from drain import build_dataset, get_templates, get_unique_template_words

import pprint

miner_persistence_path = "../../data/templateminerstate"

miner=TemplateMiner(FilePersistence(miner_persistence_path))

dataset = build_dataset(
    logs=get_logs("../../data/SSH.log"),
    miner=miner,
    persistence_path=miner_persistence_path,
    prefix=SSH_PREFX,
    preprocesser=preprocess_ssh
)

for i in range(5):
    print(f"Log {i}:")
    pprint.pprint(dataset[i])

bruh1 = set(get_unique_template_words(miner))
bruh2 = set(get_unique_template_words(miner, prefix=SSH_PREFX))
print(bruh2-bruh1)