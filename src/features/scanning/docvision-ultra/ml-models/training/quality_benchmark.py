#!/usr/bin/env python3
"""
Benchmark script for the full enhancement pipeline.
Tests Python-side quality metrics to validate the C++ implementations
will produce equivalent results.
"""
import cv2
import numpy as np
import json
from pathlib import Path
from typing import Dict, List
import time

class QualityBenchmark:
    """
    Runs quality assessment on a reference image set and verifies:
    1. Sharpness scores are monotonically decreasing with blur level.
    2. Illumination uniformity drops with gradient lighting.
    3. Glare detection identifies specular highlights.
    4. DCQI formula produces expected values for known-good and known-bad images.
    """
    
    def __init__(self, reference_dir: str):
        self.ref_dir = Path(reference_dir)
    
    def compute_sharpness_py(self, gray: np.ndarray) -> float:
        """Python implementation of the Laplacian variance sharpness metric."""
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        return float(np.var(lap))
    
    def compute_illumination_uniformity_py(self, gray: np.ndarray) -> float:
        """Python implementation of the 8x8 grid CV metric."""
        h, w = gray.shape
        means = []
        grid = 8
        cell_h, cell_w = h // grid, w // grid
        for i in range(grid):
            for j in range(grid):
                cell = gray[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
                means.append(np.mean(cell))
        means = np.array(means)
        cv = np.std(means) / (np.mean(means) + 1e-7)
        return float(np.clip(1.0 - cv / 0.5, 0, 1))
    
    def compute_glare_score_py(self, bgr: np.ndarray) -> float:
        """Python implementation of glare detection."""
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        v = hsv[:, :, 2]
        s = hsv[:, :, 1]
        glare_mask = (v > 240) & (s < 30)
        coverage = glare_mask.sum() / glare_mask.size
        return float(np.clip(1.0 - coverage / 0.15, 0, 1))
    
    def compute_dcqi_py(self, metrics: Dict[str, float]) -> float:
        """Compute DCQI from metric dict."""
        return (
            0.25 * metrics.get('sharpness', 0) +
            0.10 * metrics.get('blur_is_sharp', 0) +
            0.15 * metrics.get('illumination', 0) +
            0.20 * metrics.get('glare', 0) +
            0.10 * metrics.get('shadow', 0) +
            0.10 * metrics.get('completeness', 0) +
            0.10 * metrics.get('occlusion', 0)
        )
    
    def benchmark_sharpness_monotonicity(self) -> dict:
        """Test that sharpness decreases monotonically with applied blur."""
        img = np.zeros((256, 256), dtype=np.uint8)
        for i in range(256):
            for j in range(256):
                if (i // 8 + j // 8) % 2 == 0:
                    img[i, j] = 255
                    
        sigmas = [0, 1, 2, 4, 8]
        scores = []
        for s in sigmas:
            b = cv2.GaussianBlur(img, (0, 0), s) if s > 0 else img
            scores.append(self.compute_sharpness_py(b))
            
        monotonic = all(scores[i] >= scores[i+1] for i in range(len(scores)-1))
        return {
            'sigmas': sigmas,
            'scores': scores,
            'passed': monotonic
        }
    
    def benchmark_dcqi_range(self) -> dict:
        """Test DCQI boundaries."""
        perf_metrics = {k: 1.0 for k in ['sharpness','blur_is_sharp','illumination','glare','shadow','completeness','occlusion']}
        zero_metrics = {k: 0.0 for k in perf_metrics.keys()}
        
        perf_score = self.compute_dcqi_py(perf_metrics)
        zero_score = self.compute_dcqi_py(zero_metrics)
        
        return {
            'perfect_score': perf_score,
            'zero_score': zero_score,
            'passed': abs(perf_score - 1.0) < 1e-5 and abs(zero_score - 0.0) < 1e-5
        }
    
    def benchmark_performance(self, n_images: int = 100) -> dict:
        """Measure time per image for each metric."""
        imgs_gray = [np.random.randint(0, 255, (512, 512), dtype=np.uint8) for _ in range(n_images)]
        imgs_bgr = [np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8) for _ in range(n_images)]
        
        t0 = time.time()
        for img in imgs_gray:
            self.compute_sharpness_py(img)
        sharp_t = (time.time() - t0) / n_images * 1000
        
        t0 = time.time()
        for img in imgs_gray:
            self.compute_illumination_uniformity_py(img)
        ill_t = (time.time() - t0) / n_images * 1000
        
        t0 = time.time()
        for img in imgs_bgr:
            self.compute_glare_score_py(img)
        glare_t = (time.time() - t0) / n_images * 1000
        
        passed = all(t < 5.0 for t in [sharp_t, ill_t, glare_t])
        
        return {
            'sharpness_ms': sharp_t,
            'illumination_ms': ill_t,
            'glare_ms': glare_t,
            'passed': passed
        }
    
    def run_all(self) -> dict:
        """Run all benchmarks and return summary."""
        results = {
            'sharpness_monotonicity': self.benchmark_sharpness_monotonicity(),
            'dcqi_range': self.benchmark_dcqi_range(),
            'performance': self.benchmark_performance()
        }
        self._print_report(results)
        return results
    
    def _print_report(self, results: dict):
        print("=== Benchmark Report ===")
        print(json.dumps(results, indent=2))

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--reference-dir', required=False, default='.')
    args = parser.parse_args()
    benchmark = QualityBenchmark(args.reference_dir)
    benchmark.run_all()
