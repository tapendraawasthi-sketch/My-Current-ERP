import torch
import torch.nn as nn

class SmoothL1CornerLoss(nn.Module):
    """
    Smooth L1 loss on corner coordinates.
    """
    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        return nn.functional.smooth_l1_loss(pred, target, beta=0.1)


class QuadrilateralIoULoss(nn.Module):
    """
    Differentiable IoU approximation for quadrilateral corners.
    Uses the Shoelace formula to compute polygon area, then approximates
    intersection area via a differentiable relaxation.
    
    This penalizes predictions where the quad shape is wrong even
    if individual corner positions are close.
    """
    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        # pred/target shape: (B, 8) = [x_tl, y_tl, x_tr, y_tr, x_br, y_br, x_bl, y_bl]
        pred_area = self._shoelace_area(pred)
        target_area = self._shoelace_area(target)
        # Approximated intersection: min of areas * (1 - smooth_l1 distance)
        distance = nn.functional.smooth_l1_loss(pred, target, reduction='none').mean(dim=1)
        intersection_approx = torch.min(pred_area, target_area) * torch.exp(-distance * 5.0)
        union_approx = pred_area + target_area - intersection_approx
        iou = intersection_approx / (union_approx + 1e-7)
        return 1.0 - iou.mean()
    
    def _shoelace_area(self, corners: torch.Tensor) -> torch.Tensor:
        # corners: (B, 8)
        # Returns (B,) area using Shoelace formula
        x = corners[:, 0::2]  # (B, 4)
        y = corners[:, 1::2]  # (B, 4)
        # Shoelace
        x_next = torch.roll(x, -1, dims=1)
        y_next = torch.roll(y, -1, dims=1)
        area = 0.5 * torch.abs(torch.sum(x * y_next - x_next * y, dim=1))
        return area


class CombinedCornerLoss(nn.Module):
    """Weighted sum of SmoothL1 + IoU loss."""
    def __init__(self, smooth_l1_weight: float = 0.7, iou_weight: float = 0.3):
        super().__init__()
        self.smooth_l1 = SmoothL1CornerLoss()
        self.iou_loss = QuadrilateralIoULoss()
        self.w1 = smooth_l1_weight
        self.w2 = iou_weight
    
    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        return self.w1 * self.smooth_l1(pred, target) + self.w2 * self.iou_loss(pred, target)


class DiceLoss(nn.Module):
    """Dice loss for binary segmentation."""
    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        # pred: (B, 1, H, W) after sigmoid; target: (B, 1, H, W) binary
        smooth = 1.0
        pred_flat = pred.view(pred.size(0), -1)
        target_flat = target.view(target.size(0), -1)
        intersection = (pred_flat * target_flat).sum(dim=1)
        return 1.0 - ((2.0 * intersection + smooth) / (pred_flat.sum(dim=1) + target_flat.sum(dim=1) + smooth)).mean()
