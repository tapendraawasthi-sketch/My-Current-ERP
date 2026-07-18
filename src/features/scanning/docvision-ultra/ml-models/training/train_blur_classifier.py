#!/usr/bin/env python3
"""
Train the blur type classifier model.
Architecture: MobileNetV3-Small → GAP → Dense(128, ReLU) → Dense(3, Softmax)
Input: 128x128 grayscale patches
Output: [P_sharp, P_defocus, P_motion]
"""

import argparse
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from pathlib import Path
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
import wandb
from torchvision.models import mobilenet_v3_small
import sys
import os

from blur_classifier_dataset import BlurClassifierDataset, extract_patches_from_documents

# Try to import from corner_detection_model.py, fallback to local def if not found
try:
    from corner_detection_model import BlurClassifier
except ImportError:
    class BlurClassifier(nn.Module):
        def __init__(self, num_classes=3):
            super().__init__()
            # MobileNetV3 small, input 1 channel
            self.backbone = mobilenet_v3_small(weights=None)
            self.backbone.features[0][0] = nn.Conv2d(1, 16, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1), bias=False)
            in_features = self.backbone.classifier[0].in_features
            self.backbone.classifier = nn.Sequential(
                nn.Linear(in_features, 128),
                nn.ReLU(inplace=True),
                nn.Dropout(p=0.2),
                nn.Linear(128, num_classes)
            )

        def forward(self, x):
            return self.backbone(x)

def main():
    parser = argparse.ArgumentParser(description="Train Blur Classifier")
    parser.add_argument('--document-dir', type=str, required=True, help="Directory with source document images")
    parser.add_argument('--output-dir', type=str, default='checkpoints', help="Output directory for model checkpoints")
    parser.add_argument('--epochs', type=int, default=50, help="Number of epochs to train")
    parser.add_argument('--batch-size', type=int, default=128, help="Batch size")
    parser.add_argument('--lr', type=float, default=3e-4, help="Learning rate")
    args = parser.parse_args()

    wandb.init(project="docvision-blur-classifier", config=vars(args))
    
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Extracting patches from {args.document_dir}...")
    patches = extract_patches_from_documents(args.document_dir)
    print(f"Extracted {len(patches)} patches.")
    if not patches:
        print("No patches found. Exiting.")
        return
        
    dataset = BlurClassifierDataset(patches)
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=4, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=4, pin_memory=True)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = BlurClassifier().to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=20, gamma=0.5)
    
    best_acc = 0.0
    
    for epoch in range(args.epochs):
        model.train()
        train_loss = 0.0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * imgs.size(0)
            
        scheduler.step()
        train_loss /= len(train_loader.dataset)
        
        # Validation
        model.eval()
        val_loss = 0.0
        correct = 0
        all_preds = []
        all_labels = []
        
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                outputs = model(imgs)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * imgs.size(0)
                
                _, preds = torch.max(outputs, 1)
                correct += torch.sum(preds == labels.data).item()
                
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
                
        val_loss /= len(val_loader.dataset)
        val_acc = correct / len(val_loader.dataset)
        
        print(f"Epoch {epoch+1}/{args.epochs} - Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.4f}")
        wandb.log({"train_loss": train_loss, "val_loss": val_loss, "val_acc": val_acc})
        
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), out_dir / 'best_blur_classifier.pth')
            
    print("Training complete. Best accuracy:", best_acc)
    
    # Final evaluation
    model.load_state_dict(torch.load(out_dir / 'best_blur_classifier.pth'))
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs = imgs.to(device)
            outputs = model(imgs)
            _, preds = torch.max(outputs, 1)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    print("\nClassification Report:")
    print(classification_report(all_labels, all_preds, target_names=["SHARP", "DEFOCUS", "MOTION"]))
    print("Confusion Matrix:")
    print(confusion_matrix(all_labels, all_preds))
    wandb.finish()

if __name__ == '__main__':
    main()
