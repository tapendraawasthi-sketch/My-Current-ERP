import cv2
import numpy as np
from pathlib import Path
from torch.utils.data import Dataset
from typing import Tuple, List
import torchvision.transforms as transforms
import random
import math

class BlurType:
    SHARP = 0
    DEFOCUS = 1
    MOTION = 2

def apply_defocus_blur(image: np.ndarray, sigma: float) -> np.ndarray:
    """
    Apply defocus (Gaussian) blur to simulate out-of-focus capture.
    sigma: standard deviation in pixels (1.0 = slight, 8.0 = severe)
    """
    if sigma <= 0:
        return image
    kernel_size = 2 * math.ceil(3 * sigma) + 1
    return cv2.GaussianBlur(image, (kernel_size, kernel_size), sigmaX=sigma, sigmaY=sigma)

def apply_motion_blur(image: np.ndarray, length: int, angle: float) -> np.ndarray:
    """
    Apply motion blur to simulate camera shake during exposure.
    length: blur length in pixels (5-30)
    angle: blur direction in degrees (0 = horizontal, 90 = vertical)
    """
    if length <= 1:
        return image
    kernel = np.zeros((length, length), dtype=np.float32)
    kernel[length // 2, :] = 1.0
    kernel /= kernel.sum()

    M = cv2.getRotationMatrix2D((length / 2 - 0.5, length / 2 - 0.5), angle, 1.0)
    rotated_kernel = cv2.warpAffine(kernel, M, (length, length), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    if rotated_kernel.sum() > 0:
        rotated_kernel /= rotated_kernel.sum()
    
    return cv2.filter2D(image, -1, rotated_kernel)

class BlurClassifierDataset(Dataset):
    """
    PyTorch dataset for blur type classification.
    """
    
    def __init__(
        self,
        document_patches: list,
        n_samples_per_class: int = 10000,
        transform=None
    ):
        self.patches = document_patches
        self.n = n_samples_per_class
        self.transform = transform or transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5], std=[0.5])
        ])
        self.samples = self._generate_sample_list()
    
    def _generate_sample_list(self):
        samples = []
        n_patches = len(self.patches)
        if n_patches == 0:
            return samples
        
        for _ in range(self.n):
            # SHARP
            patch_idx = random.randint(0, n_patches - 1)
            samples.append((patch_idx, BlurType.SHARP, {}))
            
            # DEFOCUS
            patch_idx = random.randint(0, n_patches - 1)
            sigma = random.uniform(2.0, 10.0)
            samples.append((patch_idx, BlurType.DEFOCUS, {'sigma': sigma}))
            
            # MOTION
            patch_idx = random.randint(0, n_patches - 1)
            length = random.randint(10, 50)
            angle = random.uniform(0.0, 360.0)
            samples.append((patch_idx, BlurType.MOTION, {'length': length, 'angle': angle}))
        
        random.shuffle(samples)
        return samples
    
    def __len__(self): 
        return len(self.samples)
    
    def __getitem__(self, idx):
        patch_idx, blur_type, params = self.samples[idx]
        img = self.patches[patch_idx].copy()
        
        if blur_type == BlurType.DEFOCUS:
            img = apply_defocus_blur(img, params['sigma'])
        elif blur_type == BlurType.MOTION:
            img = apply_motion_blur(img, params['length'], params['angle'])
        
        if self.transform:
            img = self.transform(img)
            
        return img, blur_type

def extract_patches_from_documents(
    document_dir: str,
    patch_size: int = 128,
    patches_per_image: int = 20,
    min_text_coverage: float = 0.1
) -> list:
    """
    Extract random patches from document images.
    """
    patches = []
    doc_paths = list(Path(document_dir).glob('**/*.*'))
    doc_paths = [p for p in doc_paths if p.suffix.lower() in ('.png', '.jpg', '.jpeg')]
    
    for path in doc_paths:
        img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
            
        h, w = img.shape
        if h < patch_size or w < patch_size:
            continue
            
        # Threshold to find text (dark pixels)
        _, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        extracted = 0
        attempts = 0
        while extracted < patches_per_image and attempts < patches_per_image * 5:
            attempts += 1
            y = random.randint(0, h - patch_size)
            x = random.randint(0, w - patch_size)
            patch = img[y:y+patch_size, x:x+patch_size]
            thresh_patch = thresh[y:y+patch_size, x:x+patch_size]
            
            coverage = np.count_nonzero(thresh_patch) / (patch_size * patch_size)
            if coverage >= min_text_coverage:
                patches.append(patch)
                extracted += 1
                
    return patches
