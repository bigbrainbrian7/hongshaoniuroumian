from collections.abc import Iterable
from pathlib import Path
from typing import Callable

from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig

# TODO: should probably make a class instead
# miner, prefix, all of that seams stateful

def build_miner(lines: Iterable[str], miner: TemplateMiner) -> None:
    for line in lines:
        miner.add_log_message(line)


def get_templates(miner: TemplateMiner, prefix: str = "") -> dict[int, str]:
    return {
        int(cluster.cluster_id): prefix + cluster.get_template()
        for cluster in miner.drain.clusters
    }

def get_unique_template_words(miner: TemplateMiner, prefix="") -> list[str]:
    return list({
        word
        for cluster in miner.drain.clusters 
        for word in cluster.log_template_tokens + tuple(prefix.split())
    })

def match_line(line: str, miner: TemplateMiner) -> dict | None:
    result = miner.match(line)

    # TODO: check similarity
    if result is None:
        return None

    template = result.get_template()

    parameters = [param.value for param in miner.extract_parameters(template, line) or []]

    return {
        "template_id": result.cluster_id,
        "template": template,
        "parameters": parameters,
    }

def build_dataset(
        logs: list[str], 
        miner: TemplateMiner, 
        persistence_path: str, 
        preprocesser: Callable[[str], dict] = lambda s: {"message": s, "parameters": []}, 
        prefix: str = "") -> list[dict]:

    processed_logs = [preprocesser(line) for line in logs]

    if not Path(persistence_path).is_file():
        build_miner([log["message"] for log in processed_logs], miner)

    dataset = []
    for log in processed_logs:
        match = match_line(log["message"], miner)
        if match is None:
            print("didn't match to any template")
            continue
        # combine parameters from preprocessing and matching
        match["template"] = prefix + match["template"]
        match["parameters"] = log["parameters"] + match["parameters"]
        dataset.append(match)

    return dataset