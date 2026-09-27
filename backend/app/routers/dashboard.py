"""The Architect's dashboard (plan section 5.1): All Projects, Needs Architect Attention, Major Problems
and Review Queue, for the projects the signed-in user can see."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, visible_projects
from app.models import Media, MediaKind, Problem, ProblemStatus, Project, RedFlag, User
from app.routers.reviews import queue_rows
from app.schemas import approved_at, civil_engineer_of, current_step_name, user_brief
from app.services.problems import problem_out
from app.services.red_flags import flag_out, sync_red_flags

router = APIRouter(tags=["dashboard"])

_SEVERITY_ORDER = {"Critical": 0, "High": 1}


def _last_visit_at(project: Project) -> str | None:
    times = [approved_at(v) for v in project.site_visits if v.status.value == "approved"]
    return max(times) if times else None


def _problem_photo(db: Session, problem: Problem) -> int | None:
    """The photo tagged to the problem, else the visit's first photo."""
    photos = db.scalars(select(Media).where(Media.site_visit_id == problem.site_visit_id,
                                            Media.kind == MediaKind.photo).order_by(Media.id)).all()
    if not photos:
        return None
    tagged = next((m for m in photos if m.problem_ref == problem.index), None)
    return (tagged or photos[0]).id


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    now = datetime.now(timezone.utc)
    projects = db.scalars(visible_projects(user)).all()
    for p in projects:  # time-based rules (overdue review, no recent visit) move with the clock
        sync_red_flags(db, p, now)
    db.commit()

    ids = [p.id for p in projects]
    flags: dict[int, list[RedFlag]] = {pid: [] for pid in ids}
    for f in db.scalars(select(RedFlag).where(RedFlag.project_id.in_(ids), RedFlag.cleared_at.is_(None))):
        flags[f.project_id].append(f)
    open_problems = db.scalars(select(Problem).where(Problem.project_id.in_(ids),
                                                     Problem.status == ProblemStatus.open)).all()

    rows = []
    for p in projects:
        active = sorted((flag_out(f) for f in flags[p.id]), key=lambda f: (-f["rank"], f["raised_at"]))
        rows.append({
            "id": p.id, "name": p.name, "location": p.location,
            "current_step": current_step_name(p), "official_progress": p.official_progress,
            "open_problems": sum(1 for x in open_problems if x.project_id == p.id),
            "last_visit_at": _last_visit_at(p),
            "red_flags": len(active), "flag_labels": [f["label"] for f in active], "flags": active,
            "civil_engineer": user_brief(civil_engineer_of(p)),
        })

    attention = sorted((r for r in rows if r["flags"]),
                       key=lambda r: (-r["flags"][0]["rank"], min(f["raised_at"] for f in r["flags"])))
    major = sorted((x for x in open_problems if x.severity in _SEVERITY_ORDER),
                   key=lambda x: (_SEVERITY_ORDER[x.severity], x.target_date, x.id))
    return {
        "all_projects": rows,
        "needs_attention": attention,
        "major_problems": [{**problem_out(x), "photo_id": _problem_photo(db, x)} for x in major],
        "review_queue": queue_rows(db, ids),
    }
