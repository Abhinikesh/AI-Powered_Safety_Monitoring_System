import os
import glob
import yaml
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from backend/.env or .env if present
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / "backend" / ".env")
load_dotenv(PROJECT_ROOT / ".env")

"""
ROBOFLOW API KEY INSTRUCTIONS:
1. Sign up for a free account at https://roboflow.com
2. Go to your Account Settings -> Roboflow Keys (Workspace API Key)
3. Copy your API key and add it to your backend/.env file:
   ROBOFLOW_API_KEY=your_api_key_here
"""

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
DATA_DIR = PROJECT_ROOT / "data"


def download_dataset():
    """Downloads the Construction Site Safety dataset from Roboflow Universe in YOLOv8 format."""
    print("=" * 70)
    print("📥 ROBOFLOW UNIVERSE DATASET DOWNLOADER")
    print("   Dataset: Construction Site Safety")
    print("   Workspace: roboflow-universe-projects")
    print("   Project: construction-site-safety")
    print("=" * 70)

    if not ROBOFLOW_API_KEY or ROBOFLOW_API_KEY == "your_roboflow_api_key_here":
        print("\n⚠️  NOTICE: ROBOFLOW_API_KEY environment variable not found or using default.")
        print("To download the full 2,800+ image dataset automatically from Roboflow Universe:")
        print("  1. Get your free API key at: https://app.roboflow.com/ (Account > Roboflow Keys)")
        print("  2. Add it to backend/.env: ROBOFLOW_API_KEY=your_key")
        print("  3. Re-run this script: python scripts/download_dataset.py\n")
        return

    try:
        from roboflow import Roboflow
        print(f"Connecting to Roboflow Universe using API Key...")
        rf = Roboflow(api_key=ROBOFLOW_API_KEY)
        project = rf.workspace("roboflow-universe-projects").project("construction-site-safety")
        print("Downloading Construction Site Safety dataset (YOLOv8 format)...")
        dataset = project.version(1).download("yolov8", location=str(DATA_DIR))
        print(f"\n✓ Dataset successfully downloaded to: {DATA_DIR}")
    except Exception as e:
        print(f"\n❌ Roboflow download encountered an issue: {e}")
        print("Please verify your ROBOFLOW_API_KEY in backend/.env.")


def inspect_dataset():
    """Inspects data.yaml and prints out the exact class list and image counts per split."""
    yaml_path = DATA_DIR / "data.yaml"
    if not yaml_path.exists():
        yaml_files = list(DATA_DIR.rglob("data.yaml"))
        if yaml_files:
            yaml_path = yaml_files[0]
        else:
            print(f"\n⚠️  data.yaml not found in {DATA_DIR}.")
            return

    with open(yaml_path, 'r') as f:
        data_config = yaml.safe_load(f)

    classes = data_config.get("names", [])
    num_classes = data_config.get("nc", len(classes))

    print("\n" + "=" * 70)
    print("📊 DATASET CONFIGURATION & CLASS BREAKDOWN")
    print("=" * 70)
    print(f"Total Classes ({num_classes}):")
    for idx, name in enumerate(classes):
        role = "Violations / Non-compliance" if name.startswith("NO-") else ("Compliant PPE" if "Vest" in name or "Hardhat" in name or "Helmet" in name or "Mask" in name else "Object / Equipment")
        print(f"  [{idx:2d}] {name:<16} → {role}")

    print("\n--- Image Counts per Split ---")
    base_dir = yaml_path.parent
    total_images = 0
    for split in ['train', 'valid', 'test']:
        img_dir = base_dir / split / "images"
        if not img_dir.exists():
            img_dir = base_dir / split
        
        if img_dir.exists():
            images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png")) + list(img_dir.glob("*.jpeg"))
            count = len(images)
            total_images += count
            print(f"  Split [{split:<5}]: {count:>5} images")
        else:
            print(f"  Split [{split:<5}]: Directory not found")

    print(f"  Total Images    : {total_images:>5} images")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    download_dataset()
    inspect_dataset()
