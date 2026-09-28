"""The project fee plan: contract value, currency, fee basis and notes. Commercial data: read and set only by the
roles allowed here. Fee milestones, requests and payments come later (S10 and V12)."""

from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_visible_project, require_role, require_staff
from app.models import Project, Role, User
from app.services import audit

router = APIRouter(tags=["fee plan"], dependencies=[Depends(require_staff)])
EDITORS = (Role.architect, Role.admin, Role.accounts)
READERS = (*EDITORS, Role.team_lead)


def fee_plan_out(p: Project) -> dict:
    return {
        "contract_value": None if p.contract_value is None else f"{Decimal(p.contract_value):.2f}",
        "currency": p.currency or "INR",
        "fee_basis": p.fee_basis,
        "fee_notes": p.fee_notes,
    }


class FeePlanIn(BaseModel):
    contract_value: Decimal | None = Field(None, ge=0, max_digits=14, decimal_places=2)
    currency: str | None = None
    fee_basis: str | None = Field(None, max_length=200)
    fee_notes: str | None = None

    @field_validator("currency")
    @classmethod
    def _currency(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().upper()
        if len(v) != 3 or not v.isalpha():
            raise ValueError("must be a 3-letter currency code, such as INR")
        return v


@router.get("/projects/{project_id}/fee-plan")
def get_fee_plan(_: User = Depends(require_role(*READERS)), project: Project = Depends(get_visible_project)) -> dict:
    return fee_plan_out(project)


@router.patch("/projects/{project_id}/fee-plan")
def update_fee_plan(
    body: FeePlanIn,
    user: User = Depends(require_role(*EDITORS)),
    project: Project = Depends(get_visible_project),
    db: Session = Depends(get_db),
) -> dict:
    new = body.model_dump(exclude_unset=True)
    for k in ("fee_basis", "fee_notes"):
        if k in new and isinstance(new[k], str):
            new[k] = new[k].strip() or None
    if "contract_value" in new and new["contract_value"] is not None:
        new["contract_value"] = new["contract_value"].quantize(Decimal("0.01"))
    if new.get("currency") is None:
        new.pop("currency", None)
    before = fee_plan_out(project)
    for k, v in new.items():
        setattr(project, k, v)
    after = fee_plan_out(project)
    changes = {k: [before[k], after[k]] for k in after if before[k] != after[k]}
    if not changes:
        return after
    audit.record(
        db,
        user,
        "fee_plan.updated",
        project_id=project.id,
        entity_type="project",
        entity_id=project.id,
        changes=changes,
    )
    db.commit()
    return fee_plan_out(project)
