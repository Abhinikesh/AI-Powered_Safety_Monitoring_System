from typing import Optional
from datetime import datetime
from fastapi import APIRouter
from app.services.violation_service import (
    get_all_violations,
    get_violations_by_date,
    get_violation_stats,
)

router = APIRouter(prefix="/violations", tags=["Violations"])


@router.get("")
def read_all_violations(
    type: Optional[str] = None,
    date: Optional[str] = None
):
    """Fetch all logged violations with optional client-side-style filtering.

    Query params:
        type: Filter by violation_type (e.g. 'no-helmet'). Omit or 'all' for all types.
        date: ISO date string (YYYY-MM-DD). Filters records whose timestamp starts with this date.

    Returns an empty list (not an error) if no violations match — the frontend handles empty state.
    """
    violations = get_all_violations()

    # Filter by type if requested
    if type and type.lower() != "all":
        violations = [v for v in violations if v.get("violation_type") == type]

    # Filter by date prefix (ISO timestamps start with YYYY-MM-DD)
    if date:
        try:
            target_date = date.split("T")[0]  # Strip time component if present
            violations = [v for v in violations if v.get("timestamp", "").startswith(target_date)]
        except Exception:
            pass  # Ignore malformed date — return unfiltered results

    return violations


@router.get("/stats")
def read_violation_stats():
    """Return violation counts grouped by type for dashboard charts.

    Returns an empty dict {} if no violations are recorded yet — Recharts handles this gracefully.
    """
    return get_violation_stats()


@router.get("/today")
def read_today_violations():
    """Return only violations recorded today (UTC date)."""
    today = datetime.utcnow()
    return get_violations_by_date(today)
