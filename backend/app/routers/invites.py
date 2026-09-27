"""Inviting a client to the customer app. Nothing is sent: the Architect shares the one-time code in person,
by phone or by message, until an email or SMS channel exists."""
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import workflow_config as wc
from app.db import get_db
from app.deps import get_visible_project, require_role, require_staff
from app.models import ClientInvite, Project, ProjectMember, Role, User
from app.passwords import hash_password
from app.schemas import iso_utc
from app.services import audit

router = APIRouter(tags=["client invites"], dependencies=[Depends(require_staff)])

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I, which are easy to misread
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class InviteIn(BaseModel):
    name: str
    email: str

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v.strip()

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("must be an email address")
        return v


def client_out(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email, "status": "active" if user.is_active else "invited"}


@router.post("/projects/{project_id}/client-invite", status_code=status.HTTP_201_CREATED)
def invite_client(body: InviteIn, user: User = Depends(require_role(Role.architect)),
                  project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> dict:
    client = db.scalars(select(User).where(func.lower(User.email) == body.email)).first()
    if client is not None and client.role != Role.client:
        raise HTTPException(status.HTTP_409_CONFLICT, "This email belongs to a SiteFlow team member")
    if client is None:
        # Not usable until the client sets a password with the code.
        client = User(name=body.name, email=body.email, role=Role.client, is_active=False,
                      password_hash=hash_password(secrets.token_urlsafe(32)))
        db.add(client)
        db.flush()
    if db.scalars(select(ProjectMember).where(ProjectMember.project_id == project.id,
                                              ProjectMember.user_id == client.id)).first() is None:
        db.add(ProjectMember(project_id=project.id, user_id=client.id))

    code = expires = None
    if not client.is_active:
        now = datetime.now(timezone.utc)
        for old in db.scalars(select(ClientInvite).where(ClientInvite.user_id == client.id,
                                                         ClientInvite.used_at.is_(None),
                                                         ClientInvite.revoked_at.is_(None))):
            old.revoked_at = now
        code = "".join(secrets.choice(_ALPHABET) for _ in range(8))
        expires = now + timedelta(days=wc.INVITE_CODE_TTL_DAYS)
        db.add(ClientInvite(user_id=client.id, project_id=project.id, code_hash=hash_password(code),
                            expires_at=expires, created_by_id=user.id))
    audit.record(db, user, "client.invited", project_id=project.id, entity_type="user", entity_id=client.id,
                 detail={"client": client.name, "new_code": code is not None})
    db.commit()
    return {"client": client_out(client), "code": code, "expires_at": iso_utc(expires)}


@router.get("/projects/{project_id}/clients")
def project_clients(project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(User).join(ProjectMember, ProjectMember.user_id == User.id)
                      .where(ProjectMember.project_id == project.id, User.role == Role.client).order_by(User.id))
    return [client_out(u) for u in rows]
