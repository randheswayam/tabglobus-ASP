"""finishing fee gate: add the 80% fee gate before the finishing package to every existing project.

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-28 12:00:00
"""

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | Sequence[str] | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen keys at this revision; migrations never import app code.
GATE, FINISHING, CIVIL = "finishing_fee_gate", "interiors_signoff", "civil_completion"
DONE = ("completed", "historical")


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(UTC)
    stages = sa.table(
        "project_stages",
        sa.column("project_id"),
        sa.column("key"),
        sa.column("status"),
        sa.column("started_at"),
        sa.column("historical_confirmed_by"),
        sa.column("historical_note"),
    )
    rows = bind.execute(
        sa.text("select project_id, key, status from project_stages where key in (:c, :f)"), {"c": CIVIL, "f": FINISHING}
    ).all()
    status = {(p, k): s for p, k, s in rows}
    projects = sorted({p for p, _, _ in rows})
    with_package = set(
        bind.execute(sa.text("select distinct project_id from signoff_requests where stage_key = :f"), {"f": FINISHING})
        .scalars()
        .all()
    )
    new_rows = []
    for pid in projects:
        finishing, civil = status.get((pid, FINISHING)), status.get((pid, CIVIL))
        row = {"project_id": pid, "key": GATE, "status": "locked", "started_at": None,
               "historical_confirmed_by": None, "historical_note": None}
        if finishing in DONE:
            # Already past the finishing package: the fee gate was passed before SiteFlow tracked it.
            row.update(status="historical", historical_confirmed_by="SiteFlow v4 migration",
                       historical_note="The finishing package was already signed off when the 80% fee gate was added.")
        elif civil in DONE:
            row.update(status="active", started_at=now)
            if finishing == "active" and pid not in with_package:
                # Nothing sent to the client yet: the finishing sign-off now waits for the fee gate.
                bind.execute(
                    sa.text("update project_stages set status = 'locked', started_at = null "
                            "where project_id = :p and key = :f"),
                    {"p": pid, "f": FINISHING},
                )
        new_rows.append(row)
    if new_rows:
        op.bulk_insert(stages, new_rows)


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "update project_stages set status = 'active' where key = :f and status = 'locked' and project_id in "
            "(select project_id from project_stages where key = :c and status in ('completed', 'historical'))"
        ),
        {"f": FINISHING, "c": CIVIL},
    )
    bind.execute(sa.text("delete from project_stages where key = :g"), {"g": GATE})
