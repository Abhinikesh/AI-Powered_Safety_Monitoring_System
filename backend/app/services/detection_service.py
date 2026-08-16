import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

# Fix: backend/app/services/ -> .parent.parent.parent = backend/ -> .parent = project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MODEL_PATH = PROJECT_ROOT / "models" / "best.pt"
FALLBACK_MODEL = "yolov8n.pt"

# Default confidence threshold — can be overridden per request from the frontend slider
CONFIDENCE_THRESHOLD = 0.5

_model = None


def get_model():
    """Load the YOLO model once into memory on server startup, then reuse it for every request."""
    global _model
    if _model is None:
        path_to_load = MODEL_PATH if MODEL_PATH.exists() else FALLBACK_MODEL
        print(f"Loading YOLO model from: {path_to_load}")
        _model = YOLO(str(path_to_load))
    return _model


def detect_ppe(image_bytes: bytes) -> tuple:
    """Run object detection on raw JPEG/PNG bytes uploaded from the frontend.

    Returns:
        detections (list): Each item has class_name, confidence, box [x1, y1, x2, y2]
        img (ndarray): Decoded BGR image for saving snapshots
        width (int): Frame pixel width
        height (int): Frame pixel height
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return [], None, 0, 0

    height, width = img.shape[:2]
    model = get_model()

    results = model(img, verbose=False)[0]

    detections = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        class_name = model.names.get(cls_id, str(cls_id))
        conf = float(box.conf[0])
        coords = [round(float(c), 2) for c in box.xyxy[0].tolist()]

        detections.append({
            "class_name": class_name,
            "confidence": round(conf, 4),
            "box": coords  # [x1, y1, x2, y2]
        })

    return detections, img, width, height


def is_inside_zone(box: list, zone_points: list) -> bool:
    """Check whether the center of a bounding box lies inside a polygon using Ray Casting.

    Args:
        box: [x1, y1, x2, y2] bounding box coordinates
        zone_points: list of [x, y] polygon vertices (minimum 3 points required)

    Returns:
        True if center point is inside the polygon, False otherwise
    """
    if not zone_points or len(zone_points) < 3:
        return False

    x1, y1, x2, y2 = box
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0

    # Ray Casting algorithm: cast a horizontal ray from (cx, cy) rightward,
    # count how many polygon edges it crosses — odd count means inside.
    inside = False
    n = len(zone_points)

    for i in range(n):
        p1x, p1y = zone_points[i]
        p2x, p2y = zone_points[(i + 1) % n]

        # Check if ray from (cx, cy) going right crosses segment p1->p2
        if ((p1y > cy) != (p2y > cy)) and (cx < (p2x - p1x) * (cy - p1y) / (p2y - p1y) + p1x):
            inside = not inside

    return inside


def check_violations(
    detections: list,
    threshold: float = CONFIDENCE_THRESHOLD,
    zone_points: list = None
) -> list:
    """Filter the raw detections list to identify PPE violations and restricted zone entries.

    Violation logic:
    - Any class whose name starts with 'no-' or 'NO-' is treated as a PPE violation if its
      confidence meets or exceeds the threshold.
    - If zone_points is provided and a 'person' detection's center falls inside the zone,
      a 'restricted-zone-entry' violation is appended.

    Args:
        detections: Raw list from detect_ppe()
        threshold: Minimum confidence to flag a detection as a violation
        zone_points: Optional list of [x, y] polygon points defining the restricted area

    Returns:
        List of violation dicts, each including class_name, confidence, and box
    """
    violations = []

    # Canonical PPE violation class names — covers both custom-trained and base model classes
    violation_class_set = {
        "no-helmet", "no-vest", "no-mask",
        "NO-Hardhat", "NO-Safety Vest", "NO-Mask",
        "NO-Gloves", "NO-Goggles",
    }

    for det in detections:
        cname = det["class_name"]
        conf = det["confidence"]
        box = det["box"]

        # 1. PPE compliance check — match by set membership OR prefix convention
        is_ppe_violation = (
            cname in violation_class_set
            or cname.lower().startswith("no-")
        )
        if is_ppe_violation and conf >= threshold:
            violations.append(det)

        # 2. Restricted zone entry check — applies to any detected person
        if zone_points and cname.lower() in ("person", "worker", "human"):
            if is_inside_zone(box, zone_points):
                zone_viol = dict(det)
                zone_viol["class_name"] = "restricted-zone-entry"
                violations.append(zone_viol)

    return violations
