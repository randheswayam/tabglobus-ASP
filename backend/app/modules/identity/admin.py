"""Admin: staff users and project memberships. Clients are managed through the invite flow, not here."""

import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role, require_staff
from app.models import Project, ProjectMember, Role, User
from app.modules.identity import sessions
from app.passwords import hash_password
from app.schemas import civil_engineer_of
from app.services import audit

router = APIRouter(tags=["admin"], dependencies=[Depends(require_staff)])
require_admin = require_role(Role.admin)

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
STAFF_ROLES = [r for r in Role if r != Role.client]


def user_out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role.value, "active": u.is_active}


class UserIn(BaseModel):
    name: str
    email: str
    role: Role

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

    @field_validator("role")
    @classmethod
    def _staff(cls, v: Role) -> Role:
        if v == Role.client:
            raise ValueError("clients are added through a project invite")
        return v


class UserPatch(BaseModel):
    role: Role | None = None
    active: bool | None = None


@router.get("/admin/users")
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict]:
    return [user_out(u) for u in db.scalars(select(User).order_by(User.id))]


@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
def create_user(body: UserIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    if db.scalars(select(User).where(func.lower(User.email) == body.email)).first() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
    temporary = secrets.token_urlsafe(12)
    user = User(name=body.name, email=body.email, role=body.role, password_hash=hash_password(temporary))
    db.add(user)
    db.flush()
    audit.record(
        db,
        admin,
        "user.created",
        project_id=None,
        entity_type="user",
        entity_id=user.id,
        detail={"user": user.name},
        changes={"role": [None, user.role.value], "email": [None, user.email]},
    )
    db.commit()
    # Shown once, to the Admin, who passes it on; the user should change it (password reset, Task 27).
    return {"user": user_out(user), "temporary_password": temporary}


@router.patch("/admin/users/{user_id}")
def update_user(
    user_id: int, body: UserPatch, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.role == Role.client:
        raise HTTPException(status.HTTP_409_CONFLICT, "Client accounts are managed through the project invite")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can't change your own role or deactivate yourself")
    new = {}
    if body.role is not None:
        if body.role == Role.client:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A staff user can't become a client")
        new["role"] = body.role
    if body.active is not None:
        new["is_active"] = body.active
    changes = audit.diff(user, new)
    for field, value in new.items():
        setattr(user, field, value)
    if changes.get("is_active") == [True, False]:
        sessions.revoke_all(db, user)
    if changes:
        audit.record(
            db,
            admin,
            "user.updated",
            project_id=None,
            entity_type="user",
            entity_id=user.id,
            detail={"user": user.name},
            changes=changes,
        )
    db.commit()
    return user_out(user)


def _project_and_user(db: Session, project_id: int, user_id: int) -> tuple[Project, User]:
    project, user = db.get(Project, project_id), db.get(User, user_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return project, user


def _membership(db: Session, project: Project, user: User) -> ProjectMember | None:
    return db.scalars(
        select(ProjectMember).where(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
    ).first()


@router.post("/projects/{project_id}/members/{user_id}", status_code=status.HTTP_201_CREATED)
def add_member(project_id: int, user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    project, user = _project_and_user(db, project_id, user_id)
    if user.role == Role.client:
        raise HTTPException(status.HTTP_409_CONFLICT, "Clients join a project through the client invite")
    if _membership(db, project, user) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{user.name} is already on this project")
    db.add(ProjectMember(project_id=project.id, user_id=user.id))
    audit.record(
        db,
        admin,
        "member.added",
        project_id=project.id,
        entity_type="user",
        entity_id=user.id,
        detail={"user": user.name, "role": user.role.value},
    )
    db.commit()
    return user_out(user)


@router.delete("/projects/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: int, user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> Response:
    project, user = _project_and_user(db, project_id, user_id)
    member = _membership(db, project, user)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{user.name} is not on this project")
    engineer = civil_engineer_of(project)
    if user.id == project.created_by_id or (engineer is not None and user.id == engineer.id):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "The project's architect and assigned civil engineer stay on the project"
        )
    db.delete(member)
    audit.record(
        db,
        admin,
        "member.removed",
        project_id=project.id,
        entity_type="user",
        entity_id=user.id,
        detail={"user": user.name, "role": user.role.value},
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
