import coremltools as ct
import onnx
import numpy as np

def convert_onnx_to_coreml(onnx_path, coreml_path):
    model = onnx.load(onnx_path)
    
    # Convert using coremltools
    mlmodel = ct.convert(
        model,
        source='onnx',
        compute_precision=ct.precision.FLOAT16,
        inputs=[ct.TensorType(name="input", shape=(1, 3, 256, 256))]
    )
    
    mlmodel.save(coreml_path)
    print(f"Converted {onnx_path} to {coreml_path}")
    
    # Note: validation usually requires macOS to run prediction.

if __name__ == "__main__":
    convert_onnx_to_coreml("exported_models/corner_detector.onnx", "exported_models/corner_detector.mlpackage")
