from collections.abc import Iterable

from drain3 import TemplateMiner

def build_miner(lines: Iterable[str], miner: TemplateMiner) -> None:
    for line in lines:
        miner.add_log_message(line)


def get_templates(miner: TemplateMiner) -> dict[int, str]:
    return {
        int(cluster.cluster_id): cluster.get_template()
        for cluster in miner.drain.clusters
    }
