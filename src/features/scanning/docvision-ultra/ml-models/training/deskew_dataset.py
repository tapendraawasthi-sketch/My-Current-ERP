"""
Dataset for deskew angle regression model training.
Each sample: a document image rotated by a known angle.
Label: the angle in degrees (continuous value, range [-15, 15]).
"""
import cv2
import numpy as np
from torch.utils.data import Dataset
import torch
from pathlib import Path
import random
import math

class DeskewDataset(Dataset):
    """
    Generates synthetic skewed document images for training
    a deskew angle regression model.
    """
    
    def __init__(
        self,
        document_dir: str,
        n_samples: int = 50000,
        max_angle: float = 15.0,
        img_size: int = 256
    ):
        self.doc_paths = list(Path(document_dir).glob('**/*.*'))
        self.doc_paths = [p for p in self.doc_paths if p.suffix.lower() in ('.png', '.jpg', '.jpeg')]
        self.n_samples = n_samples
        self.max_angle = max_angle
        self.img_size = img_size

    def __len__(self): 
        return self.n_samples
    
    def __getitem__(self, idx): 
        path = random.choice(self.doc_paths)
        img = self._load_and_binarize(str(path))
        
        # Crop/Resize to img_size to have consistent base
        h, w = img.shape
        if h > self.img_size and w > self.img_size:
            y = random.randint(0, h - self.img_size)
            x = random.randint(0, w - self.img_size)
            img = img[y:y+self.img_size, x:x+self.img_size]
        else:
            img = cv2.resize(img, (self.img_size, self.img_size))
            
        angle = random.uniform(-self.max_angle, self.max_angle)
        rotated = self._apply_rotation(img, angle)
        
        # Convert to tensor
        tensor = torch.from_numpy(rotated).float().unsqueeze(0) / 255.0
        label = torch.tensor([angle], dtype=torch.float32)
        return tensor, label
    
    def _load_and_binarize(self, path: str) -> np.ndarray: 
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            img = np.zeros((self.img_size, self.img_size), dtype=np.uint8)
        _, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return thresh

    def _apply_rotation(self, img: np.ndarray, angle: float) -> np.ndarray: 
        h, w = img.shape
        center = (w / 2, h / 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        return rotated
