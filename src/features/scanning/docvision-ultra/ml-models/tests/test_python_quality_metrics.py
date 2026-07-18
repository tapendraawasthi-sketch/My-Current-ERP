import pytest
import cv2
import numpy as np
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'training'))
from quality_benchmark import QualityBenchmark

benchmark = QualityBenchmark(reference_dir='.')

def create_sharp_document(size=256):
    """Checkerboard = high sharpness."""
    img = np.zeros((size, size), dtype=np.uint8)
    for i in range(size):
        for j in range(size):
            if (i // 8 + j // 8) % 2 == 0:
                img[i, j] = 255
    return img

def create_blurred_document(sigma=5):
    sharp = create_sharp_document()
    return cv2.GaussianBlur(sharp, (0, 0), sigma)

def test_sharpness_sharp_image_high():
    img = create_sharp_document()
    score = benchmark.compute_sharpness_py(img)
    assert score > 500, f"Sharp image sharpness too low: {score}"

def test_sharpness_blurred_image_low():
    img = create_blurred_document(sigma=5)
    score = benchmark.compute_sharpness_py(img)
    assert score < 100, f"Blurred image sharpness too high: {score}"

def test_sharpness_monotone_with_blur():
    scores = [benchmark.compute_sharpness_py(create_blurred_document(s)) for s in [0, 1, 2, 4, 8]]
    for i in range(len(scores)-1):
        assert scores[i] >= scores[i+1], f"Sharpness not monotone: {scores}"

def test_illumination_uniform_is_high():
    img = np.ones((256, 256), dtype=np.uint8) * 180
    score = benchmark.compute_illumination_uniformity_py(img)
    assert score > 0.95

def test_illumination_gradient_is_low():
    img = np.tile(np.linspace(0, 255, 256).astype(np.uint8), (256, 1))
    score = benchmark.compute_illumination_uniformity_py(img)
    assert score < 0.5

def test_glare_white_image_no_glare():
    bgr = np.ones((256, 256, 3), dtype=np.uint8) * 180
    score = benchmark.compute_glare_score_py(bgr)
    assert score > 0.95

def test_glare_specular_highlight_detected():
    bgr = np.zeros((256, 256, 3), dtype=np.uint8)
    # Add a specular patch: high V, low S
    bgr[64:128, 64:128] = [250, 250, 255]  # nearly white
    score = benchmark.compute_glare_score_py(bgr)
    assert score < 0.9

def test_dcqi_perfect_document():
    metrics = {k: 1.0 for k in ['sharpness','blur_is_sharp','illumination','glare','shadow','completeness','occlusion']}
    dcqi = benchmark.compute_dcqi_py(metrics)
    assert abs(dcqi - 1.0) < 0.001

def test_dcqi_zero_document():
    metrics = {k: 0.0 for k in ['sharpness','blur_is_sharp','illumination','glare','shadow','completeness','occlusion']}
    dcqi = benchmark.compute_dcqi_py(metrics)
    assert abs(dcqi - 0.0) < 0.001

def test_dcqi_partial_metrics():
    metrics = {'sharpness': 0.5, 'glare': 0.5, 'illumination': 0.5}
    dcqi = benchmark.compute_dcqi_py(metrics)
    expected = 0.25 * 0.5 + 0.20 * 0.5 + 0.15 * 0.5
    assert abs(dcqi - expected) < 0.001

def test_illumination_uniformity_black_image():
    img = np.zeros((256, 256), dtype=np.uint8)
    score = benchmark.compute_illumination_uniformity_py(img)
    # Mean will be 0, CV will be 0 (due to +1e-7), score should be close to 1.0
    assert score > 0.95

def test_glare_red_image_no_glare():
    bgr = np.zeros((256, 256, 3), dtype=np.uint8)
    bgr[:, :, 2] = 255  # Red channel fully maxed
    score = benchmark.compute_glare_score_py(bgr)
    assert score > 0.95
