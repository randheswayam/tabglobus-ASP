"""Mandatory-field validation for a site visit submission (plan section 4, Step 2).

Every problem is collected rather than stopping at the first, so the app can show the
engineer one complete list of what is missing or wrong.
"""
from datetime import date, datetime

from pydantic import BaseModel

from app import template_config as tc


class GpsIn(BaseModel):
    lat: float
    lng: float


class LocationIn(BaseModel):
    gps: GpsIn | None = None
    manual: str | None = None


class ProblemIn(BaseModel):
    category: str | None = None
    problem: str | None = None
    other_text: str | None = None
    severity: str | None = None
    location: str | None = None
    responsible_party: str | None = None
    target_date: date | None = None


class SiteVisitIn(BaseModel):
    visit_at: datetime | None = None
    location: LocationIn | None = None
    weather: str | None = None
    attendees: str | None = None
    current_stage: str | None = None
    checklist: dict[str, str] = {}
    no_issues: bool = False
    problems: list[ProblemIn] = []
    summary: str | None = None
    recommended_action: str | None = None


def _blank(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def validate_site_visit(v: SiteVisitIn) -> tuple[list[str], list[str]]:
    """Return (missing, invalid) field paths; both empty means the visit can be submitted."""
    missing: list[str] = []
    invalid: list[str] = []

    for f in ("visit_at", "weather", "attendees", "current_stage", "summary", "recommended_action"):
        if _blank(getattr(v, f)):
            missing.append(f)

    loc = v.location
    if loc is None or (loc.gps is None and _blank(loc.manual)):
        missing.append("location")
    elif loc.gps is not None and not (-90 <= loc.gps.lat <= 90 and -180 <= loc.gps.lng <= 180):
        invalid.append("location.gps")

    stages = {s["name"]: s for s in tc.STAGES}
    if not _blank(v.current_stage):
        stage = stages.get(v.current_stage)
        if stage is None:
            invalid.append("current_stage")
        else:
            item_ids = [i["id"] for i in stage["checklist"]]
            missing += [f"checklist.{i}" for i in item_ids if i not in v.checklist]
            invalid += [f"checklist.{k}" for k, state in v.checklist.items()
                        if k not in item_ids or state not in tc.CHECKLIST_STATES]

    if v.no_issues and v.problems:
        invalid.append("no_issues")
    elif not v.no_issues and not v.problems:
        missing.append("problems")

    for n, p in enumerate(v.problems):
        at = f"problems[{n}]"
        if _blank(p.category):
            missing.append(f"{at}.category")
        elif p.category not in tc.PROBLEMS:
            invalid.append(f"{at}.category")
        elif p.category == "Other":
            if _blank(p.other_text):
                missing.append(f"{at}.other_text")
        elif _blank(p.problem):
            missing.append(f"{at}.problem")
        elif p.problem not in tc.PROBLEMS[p.category]:
            invalid.append(f"{at}.problem")

        if _blank(p.severity):
            missing.append(f"{at}.severity")
        elif p.severity not in tc.SEVERITIES:
            invalid.append(f"{at}.severity")
        for f in ("location", "responsible_party", "target_date"):
            if _blank(getattr(p, f)):
                missing.append(f"{at}.{f}")

    return missing, invalid
