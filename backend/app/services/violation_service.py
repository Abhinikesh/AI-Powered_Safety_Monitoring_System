import time
from datetime import datetime, timedelta
from bson import ObjectId
from app.database import violations_col

# Per-type cooldown tracker: maps violation_type -> last logged Unix timestamp
_last_logged_times: dict = {}

# Only allow logging the same violation type once every 3 seconds to prevent DB flooding
LOGGING_COOLDOWN_SECONDS = 3.0


def _serialize(doc: dict) -> dict:
    """Convert a raw MongoDB document to a JSON-serializable dict."""
    doc = dict(doc)  # Don't mutate the original cursor object
    doc["id"] = str(doc.pop("_id"))
    if isinstance(doc.get("timestamp"), datetime):
        doc["timestamp"] = doc["timestamp"].isoformat()
    # snapshot_path now stores only the filename — return it as-is
    return doc


def should_log_violation(violation_type: str) -> bool:
    """Return True if enough time has passed since the last log of this violation type.

    This prevents 60+ identical entries when a worker stands in frame without a helmet
    for a full minute — instead we get one entry per 3 seconds at most.
    """
    now = time.monotonic()
    last_time = _last_logged_times.get(violation_type, 0.0)

    if now - last_time >= LOGGING_COOLDOWN_SECONDS:
        _last_logged_times[violation_type] = now
        return True
    return False


def save_violation(violation_data: dict) -> str:
    """Insert a violation document into MongoDB and return the new document's string ID."""
    result = violations_col.insert_one(violation_data)
    return str(result.inserted_id)


def get_all_violations(limit: int = 500) -> list:
    """Fetch the most recent violations sorted newest-first, up to `limit` records."""
    docs = violations_col.find().sort("timestamp", -1).limit(limit)
    return [_serialize(d) for d in docs]


def get_violations_by_date(date: datetime) -> list:
    """Fetch all violations that occurred on the given calendar day (UTC)."""
    start = datetime(date.year, date.month, date.day, tzinfo=None)
    end = start + timedelta(days=1)
    docs = (
        violations_col
        .find({"timestamp": {"$gte": start, "$lt": end}})
        .sort("timestamp", -1)
    )
    return [_serialize(d) for d in docs]


def get_violation_stats() -> dict:
    """Return a count of violations grouped by violation_type, sorted by count descending."""
    pipeline = [
        {"$group": {"_id": "$violation_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = violations_col.aggregate(pipeline)
    return {r["_id"]: r["count"] for r in results}
