import albumentations as A
import numpy as np
from albumentations.pytorch import ToTensorV2

def get_train_transforms():
    return A.Compose([
        A.Perspective(scale=(0.05, 0.15), keep_size=True, p=0.8),
        A.RandomResizedCrop(height=256, width=256, scale=(0.7, 1.0), p=1.0),
        A.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1, p=0.7),
        A.GaussianBlur(blur_limit=(3, 7), p=0.5),
        A.MotionBlur(blur_limit=(5, 15), p=0.4),
        A.ImageCompression(quality_lower=40, quality_upper=95, p=0.5),
        A.CoarseDropout(max_holes=3, max_height=40, max_width=40, fill_value=0, p=0.5),
        A.GaussNoise(var_limit=(10.0, 50.0), p=0.4),
        A.RandomShadow(p=0.3),
        A.RandomBrightnessContrast(p=0.5),
        A.GridDropout(ratio=0.1, p=0.05),
        A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ToTensorV2(),
    ], keypoint_params=A.KeypointParams(format='xy', remove_invisible=False))

def get_val_transforms():
    return A.Compose([
        A.Resize(height=256, width=256),
        A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ToTensorV2(),
    ], keypoint_params=A.KeypointParams(format='xy', remove_invisible=False))

class KeypointAwareTransform:
    def __init__(self, transform):
        self.transform = transform
        
    def __call__(self, image: np.ndarray, keypoints: np.ndarray):
        # keypoints: (4, 2)
        transformed = self.transform(image=image, keypoints=keypoints)
        return transformed['image'], np.array(transformed['keypoints'])
