import json
import xml.etree.ElementTree as ET
from pathlib import Path

def prepare_smartdoc(data_dir: str, output_path: str):
    data_dir = Path(data_dir)
    annotations = []
    
    # Assuming standard SmartDoc XML structure
    for xml_file in data_dir.glob("*.xml"):
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        for frame in root.findall('.//frame'):
            img_path = frame.get('file')
            points = []
            for pt in frame.findall('.//point'):
                points.append([float(pt.get('x')), float(pt.get('y'))])
                
            # Normalize points if needed
            annotations.append({
                "image_path": img_path,
                "corners": points
            })
            
    with open(output_path, 'w') as f:
        json.dump(annotations, f, indent=2)
        
if __name__ == "__main__":
    # Placeholder paths
    prepare_smartdoc("raw_data/smartdoc", "processed_data/smartdoc_annotations.json")
