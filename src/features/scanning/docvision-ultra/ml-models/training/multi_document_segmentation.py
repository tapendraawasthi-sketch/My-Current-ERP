import torch
import torch.nn as nn
from torchvision.models.detection.backbone_utils import mobilenet_backbone
from torchvision.models.detection import MaskRCNN

def get_multidoc_segmentation_model(num_classes=2):
    """
    Creates a Mask R-CNN model with a lightweight MobileNetV3 backbone
    for detecting multiple document instances.
    
    Args:
        num_classes (int): Number of classes. 2 = background + document.
        
    Returns:
        MaskRCNN: The PyTorch model.
    """
    # MobileNetV3 Large backbone with FPN
    backbone = mobilenet_backbone("mobilenet_v3_large", pretrained=True, fpn=True)
    
    # Mask R-CNN with the mobilenet backbone
    model = MaskRCNN(backbone, num_classes=num_classes)
    
    return model

class MultiDocumentSegmenter(nn.Module):
    """
    Lightweight Mask R-CNN wrapper for multi-document instance segmentation.
    Backbone: MobileNetV3
    Output: Instance masks + Bounding boxes
    """
    def __init__(self, num_classes=2):
        """
        Initializes the model.
        Args:
            num_classes (int): The number of classes including background.
        """
        super().__init__()
        self.model = get_multidoc_segmentation_model(num_classes=num_classes)
        
    def forward(self, images, targets=None):
        """
        Forward pass.
        
        Args:
            images (list[torch.Tensor]): List of images, each of shape [C, H, W], 0-1 range.
            targets (list[dict]): List of targets for training. Optional.
            
        Returns:
            dict or list[dict]: If training, dict of losses. If eval, list of dicts with 
                                'boxes', 'labels', 'masks', 'scores'.
        """
        return self.model(images, targets)
