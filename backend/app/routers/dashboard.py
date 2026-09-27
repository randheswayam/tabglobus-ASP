"""The Architect's dashboard (plan section 5.1): All Projects, Needs Architect Attention, Major Problems
and Review Queue, for the projects the signed-in user can see."""

from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app import template_config as tc
from app.clock import business_date
from app.db import get_db
from app.deps import get_current_user, require_staff, visible_projects
from app.models import (
    Problem,
    ProblemStatus,
    Project,
    ProjectMember,
    RedFlag,
    Role,
    SignoffRequest,
    SignoffStatus,
    User,
)
from app.routers.reviews import queue_rows
from app.schemas import approved_at, civil_engineer_of, current_step_name, iso_utc, stage_summary, user_brief
from app.services.problems import problem_out, problem_photo
from app.services.red_flags import flag_out, sync_red_flags

router = APIRouter(tags=["dashboard"], dependencies=[Depends(require_staff)])

_SEVERITY_ORDER = {"Critical": 0, "High": 1}


def _last_visit_at(project: Project) -> str | None:
    times = [approved_at(v) for v in project.site_visits if v.status.value == "approved"]
    return max(times) if times else None


Step = Literal["Legal Approval", "Site Visit", "Team Lead Review"]
Severity = Literal["Low", "Medium", "High", "Critical"]


@router.get("/dashboard")
def dashboard(
    q: str | None = None,
    location: str | None = None,
    step: Step | None = None,
    engineer_id: int | None = None,
    red_flag: bool | None = None,
    severity: Severity | None = None,
    category: str | None = None,
    progress_min: float | None = Query(None, ge=0, le=100),
    progress_max: float | None = Query(None, ge=0, le=100),
    visit_from: date | None = None,
    visit_to: date | None = None,
    phase: int | None = Query(None, ge=1, le=10),
    client_pending: bool | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Filters (plan section 5.2) narrow every panel. Severity and category match open problems."""
    if category is not None and category not in tc.PROBLEMS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown problem category: {category}")
    if progress_min is not None and progress_max is not None and progress_min > progress_max:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "progress_min is above progress_max")
    if visit_from and visit_to and visit_from > visit_to:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "visit_from is after visit_to")
    now = datetime.now(UTC)
    projects = db.scalars(visible_projects(user)).all()
    for p in projects:  # time-based rules (overdue review, no recent visit) move with the clock
        sync_red_flags(db, p, now)
    db.commit()

    ids = [p.id for p in projects]
    flags: dict[int, list[RedFlag]] = {pid: [] for pid in ids}
    for f in db.scalars(select(RedFlag).where(RedFlag.project_id.in_(ids), RedFlag.cleared_at.is_(None))):
        flags[f.project_id].append(f)
    open_problems = db.scalars(
        select(Problem).where(Problem.project_id.in_(ids), Problem.status == ProblemStatus.open)
    ).all()

    now_ts = datetime.now(UTC)
    waiting = {}
    for req in db.scalars(
        select(SignoffRequest).where(SignoffRequest.project_id.in_(ids), SignoffRequest.status == SignoffStatus.sent)
    ):
        sent = req.sent_at if req.sent_at.tzinfo else req.sent_at.replace(tzinfo=UTC)
        waiting[req.project_id] = {
            "signoff_id": req.id,
            "stage": sc.BY_KEY[req.stage_key]["label"],
            "version": req.version,
            "sent_at": iso_utc(sent),
            "days_waiting": (now_ts - sent).days,
        }
    clients = {}
    for pid, name in db.execute(
        select(ProjectMember.project_id, User.name)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id.in_(ids), User.role == Role.client)
        .order_by(User.id)
    ):
        clients.setdefault(pid, name)

    rows = []
    for p in projects:
        active = sorted((flag_out(f) for f in flags[p.id]), key=lambda f: (-f["rank"], f["raised_at"]))
        rows.append(
            {
                "id": p.id,
                "name": p.name,
                "location": p.location,
                "current_step": current_step_name(p),
                "official_progress": p.official_progress,
                "open_problems": sum(1 for x in open_problems if x.project_id == p.id),
                "last_visit_at": _last_visit_at(p),
                "red_flags": len(active),
                "flag_labels": [f["label"] for f in active],
                "flags": active,
                "civil_engineer": user_brief(civil_engineer_of(p)),
                **stage_summary(p),
                "client": clients.get(p.id),
                "waiting_for_client": waiting.get(p.id),
            }
        )

    def problem_matches(x: Problem) -> bool:
        return (severity is None or x.severity == severity) and (category is None or x.category == category)

    def keep(r: dict) -> bool:
        last = business_date(datetime.fromisoformat(r["last_visit_at"])) if r["last_visit_at"] else None
        return all(
            [
                q is None or q.strip().lower() in r["name"].lower(),
                location is None or location.strip().lower() in r["location"].lower(),
                step is None or r["current_step"] == step,
                engineer_id is None or (r["civil_engineer"] or {}).get("id") == engineer_id,
                red_flag is None or bool(r["flags"]) == red_flag,
                (severity is None and category is None)
                or any(x.project_id == r["id"] and problem_matches(x) for x in open_problems),
                progress_min is None or r["official_progress"] >= progress_min,
                progress_max is None or r["official_progress"] <= progress_max,
                visit_from is None or (last is not None and last >= visit_from),
                visit_to is None or (last is not None and last <= visit_to),
                phase is None or (r["phase"] or {}).get("number") == phase,
                client_pending is None or (r["waiting_for_client"] is not None) == client_pending,
            ]
        )

    rows = [r for r in rows if keep(r)]
    kept = {r["id"] for r in rows}
    attention = sorted(
        (r for r in rows if r["flags"]), key=lambda r: (-r["flags"][0]["rank"], min(f["raised_at"] for f in r["flags"]))
    )
    major = sorted(
        (x for x in open_problems if x.project_id in kept and x.severity in _SEVERITY_ORDER and problem_matches(x)),
        key=lambda x: (_SEVERITY_ORDER[x.severity], x.target_date, x.id),
    )
    return {
        "all_projects": rows,
        "needs_attention": attention,
        "major_problems": [{**problem_out(x), "photo_id": problem_photo(db, x)} for x in major],
        "review_queue": queue_rows(db, sorted(kept)),
        "waiting_for_client": sorted(
            (r for r in rows if r["waiting_for_client"]), key=lambda r: -r["waiting_for_client"]["days_waiting"]
        ),
    }
