from datetime import UTC, datetime, timedelta
from typing import NamedTuple

import jwt

from app.config import get_settings

_ALGORITHM = "HS256"


class InvalidToken(Exception):
    pass


class Claims(NamedTuple):
    user_id: int
    session_id: int


def create_access_token(user_id: int, session_id: int, expires_in: timedelta | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    exp = now + (expires_in if expires_in is not None else timedelta(minutes=settings.access_token_minutes))
    payload = {"sub": str(user_id), "sid": session_id, "iat": now, "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> Claims:
    """The user and session in a valid, unexpired token; raise InvalidToken otherwise."""
    try:
        payload = jwt.decode(
            token, get_settings().jwt_secret, algorithms=[_ALGORITHM], options={"require": ["sub", "sid", "exp"]}
        )
        return Claims(int(payload["sub"]), int(payload["sid"]))
    except (jwt.PyJWTError, ValueError, TypeError) as e:
        raise InvalidToken from e
