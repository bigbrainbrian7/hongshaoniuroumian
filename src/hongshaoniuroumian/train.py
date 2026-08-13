import torch

from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig
from drain3.file_persistence import FilePersistence
from pathlib import Path
from torch.utils.data import DataLoader

from ingest import get_logs, preprocess_ssh, SSH_PREFX
from drain import build_dataset, get_templates, get_unique_template_words
from dataset import LogDataset

from template import TemplateEmbedding
from parameter import ParameterEmbedding
from model import SequenceEncoder

import pprint

EPOCHS = 5
embedding_dim = 32

miner_persistence_path = "../../data/templateminerstate"

miner=TemplateMiner(FilePersistence(miner_persistence_path))

dataset = build_dataset(
    logs=get_logs("../../data/SSH.log"),
    miner=miner,
    persistence_path=miner_persistence_path,
    prefix=SSH_PREFX,
    preprocesser=preprocess_ssh
)
templates = get_templates(miner, SSH_PREFX)
pprint.pprint(templates)

torch_dataset = LogDataset(dataset)
dataloader = DataLoader(torch_dataset, batch_size=1, shuffle=True)


# need to put in template id-1 as drain returns template ids one indexed
template_vectorizer = TemplateEmbedding(len(templates), embedding_dim)
parameter_vectorizer = ParameterEmbedding(output_dim=embedding_dim)

for param in template_vectorizer.parameters():
    param.requires_grad = False

for param in parameter_vectorizer.parameters():
    param.requires_grad = False

model = SequenceEncoder(embedding_dim, len(templates))
loss_fn = torch.nn.CosineEmbeddingLoss()
optimizer = torch.optim.AdamW(model.parameters())

for epoch in range(EPOCHS):
    model.train()

    total_loss = 0

    for i, data in enumerate(dataloader):
        inputs, targets = data

        input_template_ids, input_parameter_features = inputs
        target_template_id, target_parameter_features = targets

        # Drain IDs are 1-indexed, nn.Embedding is 0-indexed
        input_template_ids = input_template_ids - 1
        target_template_id = target_template_id - 1

        with torch.no_grad():
            template_vectors = template_vectorizer(input_template_ids)
            parameter_vectors = parameter_vectorizer(input_parameter_features)

            target_template_vector = template_vectorizer(target_template_id)
            target_parameter_vector = parameter_vectorizer(target_parameter_features)

            #intentionally element wise
            # want parameters to be an addition, rather than a separate dimension to be considered
            # shouldnt be **too** bad
            target_vector = target_template_vector + target_parameter_vector

        optimizer.zero_grad()

        predicted_vector = model(template_vectors, parameter_vectors)

        cosine_target = torch.ones(
            predicted_vector.shape[0],
            device=predicted_vector.device,
        )

        loss = loss_fn(
            predicted_vector,
            target_vector,
            cosine_target,
        )

        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    average_loss = total_loss / len(dataloader)

    print(f"EPOCH {epoch+1}")
    print(f"Average loss: {average_loss}")

        
