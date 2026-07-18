import math
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
from torchvision.models.resnet import ResNet18_Weights

class PositionEmbeddingSine(nn.Module):
    """
    2D sine positional embedding for Transformer.
    """
    def __init__(self, num_pos_feats=64, temperature=10000, normalize=False, scale=None):
        super().__init__()
        self.num_pos_feats = num_pos_feats
        self.temperature = temperature
        self.normalize = normalize
        if scale is not None and normalize is False:
            raise ValueError("normalize should be True if scale is passed")
        if scale is None:
            scale = 2 * math.pi
        self.scale = scale

    def forward(self, x):
        b, c, h, w = x.shape
        mask = torch.ones((b, h, w), dtype=torch.bool, device=x.device)
        y_embed = mask.cumsum(1, dtype=torch.float32)
        x_embed = mask.cumsum(2, dtype=torch.float32)
        if self.normalize:
            eps = 1e-6
            y_embed = y_embed / (y_embed[:, -1:, :] + eps) * self.scale
            x_embed = x_embed / (x_embed[:, :, -1:] + eps) * self.scale

        dim_t = torch.arange(self.num_pos_feats, dtype=torch.float32, device=x.device)
        dim_t = self.temperature ** (2 * (torch.div(dim_t, 2, rounding_mode='floor')) / self.num_pos_feats)

        pos_x = x_embed[:, :, :, None] / dim_t
        pos_y = y_embed[:, :, :, None] / dim_t
        
        pos_x = torch.stack((pos_x[:, :, :, 0::2].sin(), pos_x[:, :, :, 1::2].cos()), dim=4).flatten(3)
        pos_y = torch.stack((pos_y[:, :, :, 0::2].sin(), pos_y[:, :, :, 1::2].cos()), dim=4).flatten(3)
        pos = torch.cat((pos_y, pos_x), dim=3).permute(0, 3, 1, 2)
        return pos


class TableTransformerDETR(nn.Module):
    """
    Table Transformer (TATR) based on DETR architecture.
    """
    def __init__(self, num_classes=6, hidden_dim=256, nheads=8,
                 num_encoder_layers=6, num_decoder_layers=6, num_queries=100):
        super().__init__()
        
        # Output classes mapping:
        # 0: background (or N/A)
        # 1: table_row
        # 2: table_column
        # 3: table_column_header
        # 4: table_projected_row_header
        # 5: table_spanning_cell
        self.num_classes = num_classes
        
        # Encoder: ResNet-18
        resnet = models.resnet18(weights=ResNet18_Weights.DEFAULT)
        # We need the output of the conv layers, ignoring pooling and fc
        self.backbone = nn.Sequential(*list(resnet.children())[:-2])
        self.conv = nn.Conv2d(512, hidden_dim, 1)
        
        # Transformer
        self.transformer = nn.Transformer(
            d_model=hidden_dim,
            nhead=nheads,
            num_encoder_layers=num_encoder_layers,
            num_decoder_layers=num_decoder_layers,
            dim_feedforward=2048,
            dropout=0.1,
            activation="relu",
            batch_first=True
        )
        
        # Output Heads
        self.class_embed = nn.Linear(hidden_dim, num_classes + 1)
        self.bbox_embed = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 4)
        )
        
        # Queries and Positional Embedding
        self.query_embed = nn.Embedding(num_queries, hidden_dim)
        self.pos_emb = PositionEmbeddingSine(hidden_dim // 2, normalize=True)
        
    def forward(self, x):
        """
        Forward pass for Table Transformer.
        """
        # Extract features
        features = self.backbone(x)
        h = self.conv(features)
        
        b, c, height, width = h.shape
        pos = self.pos_emb(h).flatten(2).permute(0, 2, 1) # [b, h*w, c]
        h_flat = h.flatten(2).permute(0, 2, 1) # [b, h*w, c]
        
        # Queries
        query_embed = self.query_embed.weight.unsqueeze(0).repeat(b, 1, 1)
        
        # Pass through Transformer
        tgt = torch.zeros_like(query_embed)
        out = self.transformer(
            src=h_flat + pos,
            tgt=tgt + query_embed
        )
        
        # Predict classes and bounding boxes
        outputs_class = self.class_embed(out)
        outputs_coord = self.bbox_embed(out).sigmoid()
        
        return {'pred_logits': outputs_class, 'pred_boxes': outputs_coord}
