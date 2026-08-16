import os
import time
from pathlib import Path

SNAPSHOT_DIR = Path(__file__).parent.parent / "logs" / "snapshots"
RETENTION_DAYS = 7


def cleanup_old_snapshots(retention_days: int = RETENTION_DAYS):
    """Deletes snapshot files older than retention_days (default 7 days)."""
    if not SNAPSHOT_DIR.exists():
        print(f"Snapshot directory {SNAPSHOT_DIR} does not exist.")
        return

    now = time.time()
    cutoff_seconds = retention_days * 86400
    deleted_count = 0

    for file_path in SNAPSHOT_DIR.glob("*.jpg"):
        file_age = now - file_path.stat().st_mtime
        if file_age > cutoff_seconds:
            try:
                file_path.unlink()
                deleted_count += 1
            except Exception as e:
                print(f"Failed to delete {file_path.name}: {e}")

    print(f"✓ Snapshot cleanup complete. Deleted {deleted_count} files older than {retention_days} days.")


if __name__ == "__main__":
    cleanup_old_snapshots()
