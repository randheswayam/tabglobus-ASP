"""Business dates. Deadlines, overdue checks and date filters follow the office's calendar day, not UTC:
just after midnight in Pune it is still the previous day in UTC."""
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from app import workflow_config as wc


def business_date(t: datetime) -> date:
    if t.tzinfo is None:  # stored as UTC (SQLite returns naive datetimes)
        t = t.replace(tzinfo=timezone.utc)
    return t.astimezone(ZoneInfo(wc.BUSINESS_TIMEZONE)).date()
