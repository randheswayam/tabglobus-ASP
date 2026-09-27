from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_visible_project, require_role, require_staff
from app.models import Project, RedFlag, Role, User
from app.services import audit
from app.services.red_flags import RULES, flag_out

router = APIRouter(tags=["red flags"], dependencies=[Depends(require_staff)])


class ClearIn(BaseModel):
    reason: str | None = None


@router.get("/projects/{project_id}/red-flags")
def active_flags(project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(RedFlag).where(RedFlag.project_id == project.id, RedFlag.cleared_at.is_(None))
                      .order_by(RedFlag.id)).all()
    return [flag_out(f) for f in rows]


@router.post("/red-flags/{flag_id}/clear")
def clear_flag(flag_id: int, body: ClearIn, user: User = Depends(require_role(Role.team_lead)),
               db: Session = Depends(get_db)) -> dict:
    flag = db.get(RedFlag, flag_id)
    if flag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Red flag not found")
    if flag.cleared_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This red flag is already cleared")
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"message": "Give a reason for clearing this red flag", "missing": ["reason"]})
    flag.cleared_at = datetime.now(timezone.utc)
    flag.clear_kind, flag.cleared_by_id, flag.clear_reason = "manual", user.id, reason
    audit.record(db, user, "red_flag.cleared_manually", project_id=flag.project_id, entity_type="red_flag",
                 entity_id=flag.id, detail={"rule": flag.rule, "key": flag.key, "label": RULES[flag.rule]["label"],
                                            "reason": reason})
    db.commit()
    db.refresh(flag)
    return flag_out(flag)
