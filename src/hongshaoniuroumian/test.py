import pprint

from dataset import WINDOW_SIZE
from generation import LogGenerator
from ingest import get_logs, preprocess_ssh

miner_persistence_path = "../../data/templateminerstate"
checkpoint_path = "../../data/best_model.pt"
raw_logs = get_logs("../../data/SSH.log")

tot = (len(raw_logs))
train_validate_frac = 0.9
bruh = int(train_validate_frac * tot)
bruh+=2
print(bruh)


input_lines = raw_logs[bruh:bruh+WINDOW_SIZE]
real_line = raw_logs[bruh+WINDOW_SIZE+1]
generator = LogGenerator(
    checkpoint_path,
    miner_persistence_path,
    window_size=WINDOW_SIZE,
)

# bruh_line = raw_logs[3]
# print(bruh_line)
# print(preprocess_ssh(bruh_line))


def print_vectorization(index: int, raw_line: str) -> None:
    processed = preprocess_ssh(raw_line)
    template_vector, parameter_vector, event = generator.vectorize_log(raw_line)
    pprint.pprint({
        "index": index,
        "raw_line": raw_line,
        "message": processed.get("message"),
        "template_id": event.get("template_id"),
        "template": event.get("template"),
        "preprocess_parameters": processed.get("parameters"),
        "matched_parameters": event.get("parameters"),
        "all_parameters": (
            processed.get("parameters", []) + event.get("parameters", [])
        ),
        "template_vector_shape": (
            tuple(template_vector.shape) if template_vector is not None else None
        ),
        "parameter_vector": (
            parameter_vector.tolist() if parameter_vector is not None else None
        ),
    })


for index, line in enumerate(input_lines):
    print_vectorization(index, line)

print("Real output:")
print_vectorization(WINDOW_SIZE, real_line)

print("Score:")
pprint.pprint(generator.score_inputs(input_lines, real_line))