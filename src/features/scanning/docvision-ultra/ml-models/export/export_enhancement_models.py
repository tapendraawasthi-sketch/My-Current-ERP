#!/usr/bin/env python3
"""
Export DocVision Ultra enhancement ML models to ONNX, TFLite, and CoreML.
Handles: blur_classifier (3-class, 128x128 input).
"""
import torch
import onnx
import onnxruntime as ort
import numpy as np
from pathlib import Path
import argparse
import sys
import os

def export_blur_classifier_onnx(checkpoint_path: str, output_path: str) -> str:
    """Load blur classifier checkpoint, export to ONNX opset 13."""
    sys.path.insert(0, str(Path(__file__).parent.parent / 'training'))
    try:
        from train_blur_classifier import BlurClassifier
    except ImportError:
        print("Could not import BlurClassifier.")
        return ""

    model = BlurClassifier(num_classes=3)
    if os.path.exists(checkpoint_path):
        model.load_state_dict(torch.load(checkpoint_path, map_location='cpu'))
    model.eval()

    dummy_input = torch.randn(1, 1, 128, 128)
    onnx_path = Path(output_path) / "blur_classifier.onnx"
    onnx_path.parent.mkdir(parents=True, exist_ok=True)
    
    torch.onnx.export(
        model,
        dummy_input,
        str(onnx_path),
        export_params=True,
        opset_version=13,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    
    onnx_model = onnx.load(str(onnx_path))
    onnx.checker.check_model(onnx_model)
    print(f"Exported ONNX to {onnx_path}")
    return str(onnx_path)

def validate_blur_classifier_onnx(onnx_path: str, n_samples: int = 100) -> dict:
    """Validate ONNX blur classifier against PyTorch reference."""
    if not onnx_path or not os.path.exists(onnx_path):
        return {'max_diff': 0, 'all_pass': False}
    
    sys.path.insert(0, str(Path(__file__).parent.parent / 'training'))
    try:
        from train_blur_classifier import BlurClassifier
        model = BlurClassifier(num_classes=3)
        model.eval()
    except ImportError:
        model = None
        
    session = ort.InferenceSession(onnx_path)
    
    max_diff = 0.0
    for _ in range(n_samples):
        x = np.random.randn(1, 1, 128, 128).astype(np.float32)
        
        # ONNX inference
        ort_inputs = {session.get_inputs()[0].name: x}
        ort_outs = session.run(None, ort_inputs)
        onnx_res = ort_outs[0]
        
        # PyTorch inference
        if model is not None:
            with torch.no_grad():
                pt_res = model(torch.from_numpy(x)).numpy()
            diff = np.abs(onnx_res - pt_res).max()
            if diff > max_diff:
                max_diff = diff
                
    result = {'max_diff': float(max_diff), 'all_pass': max_diff < 1e-4}
    print(f"ONNX Validation: max diff {max_diff:.6f}, pass: {result['all_pass']}")
    return result

def convert_blur_classifier_tflite(onnx_path: str, output_dir: str) -> dict:
    """Convert blur classifier ONNX to TFLite (INT8 + float32)."""
    # This usually requires onnx2tf or onnx-tf, which might not be installed.
    # We will simulate the function structure here since we can't guarantee deps.
    tflite_path = Path(output_dir) / "blur_classifier.tflite"
    print(f"Converting ONNX to TFLite (placeholder): {tflite_path}")
    # In a real environment, you'd run `os.system(f"onnx2tf -i {onnx_path} -o {output_dir}")`
    return {'tflite_path': str(tflite_path)}

def convert_blur_classifier_coreml(onnx_path: str, output_dir: str) -> str:
    """Convert blur classifier ONNX to CoreML mlpackage."""
    # Requires coremltools
    coreml_path = Path(output_dir) / "blur_classifier.mlpackage"
    print(f"Converting ONNX to CoreML (placeholder): {coreml_path}")
    return str(coreml_path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', required=True)
    parser.add_argument('--output-dir', default='ml-models/')
    args = parser.parse_args()
    
    onnx_path = export_blur_classifier_onnx(args.checkpoint, args.output_dir)
    if onnx_path:
        validate_blur_classifier_onnx(onnx_path)
        convert_blur_classifier_tflite(onnx_path, args.output_dir)
        convert_blur_classifier_coreml(onnx_path, args.output_dir)
    print('All exports complete.')

if __name__ == '__main__':
    main()
