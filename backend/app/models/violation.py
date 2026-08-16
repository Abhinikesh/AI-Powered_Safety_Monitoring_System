from datetime import datetime


# Defines the shape of a violation document stored in MongoDB.
# Using plain dicts + pymongo instead of an ORM — simpler for this project size.
def make_violation(
    violation_type: str,
    confidence: float,
    snapshot_path: str,
    frame_width: int,
    frame_height: int,
    timestamp: datetime = None,
) -> dict:
    return {
        "timestamp": timestamp or datetime.utcnow(),
        "violation_type": violation_type,   # e.g. "no-helmet", "no-vest"
        "confidence": round(confidence, 4),
        "snapshot_path": snapshot_path,
        "frame_width": frame_width,
        "frame_height": frame_height,
    }
