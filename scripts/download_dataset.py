import os
import glob
import yaml
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from backend/.env or .env if present
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")
load_dotenv()

"""
ROBOFLOW API KEY INSTRUCTIONS:
1. Sign up / Log in at https://roboflow.com (Free account)
2. Go to your Account Settings -> Workspace API Key
3. Copy your API key and add it to your .env file:
   ROBOFLOW_API_KEY=your_api_key_here
"""

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")

DATA_DIR = Path(__file__).parent.parent / "data"

def download_dataset():
    if not ROBOFLOW_API_KEY:
        print("------------------------------------------------------------------")
        print("WARNING: ROBOFLOW_API_KEY environment variable not found.")
        print("To download the dataset automatically via Roboflow API:")
        print("1. Get a free API key from https://app.roboflow.com/")
        print("2. Add ROBOFLOW_API_KEY=your_key to backend/.env")
        print("------------------------------------------------------------------")
        # Creating dataset structure placeholder if API key is not present yet
        print("Attempting download using roboflow package (or public download link)...")
    
    try:
        from roboflow import Roboflow
        rf = Roboflow(api_key=ROBOFLOW_API_KEY if ROBOFLOW_API_KEY else "PUBLIC_KEY")
        # PPE / Construction Site Safety Dataset
        project = rf.workspace("roboflow-universe-projects").project("construction-site-safety")
        dataset = project.version(1).download("yolov8", location=str(DATA_DIR))
        print(f"Dataset successfully downloaded to: {DATA_DIR}")
    except Exception as e:
        print(f"Download failed or API key missing/invalid: {e}")
        print("Falling back to dataset verification step...")

def inspect_dataset():
    yaml_path = DATA_DIR / "data.yaml"
    if not yaml_path.exists():
        # Check subdirectories if roboflow created nested folder
        yaml_files = list(DATA_DIR.rglob("data.yaml"))
        if yaml_files:
            yaml_path = yaml_files[0]
            print(f"Found data.yaml at {yaml_path}")
        else:
            print(f"data.yaml not found in {DATA_DIR}. Please ensure dataset is downloaded.")
            return

    with open(yaml_path, 'r') as f:
        data_config = yaml.safe_load(f)

    print("\n--- DATASET CONFIG (data.yaml) ---")
    print(yaml.dump(data_config, default_flow_style=False))

    base_dir = yaml_path.parent
    for split in ['train', 'valid', 'test']:
        img_dir = base_dir / split / "images"
        if not img_dir.exists():
            img_dir = base_dir / split
        
        if img_dir.exists():
            # Count images (.jpg, .jpeg, .png)
            images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png")) + list(img_dir.glob("*.jpeg"))
            print(f"Split [{split}]: {len(images)} images found in {img_dir}")
        else:
            print(f"Split [{split}]: Directory not found.")

if __name__ == "__main__":
    download_dataset()
    inspect_dataset()
