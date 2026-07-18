import torch
import onnx
import onnxruntime as ort
import numpy as np
from pathlib import Path
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'training'))
from corner_detection_model import DocumentCornerDetector, DocumentSegmentationModel, BlurClassifier

def export_model_to_onnx(model_class, checkpoint_path, output_path, input_shape):
    model = model_class()
    if os.path.exists(checkpoint_path):
        model.load_state_dict(torch.load(checkpoint_path, map_location='cpu'))
    model.eval()
    
    dummy_input = torch.randn(input_shape)
    
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=13,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    
    # Validate
    ort_session = ort.InferenceSession(output_path)
    test_input = np.random.randn(*input_shape).astype(np.float32)
    
    torch_out = model(torch.from_numpy(test_input)).detach().numpy()
    ort_inputs = {ort_session.get_inputs()[0].name: test_input}
    ort_out = ort_session.run(None, ort_inputs)[0]
    
    np.testing.assert_allclose(torch_out, ort_out, rtol=1e-03, atol=1e-04)
    print(f"Exported {output_path} successfully and validated.")

if __name__ == "__main__":
    out_dir = Path("exported_models")
    out_dir.mkdir(exist_ok=True)
    
    export_model_to_onnx(DocumentCornerDetector, "checkpoints/best_corner_model.pth", str(out_dir / "corner_detector.onnx"), (1, 3, 256, 256))
    export_model_to_onnx(DocumentSegmentationModel, "checkpoints/best_seg_model.pth", str(out_dir / "segmentation.onnx"), (1, 3, 256, 256))
    export_model_to_onnx(BlurClassifier, "checkpoints/best_blur_model.pth", str(out_dir / "blur_classifier.onnx"), (1, 3, 256, 256))
