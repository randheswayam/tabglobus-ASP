from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.auth import InvalidToken, decode_access_token
from app.db import get_db
from app.models import Project, ProjectMember, Role, User, UserSession
from app.modules.identity.sessions import is_live

_bearer = HTTPBearer(auto_error=False)

# Roles that see every project (plan section 3). Everyone else sees member projects only.
ALL_PROJECTS_ROLES = {Role.architect, Role.team_lead}


def _unauthorized() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise _unauthorized()
    try:
        claims = decode_access_token(creds.credentials)
    except InvalidToken:
        raise _unauthorized() from None
    session = db.get(UserSession, claims.session_id)
    if not is_live(session) or session.user_id != claims.user_id:
        raise _unauthorized()
    user = db.get(User, claims.user_id)
    if user is None or not user.is_active:
        raise _unauthorized()
    request.state.session_id = session.id  # for sign-out of this device
    return user


def require_staff(user: User = Depends(get_current_user)) -> User:
    """Router-level guard for every staff API. Clients use /client/* only."""
    if user.role == Role.client:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "This area is for the SiteFlow team. Clients use the client app."
        )
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
    return stmt.where(Project.id.in_(select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)))


def get_visible_project(
    project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Project:
    """The project, or 404 when it doesn't exist or the user may not see it (no existence leak)."""
    project = db.scalars(visible_projects(user).where(Project.id == project_id)).first()
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project
