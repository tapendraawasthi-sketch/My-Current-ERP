import torch
import torch.nn as nn
from torchvision.models.detection import MaskRCNN
from torchvision.models.detection.anchor_utils import AnchorGenerator
from torchvision.models.detection.backbone_utils import mobilenet_backbone
from torch.utils.data import DataLoader, Dataset
from typing import List, Tuple, Dict, Any
from tqdm import tqdm

class DocumentLayoutAnalysisModel(nn.Module):
    """
    Mask R-CNN with MobileNetV3-Large backbone + FPN for Document Layout Analysis.
    """
    CLASSES = [
        "background", # Class 0 is always background in Mask R-CNN
        "title", "text_paragraph", "heading", "subheading", "table", 
        "figure", "caption", "page_number", "header", "footer", 
        "list", "equation", "stamp", "signature", "logo"
    ]
    
    def __init__(self, num_classes: int = len(CLASSES), pretrained_backbone: bool = True):
        super(DocumentLayoutAnalysisModel, self).__init__()
        self.num_classes = num_classes
        
        # Load MobileNetV3-Large backbone with FPN
        # fpn=True adds a Feature Pyramid Network on top of the backbone
        self.backbone = mobilenet_backbone("mobilenet_v3_large", pretrained=pretrained_backbone, fpn=True)
        
        # Determine the number of output channels from the backbone
        # mobilenet_v3_large with FPN typically outputs 256 channels
        out_channels = self.backbone.out_channels
        
        # Define anchor sizes and aspect ratios for document elements
        anchor_sizes = ((32, 64, 128, 256, 512),) * 3
        aspect_ratios = ((0.5, 1.0, 2.0),) * len(anchor_sizes)
        anchor_generator = AnchorGenerator(sizes=anchor_sizes, aspect_ratios=aspect_ratios)
        
        # Feature map extractor for RoI pooling
        roi_pooler = torchvision.ops.MultiScaleRoIAlign(
            featmap_names=['0', '1', '2', '3'],
            output_size=7,
            sampling_ratio=2
        )
        
        mask_roi_pooler = torchvision.ops.MultiScaleRoIAlign(
            featmap_names=['0', '1', '2', '3'],
            output_size=14,
            sampling_ratio=2
        )
        
        # Initialize Mask R-CNN
        self.model = MaskRCNN(
            self.backbone,
            num_classes=self.num_classes,
            rpn_anchor_generator=anchor_generator,
            box_roi_pool=roi_pooler,
            mask_roi_pool=mask_roi_pooler
        )
        
    def forward(self, images: List[torch.Tensor], targets: List[Dict[str, torch.Tensor]] = None):
        """
        Forward pass for Mask R-CNN.
        Args:
            images (List[torch.Tensor]): List of input images (C, H, W).
            targets (List[Dict]): List of target dicts containing boxes, labels, masks.
        Returns:
            Dict[str, torch.Tensor]: Losses during training, or List[Dict] with predictions during inference.
        """
        return self.model(images, targets)

class DummyLayoutDataset(Dataset):
    """
    Dummy dataset for layout analysis training loop testing.
    """
    def __init__(self, size: int = 20):
        self.size = size
        
    def __len__(self):
        return self.size
        
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
        # Random image: (3, H, W)
        image = torch.rand(3, 512, 512)
        
        # Random number of objects (1 to 5)
        num_objs = torch.randint(1, 6, (1,)).item()
        
        # Dummy boxes [x1, y1, x2, y2]
        boxes = []
        for _ in range(num_objs):
            x1, y1 = torch.randint(0, 200, (2,)).tolist()
            x2, y2 = x1 + torch.randint(50, 100, (1,)).item(), y1 + torch.randint(50, 100, (1,)).item()
            boxes.append([x1, y1, x2, y2])
        boxes = torch.as_tensor(boxes, dtype=torch.float32)
        
        # Dummy labels (1 to num_classes-1)
        labels = torch.randint(1, len(DocumentLayoutAnalysisModel.CLASSES), (num_objs,), dtype=torch.int64)
        
        # Dummy masks (num_objs, H, W)
        masks = torch.zeros((num_objs, 512, 512), dtype=torch.uint8)
        for i, box in enumerate(boxes):
            masks[i, int(box[1]):int(box[3]), int(box[0]):int(box[2])] = 1
            
        target = {
            "boxes": boxes,
            "labels": labels,
            "masks": masks,
            "image_id": torch.tensor([idx])
        }
        
        return image, target

def collate_fn(batch):
    return tuple(zip(*batch))

def train_layout_model(
    model: nn.Module, 
    train_loader: DataLoader, 
    num_epochs: int = 5, 
    learning_rate: float = 1e-4,
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
):
    """
    Dummy training loop for Mask R-CNN.
    """
    model = model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    
    print(f"Starting layout model training on {device}...")
    
    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        
        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{num_epochs}")
        for images, targets in pbar:
            images = list(image.to(device) for image in images)
            targets = [{k: v.to(device) for k, v in t.items()} for t in targets]
            
            optimizer.zero_grad()
            
            # Mask R-CNN returns a dict of losses in train mode
            loss_dict = model(images, targets)
            losses = sum(loss for loss in loss_dict.values())
            
            losses.backward()
            optimizer.step()
            
            running_loss += losses.item()
            pbar.set_postfix({'loss': f'{losses.item():.4f}'})
            
        print(f"Epoch {epoch+1} Avg Loss: {running_loss/len(train_loader):.4f}")

if __name__ == "__main__":
    import torchvision
    
    # Initialize Dataset and DataLoader
    dataset = DummyLayoutDataset(size=50)
    data_loader = DataLoader(dataset, batch_size=2, shuffle=True, collate_fn=collate_fn)
    
    # Initialize Model
    model = DocumentLayoutAnalysisModel()
    
    # Run dummy training
    train_layout_model(model, data_loader, num_epochs=2)
