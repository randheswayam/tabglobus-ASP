"""Password reset stub (sprint v4). An Admin issues a one-time token for a staff user and passes it on; SiteFlow
sends nothing until the notification channel exists (S15). Using the token sets the password and ends every
session of that user."""

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import workflow_config as wc
from app.db import get_db
from app.deps import require_staff
from app.models import PasswordReset, Role, User
from app.modules.identity import sessions
from app.modules.identity.admin import require_admin
from app.passwords import hash_password
from app.schemas import iso_utc
from app.services import audit

router = APIRouter(tags=["auth"])

REFUSED = "This reset code is not valid or has expired. Ask an Admin for a new one."


@router.post(
    "/admin/users/{user_id}/password-reset",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_staff)],
)
def issue_reset(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.role == Role.client or not user.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an active staff user can be given a reset code")
    now = datetime.now(UTC)
    for old in db.scalars(
        select(PasswordReset).where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None))
    ):
        old.used_at = now  # a newer code replaces any earlier one
    token = secrets.token_urlsafe(32)
    row = PasswordReset(
        user_id=user.id,
        token_hash=sessions._hash(token),
        created_by_id=admin.id,
        created_at=now,
        expires_at=now + timedelta(hours=wc.PASSWORD_RESET_TTL_HOURS),
    )
    db.add(row)
    db.flush()
    audit.record(db, admin, "user.password_reset_issued", project_id=None, entity_type="user", entity_id=user.id)
    db.commit()
    return {"token": token, "expires_at": iso_utc(row.expires_at)}


class ResetIn(BaseModel):
    token: str = Field(max_length=200)
    password: str = Field(min_length=10, max_length=200)


@router.post("/auth/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetIn, db: Session = Depends(get_db)) -> Response:
    now = datetime.now(UTC)
    row = db.scalars(select(PasswordReset).where(PasswordReset.token_hash == sessions._hash(body.token))).first()
    user = db.get(User, row.user_id) if row else None
    if row is None or row.used_at is not None or sessions._aware(row.expires_at) <= now or user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, REFUSED)
    if not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, REFUSED)
    row.used_at = now
    user.password_hash = hash_password(body.password)
    ended = sessions.revoke_all(db, user)
    audit.record(
        db,
        user,
        "user.password_reset",
        project_id=None,
        entity_type="user",
        entity_id=user.id,
        detail={"sessions_ended": ended},
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
