from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig
from drain3.file_persistence import FilePersistence
from pathlib import Path

from ingest import get_logs
from drain import build_miner, get_templates

import pprint

miner_persistence_path = "../../data/templateminerstate"

miner = TemplateMiner(FilePersistence(miner_persistence_path), TemplateMinerConfig())

if not Path(miner_persistence_path).is_file():
    build_miner(get_logs("../../data/OpenSSH_2k.log"), miner)

pprint.pprint(get_templates(miner))