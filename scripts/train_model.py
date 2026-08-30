import os
import shutil
import torch
from pathlib import Path
from ultralytics import YOLO

# Project root directory setup
PROJECT_ROOT = Path(__file__).parent.parent
DATA_YAML = PROJECT_ROOT / "data" / "data.yaml"
MODELS_DIR = PROJECT_ROOT / "models"
RESULTS_DIR = PROJECT_ROOT / "results"

MODELS_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)


def train_ppe_model():
    """Fine-tune pre-trained YOLOv8n model on the custom PPE detection dataset."""
    
    # Check compute device — warn user if using CPU since training will be slow
    device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Using device: {device.upper()}")
    
    if device == "cpu":
        print("\n==========================================================================")
        print("⚠️ WARNING: CPU detected. Full training (50 epochs) could take hours!")
        print("Tip: Reduce epochs to 20 for a fast local test run, or use Google Colab free T4 GPU.")
        print("To train on Colab:")
        print("1. Zip your 'data/' folder and upload to Google Drive / Colab.")
        print("2. Run: !pip install ultralytics")
        print("3. Execute this training script on Colab with GPU accelerated runtime.")
        print("==========================================================================\n")

    # Load pre-trained nano weights — nano is lightweight and ideal for real-time inference on laptops
    model = YOLO("yolov8n.pt")

    # Training parameters
    # epochs=50: enough iterations for transfer learning to converge without overfitting
    # imgsz=640: standard YOLO input resolution providing balanced detection accuracy
    # batch=8: conservative batch size to prevent Out-Of-Memory (OOM) errors on consumer hardware
    # patience=10: early stopping trigger if validation mAP doesn't improve for 10 epochs
    epochs = 20 if device == "cpu" else 50
    print(f"Starting training for {epochs} epochs on dataset: {DATA_YAML}...")
    
    results = model.train(
        data=str(DATA_YAML),
        epochs=epochs,
        imgsz=640,
        batch=8,
        patience=10,
        project=str(PROJECT_ROOT / "runs"),
        name="ppe_detection",
        exist_ok=True,
    )

    # Path where YOLO saved the trained weights & plots
    save_dir = Path(results.save_dir)
    print(f"\nTraining outputs saved to: {save_dir}")

    # Copy best weights to models/best.pt for easy reference by the backend
    best_weights = save_dir / "weights" / "best.pt"
    target_weights = MODELS_DIR / "best.pt"
    if best_weights.exists():
        shutil.copy(best_weights, target_weights)
        print(f"✓ Saved best model weights to: {target_weights}")

    # Copy evaluation artifacts (confusion matrix, PR curve, val predictions) to results/
    artifact_files = [
        "confusion_matrix.png",
        "PR_curve.png",
        "F1_curve.png",
        "results.png",
        "val_batch0_labels.jpg",
        "val_batch0_pred.jpg",
    ]

    print("\nExporting evaluation artifacts to results/...")
    for item in artifact_files:
        src = save_dir / item
        if src.exists():
            shutil.copy(src, RESULTS_DIR / item)
            print(f"  - Copied {item} -> results/")

    # Run validation to obtain exact numeric metrics
    print("\n--- FINAL VALIDATION METRICS ---")
    val_results = model.val()
    
    metrics = val_results.results_dict
    precision = metrics.get("metrics/precision(B)", 0.0)
    recall = metrics.get("metrics/recall(B)", 0.0)
    map50 = metrics.get("metrics/mAP50(B)", 0.0)
    map50_95 = metrics.get("metrics/mAP50-95(B)", 0.0)

    print(f"Precision : {precision:.4f}")
    print(f"Recall    : {recall:.4f}")
    print(f"mAP50     : {map50:.4f}")
    print(f"mAP50-95  : {map50_95:.4f}")
    print("--------------------------------")


if __name__ == "__main__":
    train_ppe_model()
