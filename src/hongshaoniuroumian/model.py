import torch
import torch.nn as nn


class Attention(nn.Module):
    def __init__(self, hidden_dim: int):
        super().__init__()

        self.score = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 1),
        )

    def forward(
        self,
        x: torch.Tensor,
    ) -> torch.Tensor:

        # [batch, seq_len, hidden_dim]
        scores = self.score(x)

        # [batch, seq_len]
        scores = scores.squeeze(-1)

        weights = torch.softmax(scores, dim=1)

        #broadcasts back on the hidden_dim
        expanded_weights = weights.unsqueeze(-1)

        # Weighted sum of BiLSTM outputs
        context = torch.sum(
            x * expanded_weights,
            dim=1,
        )

        # context: [batch, hidden_dim]
        # weights: [batch, seq_len]
        return context


class SequenceEncoder(nn.Module):
    def __init__(
        self,
        embedding_dim: int,
        hidden_size: int = 64,
        num_layers: int = 1,
        dropout: float = 0.1
    ):
        super().__init__()

        self.template_bilstm = nn.LSTM(
            input_size=embedding_dim,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
            bidirectional=True,
        )

        self.template_attention = Attention(
            hidden_dim=hidden_size * 2,
        )

        self.parameter_bilstm = nn.LSTM(
            input_size=embedding_dim,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
            bidirectional=True,
        )

        self.parameter_attention = Attention(
            hidden_dim=hidden_size * 2,
        )

        self.output_projection = nn.Linear(
            hidden_size * 2,
            embedding_dim
        )

        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        template_vectors: torch.Tensor,
        # parameter_vectors: torch.Tensor,
    ) -> torch.Tensor:
        
        # [batch, seq_len, hidden_size * 2]
        template_output, _ = self.template_bilstm(template_vectors)
        template_output = self.dropout(template_output)
        # [batch, hidden_size * 2]
        template_context = (self.template_attention(template_output))

        # # [batch, seq_len, hidden_size * 2]
        # parameter_output, _ = self.parameter_bilstm(parameter_vectors)
        # parameter_output = self.dropout(parameter_output)
        # # [batch, hidden_size * 2]
        # parameter_context = self.parameter_attention(parameter_output)

        # [batch, hidden_size * 2]
        context = template_context #+ parameter_context

        pred = self.output_projection(context)

        return pred
