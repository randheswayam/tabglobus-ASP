"""Approval delegation (sprint v4). A user who holds an approval authority may lend it to another active staff user
for a date range; the delegate acts while the range covers today in the business timezone and the delegator
still holds the authority. The delegate acts in their own name; the audit also names the delegator."""

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import workflow_config as wc
from app.clock import business_date
from app.db import get_db
from app.deps import get_current_user, require_staff
from app.models import ApprovalDelegation, Role, User
from app.schemas import iso_utc, user_brief
from app.services import audit

router = APIRouter(tags=["delegation"], dependencies=[Depends(require_staff)])

REVIEW = "site_visit_review"
# Which roles hold each delegable authority.
AUTHORITY = {REVIEW: {Role.team_lead}}


def holds(user: User, scope: str) -> bool:
    return user.is_active and user.role in AUTHORITY[scope]


def is_active(d: ApprovalDelegation, today: date) -> bool:
    return d.start_date <= today <= d.end_date and holds(d.delegator, d.scope)


def active_delegation(db: Session, user: User, scope: str, now: datetime | None = None) -> ApprovalDelegation | None:
    today = business_date(now or datetime.now(UTC))
    rows = db.scalars(
        select(ApprovalDelegation)
        .where(ApprovalDelegation.delegate_id == user.id, ApprovalDelegation.scope == scope)
        .order_by(ApprovalDelegation.id)
    )
    return next((d for d in rows if is_active(d, today)), None)


class Authority:
    """Who is acting, and the delegation they act under (None when the authority is their own)."""

    def __init__(self, user: User, delegation: ApprovalDelegation | None):
        self.user, self.delegation = user, delegation

    @property
    def principal_user(self) -> User:
        return self.delegation.delegator if self.delegation else self.user

    def audit_detail(self) -> dict:
        if not self.delegation:
            return {}
        return {"on_behalf_of": user_brief(self.delegation.delegator), "delegation_id": self.delegation.id}


def require_reviewer(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Authority:
    if holds(user, REVIEW):
        return Authority(user, None)
    d = active_delegation(db, user, REVIEW)
    if d is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot perform this action")
    return Authority(user, d)


def delegation_out(d: ApprovalDelegation, today: date | None = None) -> dict:
    today = today or business_date(datetime.now(UTC))
    return {
        "id": d.id,
        "scope": d.scope,
        "delegator": user_brief(d.delegator),
        "delegate": user_brief(d.delegate),
        "start_date": d.start_date.isoformat(),
        "end_date": d.end_date.isoformat(),
        "reason": d.reason,
        "active": is_active(d, today),
        "created_at": iso_utc(d.created_at),
    }


class DelegationIn(BaseModel):
    delegate_id: int
    start_date: date
    end_date: date
    reason: str = Field(max_length=500)
    scope: str = REVIEW


@router.post("/delegations", status_code=status.HTTP_201_CREATED)
def create_delegation(
    body: DelegationIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    if body.scope not in AUTHORITY:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, {"message": "Unknown authority", "invalid": ["scope"]}
        )
    if not holds(user, body.scope):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delegate an authority you hold")
    delegate = db.get(User, body.delegate_id)
    missing, invalid = [], []
    if not body.reason.strip():
        missing.append("reason")
    if delegate is None or delegate.id == user.id or delegate.role == Role.client or not delegate.is_active:
        invalid.append("delegate_id")
    if body.end_date < body.start_date or (body.end_date - body.start_date).days + 1 > wc.DELEGATION_MAX_DAYS:
        invalid.append("end_date")
    if missing or invalid:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {
                "message": f"Delegate to another active staff member, with a reason, for at most "
                f"{wc.DELEGATION_MAX_DAYS} days",
                "missing": missing,
                "invalid": invalid,
            },
        )
    d = ApprovalDelegation(
        scope=body.scope,
        delegator_id=user.id,
        delegate_id=delegate.id,
        start_date=body.start_date,
        end_date=body.end_date,
        reason=body.reason.strip(),
    )
    db.add(d)
    db.flush()
    audit.record(
        db,
        user,
        "delegation.created",
        project_id=None,
        entity_type="delegation",
        entity_id=d.id,
        detail={
            "scope": d.scope,
            "delegate": user_brief(delegate),
            "start_date": d.start_date.isoformat(),
            "end_date": d.end_date.isoformat(),
        },
    )
    db.commit()
    db.refresh(d)
    return delegation_out(d)


@router.get("/delegations")
def list_delegations(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(ApprovalDelegation)
        .where(or_(ApprovalDelegation.delegator_id == user.id, ApprovalDelegation.delegate_id == user.id))
        .order_by(ApprovalDelegation.start_date.desc(), ApprovalDelegation.id.desc())
    )
    today = business_date(datetime.now(UTC))
    return [delegation_out(d, today) for d in rows]
