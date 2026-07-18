import json
from pathlib import Path
import os

def prepare_midv(data_dir: str, output_path: str):
    data_dir = Path(data_dir)
    annotations = []
    
    # Simple placeholder logic for MIDV dataset JSON annotations
    for json_file in data_dir.glob("**/*.json"):
        with open(json_file, 'r') as f:
            data = json.load(f)
            
        img_path = str(json_file).replace('.json', '.tif') # Often MIDV pairs JSON with TIF
        if 'quad' in data:
            annotations.append({
                "image_path": img_path,
                "corners": data['quad']
            })
            
    with open(output_path, 'w') as f:
        json.dump(annotations, f, indent=2)
        
if __name__ == "__main__":
    prepare_midv("raw_data/midv", "processed_data/midv_annotations.json")
