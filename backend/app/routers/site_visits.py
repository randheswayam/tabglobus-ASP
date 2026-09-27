from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, get_visible_project, require_role, visible_projects
from app.models import Project, Role, SiteVisit, User, VisitStatus
from app.schemas import visit_out
from app.services import audit, workflow
from app.services.progress import derive_progress
from app.services.validation import SiteVisitIn, missing_evidence, validate_site_visit

router = APIRouter(tags=["site visits"])


def _clean(s: str | None) -> str | None:
    return s.strip() if isinstance(s, str) else s


def _open_visit(project: Project) -> SiteVisit | None:
    """The visit the engineer is working on: one sent back for rework, or an unsubmitted draft."""
    return next((v for v in project.site_visits if v.status in (VisitStatus.rework, VisitStatus.draft)), None)


@router.post("/projects/{project_id}/site-visits/draft")
def open_draft(user: User = Depends(require_role(Role.civil_engineer)),
               project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> dict:
    """The server-side visit that photos and video attach to before submission. Form fields stay on the device."""
    if not workflow.is_active(project, workflow.SITE_VISIT):
        raise HTTPException(status.HTTP_409_CONFLICT, "Site Visit step is not open for this project")
    visit = _open_visit(project)
    if visit is None:
        visit = SiteVisit(project_id=project.id, engineer_id=user.id, status=VisitStatus.draft, submission_count=0)
        db.add(visit)
        db.commit()
        db.refresh(visit)
    return visit_out(visit)


@router.post("/projects/{project_id}/site-visits", status_code=status.HTTP_201_CREATED)
def submit_site_visit(body: SiteVisitIn, user: User = Depends(require_role(Role.civil_engineer)),
                      project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> dict:
    if not workflow.is_active(project, workflow.SITE_VISIT):
        raise HTTPException(status.HTTP_409_CONFLICT, "Site Visit step is not open for this project")

    missing, invalid = validate_site_visit(body)
    open_visit = _open_visit(project)
    missing += missing_evidence(body, open_visit.media if open_visit else [])
    if missing or invalid:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"message": "Site visit is incomplete", "missing": missing, "invalid": invalid})

    visit = _open_visit(project)
    if visit is None:
        visit = SiteVisit(project_id=project.id, engineer_id=user.id, submission_count=0)
        db.add(visit)

    visit.engineer_id = user.id
    visit.current_stage = body.current_stage
    visit.form = {
        "visit_at": body.visit_at.isoformat(),
        "location": body.location.model_dump(),
        "weather": _clean(body.weather),
        "attendees": _clean(body.attendees),
        "summary": _clean(body.summary),
        "recommended_action": _clean(body.recommended_action),
    }
    visit.checklist = dict(body.checklist)
    visit.no_issues = body.no_issues
    visit.problems = [p.model_dump(mode="json") for p in body.problems]
    visit.computed_progress = derive_progress(body.current_stage, body.checklist)
    visit.status = VisitStatus.submitted
    visit.submission_count += 1
    visit.submitted_at = datetime.now(timezone.utc)
    db.flush()

    audit.record(db, user, "site_visit.submitted", project_id=project.id, entity_type="site_visit",
                 entity_id=visit.id, detail={"submission": visit.submission_count,
                                             "computed_progress": visit.computed_progress})
    workflow.complete(db, project, workflow.SITE_VISIT, user)
    workflow.activate(db, project, workflow.REVIEW, user)
    db.commit()
    db.refresh(visit)
    return visit_out(visit)


@router.get("/site-visits/{visit_id}")
def get_site_visit(visit_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    visit = db.get(SiteVisit, visit_id)
    visible = visit is not None and db.scalars(
        visible_projects(user).where(Project.id == visit.project_id)).first() is not None
    if not visible:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Site visit not found")
    return visit_out(visit)
