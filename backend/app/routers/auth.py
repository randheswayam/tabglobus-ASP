from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import workflow_config as wc
from app.db import get_db
from app.deps import get_current_user
from app.models import ClientInvite, Role, User
from app.modules.identity import sessions
from app.passwords import hash_password, verify_password
from app.services import audit

router = APIRouter(prefix="/auth", tags=["auth"])

# Verified when the email is unknown, so both failure paths take the same time.
_DUMMY_HASH = hash_password("unused-dummy-password")


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str

    @classmethod
    def of(cls, u: User) -> "UserOut":
        return cls(id=u.id, name=u.name, email=u.email, role=u.role.value)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut

    @classmethod
    def issue(cls, db: Session, user: User, request: Request) -> "TokenOut":
        access, refresh = sessions.open_session(db, user, request.headers.get("user-agent"))
        return cls(access_token=access, refresh_token=refresh, user=UserOut.of(user))


class RefreshIn(BaseModel):
    refresh_token: str


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalars(select(User).where(func.lower(User.email) == body.email.strip().lower())).first()
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not (user and ok and user.is_active):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    out = TokenOut.issue(db, user, request)
    db.commit()
    return out


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)) -> TokenOut:
    """A new access token and a new refresh token; the old refresh token stops working."""
    try:
        user, access, new_refresh = sessions.rotate(db, body.refresh_token)
    except sessions.RefreshRefused:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has ended. Please sign in again.") from None
    db.commit()
    return TokenOut(access_token=access, refresh_token=new_refresh, user=UserOut.of(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.of(user)


class ActivateIn(BaseModel):
    email: str
    code: str
    password: str


_INVALID_INVITE = "This invite code is not valid. Ask your architect for a new one."


def _aware(t: datetime) -> datetime:
    return t.replace(tzinfo=UTC) if t.tzinfo is None else t


@router.post("/activate", response_model=TokenOut)
def activate(body: ActivateIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    """A client sets their password with the one-time invite code. Every failure looks the same."""
    if len(body.password) < 10:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {"message": "Choose a password of at least 10 characters", "missing": ["password"]},
        )
    now = datetime.now(UTC)
    user = db.scalars(
        select(User).where(func.lower(User.email) == body.email.strip().lower(), User.role == Role.client)
    ).first()
    invite = (
        None
        if user is None
        else db.scalars(
            select(ClientInvite)
            .where(ClientInvite.user_id == user.id, ClientInvite.used_at.is_(None), ClientInvite.revoked_at.is_(None))
            .order_by(ClientInvite.id.desc())
        ).first()
    )
    code = body.code.strip().upper()
    usable = invite is not None and invite.attempts < wc.INVITE_MAX_ATTEMPTS and _aware(invite.expires_at) > now
    if not usable:
        verify_password(code, _DUMMY_HASH)  # same work whether or not an invite exists
        raise HTTPException(status.HTTP_400_BAD_REQUEST, _INVALID_INVITE)
    if not verify_password(code, invite.code_hash):
        invite.attempts += 1
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, _INVALID_INVITE)
    user.password_hash, user.is_active, invite.used_at = hash_password(body.password), True, now
    audit.record(db, user, "client.activated", project_id=invite.project_id, entity_type="user", entity_id=user.id)
    out = TokenOut.issue(db, user, request)
    db.commit()
    return out
