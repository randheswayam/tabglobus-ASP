from datetime import UTC, datetime, timedelta

import jwt

from app.config import get_settings

_ALGORITHM = "HS256"


class InvalidToken(Exception):
    pass


def create_access_token(user_id: int, expires_in: timedelta | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    exp = now + (expires_in if expires_in is not None else timedelta(minutes=settings.jwt_expire_minutes))
    payload = {"sub": str(user_id), "iat": now, "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> int:
    """Return the user id in a valid, unexpired token; raise InvalidToken otherwise."""
    try:
        payload = jwt.decode(
            token, get_settings().jwt_secret, algorithms=[_ALGORITHM], options={"require": ["sub", "exp"]}
        )
        return int(payload["sub"])
    except (jwt.PyJWTError, ValueError) as e:
        raise InvalidToken from e
