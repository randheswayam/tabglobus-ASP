from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_visible_project, require_role, visible_projects
from app.models import Problem, ProblemStatus, Project, Role, User
from app.services import audit, red_flags
from app.services.problems import problem_out

router = APIRouter(tags=["problems"])


class ResolveIn(BaseModel):
    note: str | None = None


@router.get("/projects/{project_id}/problems")
def list_problems(status: ProblemStatus | None = None, project: Project = Depends(get_visible_project),
                  db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Problem).where(Problem.project_id == project.id).order_by(Problem.id)
    if status is not None:
        stmt = stmt.where(Problem.status == status)
    return [problem_out(p) for p in db.scalars(stmt)]


@router.post("/problems/{problem_id}/resolve")
def resolve_problem(problem_id: int, body: ResolveIn, db: Session = Depends(get_db),
                    user: User = Depends(require_role(Role.civil_engineer, Role.team_lead))) -> dict:
    problem = db.get(Problem, problem_id)
    if problem is None or db.scalars(visible_projects(user).where(Project.id == problem.project_id)).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Problem not found")
    if problem.status == ProblemStatus.resolved:
        raise HTTPException(status.HTTP_409_CONFLICT, "This problem is already resolved")
    note = (body.note or "").strip()
    if not note:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"message": "Say how the problem was resolved", "missing": ["note"]})

    problem.status = ProblemStatus.resolved
    problem.resolved_at = datetime.now(timezone.utc)
    problem.resolved_by_id = user.id
    problem.resolution_note = note
    audit.record(db, user, "problem.resolved", project_id=problem.project_id, entity_type="problem",
                 entity_id=problem.id, detail={"problem_id": problem.id, "problem": problem.problem, "note": note})
    red_flags.sync_red_flags(db, problem.project, datetime.now(timezone.utc))
    db.commit()
    db.refresh(problem)
    return problem_out(problem)
