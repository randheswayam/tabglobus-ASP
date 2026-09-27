"""Sessions and refresh tokens. The refresh token is random and long, so a SHA-256 hash is enough to store it:
nobody can guess it, and a leaked database row can't be turned back into a working token."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import create_access_token
from app.config import get_settings
from app.models import User, UserSession


class RefreshRefused(Exception):
    pass


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _aware(t: datetime) -> datetime:
    return t.replace(tzinfo=UTC) if t.tzinfo is None else t


def is_live(session: UserSession | None, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return session is not None and session.revoked_at is None and _aware(session.expires_at) > now


def open_session(db: Session, user: User, user_agent: str | None) -> tuple[str, str]:
    """A new session for this device: (access token, refresh token)."""
    now = datetime.now(UTC)
    refresh = secrets.token_urlsafe(32)
    session = UserSession(
        user_id=user.id,
        refresh_hash=_hash(refresh),
        user_agent=(user_agent or "")[:200] or None,
        created_at=now,
        last_used_at=now,
        expires_at=now + timedelta(days=get_settings().refresh_token_days),
    )
    db.add(session)
    db.flush()
    return create_access_token(user.id, session.id), refresh


def rotate(db: Session, refresh: str) -> tuple[User, str, str]:
    """Swap a refresh token for a new pair. A token that was already rotated out revokes the whole session."""
    now = datetime.now(UTC)
    digest = _hash(refresh)
    session = db.scalars(
        select(UserSession).where(or_(UserSession.refresh_hash == digest, UserSession.previous_hash == digest))
    ).first()
    if session is None:
        raise RefreshRefused
    if session.previous_hash == digest and session.refresh_hash != digest:
        session.revoked_at = session.revoked_at or now
        db.commit()
        raise RefreshRefused
    user = db.get(User, session.user_id)
    if not is_live(session, now) or user is None or not user.is_active:
        raise RefreshRefused
    new_refresh = secrets.token_urlsafe(32)
    session.previous_hash, session.refresh_hash = session.refresh_hash, _hash(new_refresh)
    session.last_used_at = now
    db.flush()
    return user, create_access_token(user.id, session.id), new_refresh


def revoke(db: Session, session: UserSession) -> None:
    session.revoked_at = session.revoked_at or datetime.now(UTC)


def revoke_all(db: Session, user: User) -> int:
    """End every live session of this user (sign out everywhere, or deactivation). Returns how many."""
    now = datetime.now(UTC)
    live = [
        s
        for s in db.scalars(select(UserSession).where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None)))
        if is_live(s, now)
    ]
    for s in live:
        s.revoked_at = now
    db.flush()
    return len(live)
