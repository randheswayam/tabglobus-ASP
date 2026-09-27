from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.auth import InvalidToken, decode_access_token
from app.db import get_db
from app.models import Project, ProjectMember, Role, User

_bearer = HTTPBearer(auto_error=False)

# Roles that see every project (plan section 3). Everyone else sees member projects only.
ALL_PROJECTS_ROLES = {Role.architect, Role.team_lead}


def _unauthorized() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated",
                         headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise _unauthorized()
    try:
        user_id = decode_access_token(creds.credentials)
    except InvalidToken:
        raise _unauthorized()
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _unauthorized()
    return user


def require_role(*roles: Role):
    allowed = set(roles)

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot perform this action")
        return user

    return _check


def visible_projects(user: User) -> Select:
    """Select statement for the projects this user may see."""
    stmt = select(Project).order_by(Project.id)
    if user.role in ALL_PROJECTS_ROLES:
        return stmt
    return stmt.where(Project.id.in_(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)))
