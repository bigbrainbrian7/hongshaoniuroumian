import torch
import time

from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig
from drain3.file_persistence import FilePersistence
from pathlib import Path
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

from ingest import get_logs, preprocess_bruh, postprocess_bruh
from drain import Drain
from dataset import LogDataset, split_dataset

from template import Itemplate2Vec
from parameter import Parameter2Vec
from model import SequenceEncoder

import pprint

EPOCHS = 10
HIDDEN_SIZE = 128
NUM_LAYERS = 2
DROPOUT = 0.2
TRAIN_BATCH_SIZE = 32
EVALUATION_BATCH_SIZE = 128
LEARNING_RATE = 3e-4
WEIGHT_DECAY = 1e-2
MAX_GRAD_NORM = 1.0
EARLY_STOPPING_PATIENCE = 3
MIN_VALIDATION_IMPROVEMENT = 1e-4
PARAMETER_LOSS_WEIGHT = 0.25

torch.manual_seed(42)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

miner_persistence_path = "../../data/bruh-templateminerstate"
checkpoint_path = Path("../../data/bruh-best_model.pt")
final_model_path = Path("../../data/bruh-final_model.pt")

# technically, this can stay in dataset.py, as thats where input and output vectors are vectorized
# however, keepinig it here for now for debugging
miner_config = TemplateMinerConfig()
miner_config.load(str(Path(__file__).with_name("drain3.ini")))
miner = TemplateMiner(FilePersistence(miner_persistence_path), miner_config)
drain = Drain(miner, miner_persistence_path, preprocess_bruh, postprocess_bruh)

dataset = drain.build_dataset(get_logs("../../data/bruh.log"))
templates = drain.get_templates()

# dataset = build_dataset(
#     logs=get_logs("../../data/BGL.log"),
#     miner=miner,
#     persistence_path=miner_persistence_path,
#     # prefix=SSH_PREFX,
#     # preprocesser=preprocess_ssh
# )
# templates = get_templates(miner)

pprint.pprint(templates)

itemplate2vec = Itemplate2Vec(device=device)
template_vectors_by_id = {
    template_id: vector.cpu()
    for template_id, vector in itemplate2vec.encode_templates(templates).items()
}
template_embedding_dim = next(iter(template_vectors_by_id.values())).shape[0]

torch_dataset = LogDataset(dataset, template_vectors_by_id)

train_logs, val_logs, test_logs = split_dataset(torch_dataset)

train_dataloader = DataLoader(
    train_logs,
    batch_size=TRAIN_BATCH_SIZE,
    shuffle=True,
    pin_memory=device.type == "cuda",
)
val_dataloader = DataLoader(
    val_logs,
    batch_size=EVALUATION_BATCH_SIZE,
    pin_memory=device.type == "cuda",
)
test_dataloader = DataLoader(
    test_logs,
    batch_size=EVALUATION_BATCH_SIZE,
    pin_memory=device.type == "cuda",
)

model = SequenceEncoder(
    template_embedding_dim,
    Parameter2Vec.EMBEDDING_DIM,
    template_hidden_size=HIDDEN_SIZE,
    num_layers=NUM_LAYERS,
    dropout=DROPOUT,
).to(device)
loss_fn = torch.nn.CosineEmbeddingLoss()
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=LEARNING_RATE,
    weight_decay=WEIGHT_DECAY,
)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
    optimizer,
    T_max=EPOCHS * len(train_dataloader),
    eta_min=LEARNING_RATE / 100,
)


def average_loss(dataloader, max_batches=None):
    model.eval()
    total = 0.0
    batches = 0

    with torch.no_grad():
        for batch_index, (inputs, targets) in enumerate(dataloader):
            if max_batches is not None and batch_index == max_batches:
                break

            input_template_vectors, input_parameter_vectors = (
                tensor.to(device, non_blocking=True)
                for tensor in inputs
            )
            target_template_vectors, target_parameter_vectors = (
                tensor.to(device, non_blocking=True)
                for tensor in targets
            )

            predicted_template_vectors, predicted_parameter_vectors = model(
                input_template_vectors,
                input_parameter_vectors,
            )
            cosine_target = torch.ones(
                predicted_template_vectors.shape[0],
                device=predicted_template_vectors.device,
            )

            template_loss = loss_fn(
                predicted_template_vectors,
                target_template_vectors,
                cosine_target,
            )
            parameter_loss = loss_fn(
                predicted_parameter_vectors,
                target_parameter_vectors,
                cosine_target,
            )
            total += (template_loss + PARAMETER_LOSS_WEIGHT * parameter_loss).item()
            batches += 1

    return total / batches if batches else 0.0


