import cv2
import json
import uuid
from datetime import datetime
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from app.services.detection_service import detect_ppe, check_violations
from app.services.violation_service import save_violation, should_log_violation
from app.models.violation import make_violation

router = APIRouter()

# Snapshot directory is always relative to the project root — two levels up from backend/app/routes/
SNAPSHOT_DIR = Path(__file__).resolve().parent.parent.parent.parent / "logs" / "snapshots"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/detect")
async def detect_image(
    file: UploadFile = File(...),
    zone: Optional[str] = Form(None),
    threshold: Optional[float] = Form(0.5)
):
    """Receive an uploaded image frame, run YOLOv8 detection, check for violations,
    log them to MongoDB with cooldown protection, and return results to the frontend.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image (JPEG/PNG).")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Received empty file — nothing to process.")

    detections, img, width, height = detect_ppe(image_bytes)

    if img is None:
        raise HTTPException(status_code=400, detail="Failed to decode the image. Make sure the frame is valid JPEG or PNG.")

    # Parse zone polygon coordinates if provided from the frontend
    zone_points = None
    if zone:
        try:
            parsed = json.loads(zone)
            # Accept both [[x,y],...] and [[x,y,z],...] formats — only use x,y
            if isinstance(parsed, list) and len(parsed) >= 3:
                zone_points = [[float(pt[0]), float(pt[1])] for pt in parsed]
        except Exception as e:
            print(f"Warning: Could not parse zone coordinates: {e}")

    # Clamp threshold to a valid range; fall back to default if out of bounds
    if threshold is None or not (0.01 <= threshold <= 0.99):
        threshold = 0.5

    violations = check_violations(detections, threshold=threshold, zone_points=zone_points)
    has_violation = len(violations) > 0
    saved_records = []

    if has_violation:
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        for v in violations:
            vtype = v["class_name"]

            # Apply 3-second cooldown: don't spam MongoDB with duplicate logs
            if should_log_violation(vtype):
                filename = f"{timestamp_str}_{vtype}_{uuid.uuid4().hex[:6]}.jpg"
                snapshot_path = SNAPSHOT_DIR / filename

                # Save the snapshot frame to disk
                cv2.imwrite(str(snapshot_path), img)

                # Store only the filename (not absolute path) for portability
                v_doc = make_violation(
                    violation_type=vtype,
                    confidence=v["confidence"],
                    snapshot_path=filename,  # Just the filename, not full path
                    frame_width=width,
                    frame_height=height,
                )

                doc_id = save_violation(v_doc)
                saved_records.append({"id": doc_id, "snapshot_filename": filename})

    return {
        "has_violation": has_violation,
        "detections": detections,
        "violations": violations,
        "saved_violations": saved_records,
        "applied_threshold": threshold,
    }
