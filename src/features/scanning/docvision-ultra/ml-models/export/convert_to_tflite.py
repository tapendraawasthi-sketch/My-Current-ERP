import tensorflow as tf
import onnx
from onnx_tf.backend import prepare
import numpy as np
import os
from pathlib import Path

def convert_onnx_to_tflite(onnx_path, tflite_path, quantize=True):
    onnx_model = onnx.load(onnx_path)
    tf_rep = prepare(onnx_model)
    
    tf_saved_model_dir = tflite_path + "_saved_model"
    tf_rep.export_graph(tf_saved_model_dir)
    
    converter = tf.lite.TFLiteConverter.from_saved_model(tf_saved_model_dir)
    
    if quantize:
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        def representative_data_gen():
            for _ in range(100):
                yield [np.random.rand(1, 3, 256, 256).astype(np.float32)]
        converter.representative_dataset = representative_data_gen
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        converter.inference_input_type = tf.uint8
        converter.inference_output_type = tf.uint8
        
    tflite_model = converter.convert()
    
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
    print(f"Converted {onnx_path} to {tflite_path}")
    
    # Validation
    interpreter = tf.lite.Interpreter(model_content=tflite_model)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    test_input = np.random.rand(1, 3, 256, 256).astype(np.float32)
    if quantize:
        test_input = (test_input * 255).astype(np.uint8)
        
    interpreter.set_tensor(input_details[0]['index'], test_input)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]['index'])
    print(f"Validation successful. Output shape: {output.shape}")

if __name__ == "__main__":
    # Ensure export paths exist
    Path("exported_models").mkdir(exist_ok=True)
    convert_onnx_to_tflite("exported_models/corner_detector.onnx", "exported_models/corner_detector_int8.tflite", quantize=True)
    convert_onnx_to_tflite("exported_models/corner_detector.onnx", "exported_models/corner_detector_fp32.tflite", quantize=False)
