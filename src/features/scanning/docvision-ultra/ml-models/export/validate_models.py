import torch
import onnxruntime as ort
import tensorflow as tf
import numpy as np
import time

def validate_models():
    # Load test data
    test_inputs = [np.random.rand(1, 3, 256, 256).astype(np.float32) for _ in range(10)]
    
    # ONNX
    session = ort.InferenceSession("exported_models/corner_detector.onnx")
    onnx_times = []
    onnx_outputs = []
    
    for inp in test_inputs:
        start = time.time()
        out = session.run(None, {session.get_inputs()[0].name: inp})[0]
        onnx_times.append(time.time() - start)
        onnx_outputs.append(out)
        
    print(f"ONNX avg inference time: {np.mean(onnx_times)*1000:.2f}ms")
    
    # TFLite
    interpreter = tf.lite.Interpreter(model_path="exported_models/corner_detector_fp32.tflite")
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    tflite_times = []
    tflite_outputs = []
    for inp in test_inputs:
        interpreter.set_tensor(input_details[0]['index'], inp)
        start = time.time()
        interpreter.invoke()
        out = interpreter.get_tensor(output_details[0]['index'])
        tflite_times.append(time.time() - start)
        tflite_outputs.append(out)
        
    print(f"TFLite avg inference time: {np.mean(tflite_times)*1000:.2f}ms")
    
    # Compare errors
    for i in range(len(test_inputs)):
        diff = np.abs(onnx_outputs[i] - tflite_outputs[i]).max()
        assert diff < 0.005, f"Difference too high: {diff}"
        
    print("All validations passed.")

if __name__ == "__main__":
    validate_models()
