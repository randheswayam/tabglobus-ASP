from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role, visible_projects
from app.models import Project, Review, ReviewDecision, Role, SiteVisit, User, VisitStatus
from app.schemas import user_brief, visit_out
from app.services import audit, workflow

router = APIRouter(tags=["reviews"])


class ReviewIn(BaseModel):
    decision: ReviewDecision
    comment: str | None = None


def _minutes_since(t: datetime) -> int:
    if t.tzinfo is None:  # SQLite returns naive datetimes; they are stored as UTC.
        t = t.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - t).total_seconds() // 60))


@router.get("/reviews/queue")
def review_queue(db: Session = Depends(get_db), user: User = Depends(require_role(Role.team_lead))) -> list[dict]:
    visible = visible_projects(user).with_only_columns(Project.id)
    visits = db.scalars(select(SiteVisit).where(SiteVisit.status == VisitStatus.submitted,
                                                SiteVisit.project_id.in_(visible))
                        .order_by(SiteVisit.submitted_at)).all()
    return [{
        "id": v.id,
        "project": {"id": v.project.id, "name": v.project.name, "location": v.project.location},
        "engineer": user_brief(v.engineer),
        "current_stage": v.current_stage,
        "submission_count": v.submission_count,
        "computed_progress": v.computed_progress,
        "submitted_at": v.submitted_at.isoformat(),
        "waiting_minutes": _minutes_since(v.submitted_at),
    } for v in visits]


@router.post("/site-visits/{visit_id}/review")
def review_site_visit(visit_id: int, body: ReviewIn, user: User = Depends(require_role(Role.team_lead)),
                      db: Session = Depends(get_db)) -> dict:
    visit = db.get(SiteVisit, visit_id)
    if visit is None or db.scalars(visible_projects(user).where(Project.id == visit.project_id)).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Site visit not found")
    if visit.status != VisitStatus.submitted:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Site visit is {visit.status.value}, not waiting for review")

    comment = (body.comment or "").strip() or None
    if body.decision == ReviewDecision.rework and comment is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"message": "Rework needs a comment for the engineer", "missing": ["comment"]})

    project = visit.project
    db.add(Review(site_visit_id=visit.id, reviewer_id=user.id, decision=body.decision, comment=comment))
    detail = {"submission": visit.submission_count, "comment": comment}

    if body.decision == ReviewDecision.approve:
        visit.status = VisitStatus.approved
        project.official_progress = visit.computed_progress
        audit.record(db, user, "site_visit.approved", project_id=project.id, entity_type="site_visit",
                     entity_id=visit.id, detail={**detail, "official_progress": visit.computed_progress})
        workflow.complete(db, project, workflow.REVIEW, user)
    else:
        visit.status = VisitStatus.rework
        audit.record(db, user, "site_visit.rework_requested", project_id=project.id, entity_type="site_visit",
                     entity_id=visit.id, detail=detail)
        workflow.lock(db, project, workflow.REVIEW, user)
        workflow.activate(db, project, workflow.SITE_VISIT, user)

    db.commit()
    db.refresh(visit)
    return visit_out(visit)
