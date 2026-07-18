import cv2
import numpy as np
import random
from pathlib import Path
from dataclasses import dataclass
from typing import Tuple, List
import json
from tqdm import tqdm
import os

@dataclass
class SyntheticSample:
    image: np.ndarray          # H x W x 3, BGR
    corners: List[Tuple[float, float]]  # 4 corners normalized [0,1], TL TR BR BL order

class SyntheticDocumentGenerator:
    def __init__(
        self,
        document_dir: str,
        background_dir: str,
        output_dir: str,
        target_size: Tuple[int, int] = (640, 640)
    ):
        self.doc_paths = list(Path(document_dir).glob('*.*'))
        self.bg_paths = list(Path(background_dir).glob('*.*'))
        self.output_dir = Path(output_dir)
        self.target_size = target_size
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate(self, n_samples: int) -> None:
        annotations = []
        for i in tqdm(range(n_samples), desc="Generating synthetic data"):
            sample = self._generate_one()
            if sample is None: continue
            
            img_name = f"sample_{i:06d}.jpg"
            out_path = self.output_dir / img_name
            cv2.imwrite(str(out_path), sample.image)
            
            annotations.append({
                "image_path": img_name,
                "corners": sample.corners
            })
            
        with open(self.output_dir / 'annotations.json', 'w') as f:
            json.dump(annotations, f, indent=2)
            
    def _generate_one(self) -> SyntheticSample:
        doc_path = random.choice(self.doc_paths)
        bg_path = random.choice(self.bg_paths)
        
        doc = cv2.imread(str(doc_path))
        bg = cv2.imread(str(bg_path))
        
        if doc is None or bg is None: return None
        
        h, w = self.target_size
        bg = cv2.resize(bg, (w, h))
        
        offsets = self._generate_corner_offsets(doc.shape[1], doc.shape[0])
        src_pts = np.float32([[0,0], [doc.shape[1]-1, 0], [doc.shape[1]-1, doc.shape[0]-1], [0, doc.shape[0]-1]])
        dst_pts = src_pts + offsets
        
        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped_doc = cv2.warpPerspective(doc, M, (doc.shape[1]*2, doc.shape[0]*2))
        
        comp_img, final_corners = self._composite_on_background(warped_doc, bg, dst_pts)
        comp_img = self._add_lighting_gradient(comp_img)
        if random.random() < 0.5:
            comp_img = self._add_shadow(comp_img)
            
        # Add noise
        noise = np.random.normal(0, random.uniform(5, 20), comp_img.shape).astype(np.float32)
        comp_img = np.clip(comp_img.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        
        # JPEG compress
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), random.randint(70, 95)]
        result, encimg = cv2.imencode('.jpg', comp_img, encode_param)
        comp_img = cv2.imdecode(encimg, 1)
        
        norm_corners = [(float(c[0])/w, float(c[1])/h) for c in final_corners]
        return SyntheticSample(comp_img, norm_corners)
        
    def _add_lighting_gradient(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        gradient = np.linspace(random.uniform(0.5, 1.0), random.uniform(1.0, 1.5), w, dtype=np.float32)
        gradient = np.tile(gradient, (h, 1))
        if random.random() < 0.5:
            gradient = gradient.T
        gradient = cv2.resize(gradient, (w, h))
        img = (img * gradient[:,:,np.newaxis]).clip(0, 255).astype(np.uint8)
        return img
        
    def _add_shadow(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        pts = np.array([
            [random.randint(0, w), random.randint(0, h)] for _ in range(3)
        ], np.int32)
        pts = pts.reshape((-1, 1, 2))
        overlay = img.copy()
        cv2.fillPoly(overlay, [pts], (0, 0, 0))
        return cv2.addWeighted(overlay, 0.4, img, 0.6, 0)
        
    def _composite_on_background(self, doc: np.ndarray, bg: np.ndarray, corners: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        h, w = bg.shape[:2]
        scale = random.uniform(0.5, 0.8)
        
        # Simple centering for now
        doc_resized = cv2.resize(doc, (int(w*scale), int(h*scale)))
        # Adjust corners according to scale
        new_corners = corners * scale
        
        start_y = (h - doc_resized.shape[0]) // 2
        start_x = (w - doc_resized.shape[1]) // 2
        
        mask = (doc_resized.sum(axis=2) > 0).astype(np.uint8)
        mask = np.repeat(mask[:, :, np.newaxis], 3, axis=2)
        
        bg[start_y:start_y+doc_resized.shape[0], start_x:start_x+doc_resized.shape[1]] = \
            np.where(mask, doc_resized, bg[start_y:start_y+doc_resized.shape[0], start_x:start_x+doc_resized.shape[1]])
            
        final_corners = new_corners + np.array([start_x, start_y])
        return bg, final_corners
        
    def _generate_corner_offsets(self, w: int, h: int) -> np.ndarray:
        max_offset_x = w * 0.3
        max_offset_y = h * 0.3
        return np.array([
            [random.uniform(-max_offset_x, max_offset_x), random.uniform(-max_offset_y, max_offset_y)]
            for _ in range(4)
        ], dtype=np.float32)
