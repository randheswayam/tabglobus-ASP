"""Interim fee ledger: client fees due and received per project. Only Accounts and the principal architect read or
record it; nothing from it appears in any other response. Entries are append-only."""

from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, get_visible_project, require_staff
from app.models import FeeEntry, Project, Role, User
from app.schemas import iso_utc, user_brief
from app.services import audit

router = APIRouter(tags=["fees"], dependencies=[Depends(require_staff)])


def may_use_fees(user: User) -> bool:
    return user.role == Role.accounts or bool(user.is_principal)


def _guard(user: User) -> None:
    if not may_use_fees(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Accounts and the principal architect see client fees")


def _money(v: Decimal) -> str:
    return f"{Decimal(v):.2f}"


def entry_out(e: FeeEntry) -> dict:
    return {
        "id": e.id,
        "kind": e.kind,
        "amount": _money(e.amount),
        "currency": e.currency,
        "date": e.date.isoformat(),
        "reference": e.reference,
        "note": e.note,
        "recorded_by": user_brief(e.recorded_by),
        "recorded_at": iso_utc(e.recorded_at),
    }


def totals(db: Session, project: Project) -> dict:
    due = received = Decimal("0")
    for e in db.scalars(select(FeeEntry).where(FeeEntry.project_id == project.id)):
        if e.kind == "due":
            due += e.amount
        else:
            received += e.amount
    return {
        "due": _money(due),
        "received": _money(received),
        "outstanding": _money(due - received),
        "currency": project.currency or "INR",
    }


class FeeIn(BaseModel):
    kind: Literal["due", "received"]
    amount: Decimal = Field(max_digits=14, decimal_places=2)
    date: date
    reference: str | None = Field(None, max_length=120)
    note: str | None = None


@router.get("/projects/{project_id}/fees")
def list_fees(
    user: User = Depends(get_current_user),
    project: Project = Depends(get_visible_project),
    db: Session = Depends(get_db),
) -> dict:
    _guard(user)
    rows = db.scalars(select(FeeEntry).where(FeeEntry.project_id == project.id).order_by(FeeEntry.date, FeeEntry.id))
    return {"entries": [entry_out(e) for e in rows], "totals": totals(db, project)}


@router.post("/projects/{project_id}/fees", status_code=status.HTTP_201_CREATED)
def record_fee(
    body: FeeIn,
    user: User = Depends(get_current_user),
    project: Project = Depends(get_visible_project),
    db: Session = Depends(get_db),
) -> dict:
    _guard(user)
    reference, note = (body.reference or "").strip() or None, (body.note or "").strip() or None
    missing, invalid = [], []
    if body.amount == 0:
        invalid.append("amount")
    if body.amount < 0 and not note:
        missing.append("note")  # a correction says why
    if body.kind == "received" and not reference:
        missing.append("reference")
    if missing or invalid:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {
                "message": "Give an amount above 0 (a correction is negative with a reason), and a reference for money "
                "received",
                "missing": missing,
                "invalid": invalid,
            },
        )
    e = FeeEntry(
        project_id=project.id,
        kind=body.kind,
        amount=body.amount.quantize(Decimal("0.01")),
        currency=project.currency or "INR",
        date=body.date,
        reference=reference,
        note=note,
        recorded_by_id=user.id,
    )
    db.add(e)
    db.flush()
    # The audit trail is visible to the project team, so it names the entry without its amount.
    audit.record(
        db,
        user,
        "fee.recorded",
        project_id=project.id,
        entity_type="fee_entry",
        entity_id=e.id,
        detail={"kind": body.kind, "correction": body.amount < 0},
    )
    db.commit()
    db.refresh(e)
    return entry_out(e)
