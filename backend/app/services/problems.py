from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Media, MediaKind, Problem, SiteVisit
from app.schemas import iso_utc, user_brief


def open_from_visit(db: Session, visit: SiteVisit) -> list[Problem]:
    """On approval, each reported problem becomes a tracked open item (plan section 4, Step 3)."""
    items = []
    for n, p in enumerate(visit.problems or []):
        item = Problem(project_id=visit.project_id, site_visit_id=visit.id, index=n, category=p["category"],
                       problem=p["other_text"] if p["category"] == "Other" else p["problem"],
                       severity=p["severity"], location=p["location"], responsible_party=p["responsible_party"],
                       target_date=date.fromisoformat(p["target_date"]))
        db.add(item)
        items.append(item)
    return items


def problem_photo(db: Session, problem: Problem) -> int | None:
    """The photo tagged to the problem, else the visit's first photo."""
    photos = db.scalars(select(Media).where(Media.site_visit_id == problem.site_visit_id,
                                            Media.kind == MediaKind.photo).order_by(Media.id)).all()
    if not photos:
        return None
    tagged = next((m for m in photos if m.problem_ref == problem.index), None)
    return (tagged or photos[0]).id


def problem_out(p: Problem) -> dict:
    return {
        "id": p.id,
        "project": {"id": p.project.id, "name": p.project.name},
        "visit_id": p.site_visit_id,
        "index": p.index,
        "category": p.category,
        "problem": p.problem,
        "severity": p.severity,
        "location": p.location,
        "responsible_party": p.responsible_party,
        "target_date": p.target_date.isoformat(),
        "status": p.status.value,
        "created_at": iso_utc(p.created_at),
        "resolved_at": iso_utc(p.resolved_at),
        "resolved_by": user_brief(p.resolved_by),
        "resolution_note": p.resolution_note,
    }
