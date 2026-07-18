import os
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.models as models
from torchvision.models import MobileNet_V3_Large_Weights
from torch.utils.data import DataLoader, Dataset
from typing import List, Tuple, Dict, Any, Optional
from tqdm import tqdm

class DocumentClassifier(nn.Module):
    """
    MobileNetV3-Large based classifier for 20 document classes.
    """
    CLASSES = [
        "letter_a4", "receipt", "business_card", "id_card_front", "id_card_back",
        "passport_page", "invoice", "bank_statement", "check", "tax_form",
        "medical_form", "book_page", "magazine_page", "whiteboard", "handwritten_note",
        "sticky_note", "certificate", "contract", "photograph", "other"
    ]
    
    def __init__(self, num_classes: int = len(CLASSES), pretrained: bool = True):
        super(DocumentClassifier, self).__init__()
        self.num_classes = num_classes
        
        # Load MobileNetV3-Large
        weights = MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        self.backbone = models.mobilenet_v3_large(weights=weights)
        
        # Modify the classifier head
        in_features = self.backbone.classifier[3].in_features
        self.backbone.classifier[3] = nn.Linear(in_features, num_classes)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        Args:
            x (torch.Tensor): Input batch of images (N, C, H, W)
        Returns:
            torch.Tensor: Logits (N, num_classes)
        """
        return self.backbone(x)
        
    def predict(self, x: torch.Tensor) -> torch.Tensor:
        """
        Predict pass with softmax.
        Args:
            x (torch.Tensor): Input batch of images (N, C, H, W)
        Returns:
            torch.Tensor: Class probabilities (N, num_classes)
        """
        logits = self(x)
        return torch.softmax(logits, dim=1)

class DummyDocumentDataset(Dataset):
    """
    Dummy dataset for demonstration and testing purposes.
    """
    def __init__(self, size: int = 100, transform=None):
        self.size = size
        self.transform = transform
        
    def __len__(self):
        return self.size
        
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        # Generate random image tensor matching MobileNetV3 requirements
        # (C=3, H=224, W=224)
        image = torch.rand(3, 224, 224)
        label = torch.randint(0, len(DocumentClassifier.CLASSES), (1,)).item()
        
        if self.transform:
            image = self.transform(image)
            
        return image, label

def train_model(
    model: nn.Module, 
    train_loader: DataLoader, 
    val_loader: DataLoader, 
    num_epochs: int = 10, 
    learning_rate: float = 1e-4,
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
):
    """
    Training loop for the document classifier.
    """
    model = model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    print(f"Starting training on {device} for {num_epochs} epochs...")
    
    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{num_epochs} [Train]")
        for inputs, labels in pbar:
            inputs, labels = inputs.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
            pbar.set_postfix({'loss': f'{loss.item():.4f}', 'acc': f'{100 * correct / total:.2f}%'})
            
        # Validation phase
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                
                val_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                val_total += labels.size(0)
                val_correct += (predicted == labels).sum().item()
                
        val_acc = 100 * val_correct / val_total if val_total > 0 else 0
        avg_val_loss = val_loss / len(val_loader) if len(val_loader) > 0 else 0
        print(f"Epoch {epoch+1} Summary - Train Loss: {running_loss/len(train_loader):.4f}, "
              f"Train Acc: {100 * correct / total:.2f}% | "
              f"Val Loss: {avg_val_loss:.4f}, Val Acc: {val_acc:.2f}%")

if __name__ == "__main__":
    # Example usage
    dataset = DummyDocumentDataset(size=500)
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)
    
    classifier = DocumentClassifier(pretrained=True)
    
    train_model(classifier, train_loader, val_loader, num_epochs=2)