def format_duration(seconds: float) -> str:
    minutes, seconds = divmod(int(seconds), 60)
    return f"{minutes}:{seconds:02d}"


def print_progress(epoch, batch, total_batches, start_time, loss):
    progress = batch / total_batches
    width = 30
    completed = int(progress * width)
    bar = "█" * completed + " " * (width - completed)
    elapsed = time.monotonic() - start_time
    rate = batch / elapsed if elapsed else 0.0
    remaining = (total_batches - batch) / rate if rate else 0.0
    print(
        f"\r{epoch + 1}/{EPOCHS} {progress:3.0%}|{bar}| "
        f"{batch}/{total_batches} "
        f"[{format_duration(elapsed)}<{format_duration(remaining)}, "
        f"{rate:.2f}it/s, loss={loss:.4f}]\033[K",
        end="",
        flush=True,
    )


validation_epochs = []
train_losses = []
validation_losses = []
best_validation_loss = float("inf")
epochs_without_improvement = 0

for epoch in range(EPOCHS):
    model.train()

    total_loss = 0
    epoch_start_time = time.monotonic()
    for i, data in enumerate(train_dataloader):
        inputs, targets = data

        input_template_vectors, input_parameter_vectors = (
            tensor.to(device, non_blocking=True)
            for tensor in inputs
        )
        target_template_vectors, target_parameter_vectors = (
            tensor.to(device, non_blocking=True)
            for tensor in targets
        )

        optimizer.zero_grad(set_to_none=True)

        predicted_template_vector, predicted_parameter_vector = model(
            input_template_vectors,
            input_parameter_vectors,
        )

        cosine_target = torch.ones(
            predicted_template_vector.shape[0],
            device=predicted_template_vector.device,
        )

        template_loss = loss_fn(
            predicted_template_vector,
            target_template_vectors,
            cosine_target,
        )
        parameter_loss = loss_fn(
            predicted_parameter_vector,
            target_parameter_vectors,
            cosine_target,
        )
        loss = template_loss + PARAMETER_LOSS_WEIGHT * parameter_loss

        loss.backward()
        grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), MAX_GRAD_NORM)
        optimizer.step()
        scheduler.step()

        total_loss += loss.item()

        print_progress(
            epoch,
            i + 1,
            len(train_dataloader),
            epoch_start_time,
            loss.item(),
        )

    epoch_loss = total_loss / len(train_dataloader)
    validation_loss = average_loss(val_dataloader)

    print()
    print({
        "loss": f"{epoch_loss:.4f}",
        "grad_norm": f"{grad_norm:.4f}",
        "learning_rate": f"{optimizer.param_groups[0]['lr']:.2e}",
        "epoch": f"{epoch + 1:.4f}",
    })
    print({"eval_loss": f"{validation_loss:.4f}", "epoch": f"{epoch + 1:.4f}"})

    validation_epochs.append(epoch + 1)
    train_losses.append(epoch_loss)
    validation_losses.append(validation_loss)

    if validation_loss < best_validation_loss - MIN_VALIDATION_IMPROVEMENT:
        best_validation_loss = validation_loss
        epochs_without_improvement = 0
        torch.save(model.state_dict(), checkpoint_path)
    else:
        epochs_without_improvement += 1
        if epochs_without_improvement >= EARLY_STOPPING_PATIENCE:
            print({"early_stopping": True, "epoch": f"{epoch + 1:.4f}"})
            break

plt.plot(validation_epochs, train_losses, label="Train loss")
plt.plot(validation_epochs, validation_losses, label="Validation loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.legend()
plt.show()

torch.save(model.state_dict(), final_model_path)
model.load_state_dict(torch.load(checkpoint_path, weights_only=True, map_location=device))
test_loss = average_loss(test_dataloader)
print(f"Test loss: {test_loss:.4f}")

        
