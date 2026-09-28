"""flow versions

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-28 11:28:40.685804

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json
from datetime import datetime, timezone
from sqlalchemy.dialects import postgresql

# The flow as it stood when versioning began (sprint v4 Task 39): frozen here, never read from stage_config,
# so this migration gives the same version 1 whenever it runs.
FROZEN_V1 = json.loads(r'''{
 "phases": [
  {
   "number": 1,
   "name": "Initiation and requirements",
   "icon": "folder"
  },
  {
   "number": 2,
   "name": "Parallel pre-design",
   "icon": "hard_hat"
  },
  {
   "number": 3,
   "name": "Structural design",
   "icon": "gear"
  },
  {
   "number": 4,
   "name": "Design development and coordination",
   "icon": "house"
  },
  {
   "number": 5,
   "name": "Client approval and commercial gate",
   "icon": "check_badge"
  },
  {
   "number": 6,
   "name": "Detailed drawings",
   "icon": "sheet"
  },
  {
   "number": 7,
   "name": "Construction execution",
   "icon": "surveyor"
  },
  {
   "number": 8,
   "name": "Civil completion",
   "icon": "city"
  },
  {
   "number": 9,
   "name": "Finishing",
   "icon": "sofa"
  },
  {
   "number": 10,
   "name": "Handover",
   "icon": "key"
  }
 ],
 "stages": [
  {
   "key": "setup",
   "number": "1",
   "label": "Project setup",
   "phase": 1,
   "workstream": "Both",
   "owner_role": "architect",
   "predecessors": [],
   "gates": [],
   "evidence_required": [],
   "detail": "Project details, team assignment, initial timeline and budget.",
   "icon": "folder"
  },
  {
   "key": "discovery",
   "number": "2",
   "label": "Client discovery meetings",
   "phase": 1,
   "workstream": "Studio",
   "owner_role": "architect",
   "predecessors": [
    "setup"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Repeatable meetings: requirements, notes, photos and documents.",
   "icon": "people"
  },
  {
   "key": "baseline",
   "number": "3",
   "label": "Preliminary requirement baseline",
   "phase": 1,
   "workstream": "Studio",
   "owner_role": "architect",
   "predecessors": [
    "discovery"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Requirements document: scope, constraints and priorities.",
   "icon": "document"
  },
  {
   "key": "requirements_signoff",
   "number": "4",
   "label": "Client sign-off: preliminary requirements",
   "phase": 1,
   "workstream": "Studio",
   "owner_role": "client",
   "predecessors": [
    "baseline"
   ],
   "gates": [
    "client_signoff"
   ],
   "evidence_required": [],
   "detail": "Approval to proceed to design. Triggers the parallel workstreams.",
   "icon": "check_badge"
  },
  {
   "key": "predesign_site_visit",
   "number": null,
   "label": "Pre-design site visit",
   "phase": 2,
   "workstream": "Site",
   "owner_role": "civil_engineer",
   "predecessors": [
    "requirements_signoff"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Site conditions, photos and videos.",
   "icon": "hard_hat"
  },
  {
   "key": "investigations",
   "number": null,
   "label": "Investigations",
   "phase": 2,
   "workstream": "Site",
   "owner_role": "civil_engineer",
   "predecessors": [
    "predesign_site_visit"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Well, soil condition (black cotton soil), test pit (outstation).",
   "icon": "magnifier"
  },
  {
   "key": "concept",
   "number": null,
   "label": "Preliminary concept",
   "phase": 2,
   "workstream": "Studio",
   "owner_role": "architect",
   "predecessors": [
    "requirements_signoff"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Initial layouts and ideas.",
   "icon": "pencil"
  },
  {
   "key": "tentative_elevations",
   "number": null,
   "label": "Tentative elevations",
   "phase": 2,
   "workstream": "Studio",
   "owner_role": "architect",
   "predecessors": [
    "concept"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Not frozen, for discussion only.",
   "icon": "drafting"
  },
  {
   "key": "grid",
   "number": "5",
   "label": "Centerline, grid, foundation basis and column positions",
   "phase": 3,
   "workstream": "Studio",
   "owner_role": "architect",
   "predecessors": [
    "investigations",
    "tentative_elevations"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Based on site data and the preliminary design.",
   "icon": "ruler"
  },
  {
   "key": "grid_freeze",
   "number": "6",
   "label": "Architect and structural consultant freeze",
   "phase": 3,
   "workstream": "Studio",
   "owner_role": "team_lead",
   "predecessors": [
    "grid"
   ],
   "gates": [
    "finding_disposition"
   ],
   "evidence_required": [],
   "detail": "Centerline, foundation and column positions reviewed and signed off.",
   "icon": "people_check"
  },
  {
   "key": "structural_design",
   "number": "7",
   "label": "Structural design package",
   "phase": 3,
   "workstream": "Studio",
   "owner_role": "structural_consultant",
   "predecessors": [
    "grid_freeze"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Structural consultant: RCC design, foundation, columns and beams.",
   "icon": "gear"
  },
  {
   "key": "architectural_package",
   "number": "8A",
   "label": "Architectural package",
   "phase": 4,
   "workstream": "Studio",
   "owner_role": "architect",
   "predecessors": [
    "structural_design"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Architectural drawings, plans and elevations.",
   "icon": "house"
  },
  {
   "key": "structural_package",
   "number": "8B",
   "label": "Structural package",
   "phase": 4,
   "workstream": "Studio",
   "owner_role": "structural_consultant",
   "predecessors": [
    "structural_design"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Final structural drawings.",
   "icon": "frame"
  },
  {
   "key": "mep",
   "number": "9",
   "label": "MEP and coordination",
   "phase": 4,
   "workstream": "Studio",
   "owner_role": "mep_consultant",
   "predecessors": [
    "architectural_package",
    "structural_package"
   ],
   "gates": [
    "issue_closure"
   ],
   "evidence_required": [],
   "detail": "Electrical, plumbing and HVAC drawings; clash check across disciplines.",
   "icon": "pipes"
  },
  {
   "key": "elevations_package",
   "number": "10",
   "label": "All elevations package",
   "phase": 4,
   "workstream": "Studio",
   "owner_role": "architect",
   "predecessors": [
    "mep"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Final elevations (all sides), materials and finishes, optional 3D views.",
   "icon": "building"
  },
  {
   "key": "design_freeze_signoff",
   "number": "11",
   "label": "Client sign-off: design freeze",
   "phase": 5,
   "workstream": "Studio",
   "owner_role": "client",
   "predecessors": [
    "elevations_package"
   ],
   "gates": [
    "client_signoff"
   ],
   "evidence_required": [],
   "detail": "Approval of all elevations. Changes after this stage are costly.",
   "icon": "check_badge"
  },
  {
   "key": "payment_gate",
   "number": "12",
   "label": "50% upfront gate",
   "phase": 5,
   "workstream": "Both",
   "owner_role": "accounts",
   "predecessors": [
    "design_freeze_signoff"
   ],
   "gates": [
    "payment"
   ],
   "evidence_required": [],
   "detail": "Payment milestone cleared before detailed drawings.",
   "icon": "card"
  },
  {
   "key": "detailed_drawings",
   "number": "13",
   "label": "Detailed drawings and controlled issue",
   "phase": 6,
   "workstream": "Studio",
   "owner_role": "architect",
   "predecessors": [
    "payment_gate"
   ],
   "gates": [
    "document_status"
   ],
   "evidence_required": [],
   "detail": "Detailed architectural, structural and MEP drawings, issued with version control.",
   "icon": "sheet"
  },
  {
   "key": "line_out",
   "number": "14",
   "label": "Site line-out",
   "phase": 7,
   "workstream": "Site",
   "owner_role": "civil_engineer",
   "predecessors": [
    "detailed_drawings"
   ],
   "gates": [
    "legal_approval"
   ],
   "evidence_required": [],
   "detail": "Site marking and verification as per approved drawings.",
   "icon": "surveyor"
  },
  {
   "key": "construction",
   "number": "15",
   "label": "Construction quality stages",
   "phase": 7,
   "workstream": "Site",
   "owner_role": "civil_engineer",
   "predecessors": [
    "line_out"
   ],
   "gates": [],
   "evidence_required": [],
   "detail": "Site visits with checklists, photos, review and derived progress.",
   "icon": "clipboard"
  },
  {
   "key": "civil_completion",
   "number": "16",
   "label": "Civil completion",
   "phase": 8,
   "workstream": "Site",
   "owner_role": "team_lead",
   "predecessors": [
    "construction"
   ],
   "gates": [
    "no_open_major_problems",
    "checklist"
   ],
   "evidence_required": [],
   "detail": "Civil completion checklist and quality sign-off; ready for interiors.",
   "icon": "city"
  },
  {
   "key": "finishing_fee_gate",
   "number": null,
   "label": "80% fee gate",
   "phase": 9,
   "workstream": "Both",
   "owner_role": "accounts",
   "predecessors": [
    "civil_completion"
   ],
   "gates": [
    "payment"
   ],
   "evidence_required": [],
   "detail": "80% of fees collected before the finishing package",
   "icon": "card"
  },
  {
   "key": "interiors_signoff",
   "number": "17",
   "label": "Client sign-off: finishing package (tile and material selection)",
   "phase": 9,
   "workstream": "Both",
   "owner_role": "client",
   "predecessors": [
    "finishing_fee_gate"
   ],
   "gates": [
    "client_signoff"
   ],
   "evidence_required": [],
   "detail": "Finishing package: material, tile and fixture selection approvals",
   "icon": "sofa"
  },
  {
   "key": "handover_signoff",
   "number": "18",
   "label": "Client sign-off: handover and closeout",
   "phase": 10,
   "workstream": "Both",
   "owner_role": "client",
   "predecessors": [
    "interiors_signoff"
   ],
   "gates": [
    "client_signoff"
   ],
   "evidence_required": [],
   "detail": "Final inspection, snag list and handover documents.",
   "icon": "key"
  }
 ]
}''')


# revision identifiers, used by Alembic.
revision: str = '0022'
down_revision: Union[str, Sequence[str], None] = '0021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('flow_versions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('number', sa.Integer(), nullable=False),
    sa.Column('snapshot', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('number')
    )
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('flow_version_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_projects_flow_version', 'flow_versions', ['flow_version_id'], ['id'])

    # ### end Alembic commands ###
    versions = sa.table(
        'flow_versions',
        sa.column('id', sa.Integer()),
        sa.column('number', sa.Integer()),
        sa.column('snapshot', sa.JSON()),
        sa.column('created_at', sa.DateTime(timezone=True)),
    )
    op.bulk_insert(versions, [{'id': 1, 'number': 1, 'snapshot': FROZEN_V1, 'created_at': datetime.now(timezone.utc)}])
    op.execute("UPDATE projects SET flow_version_id = 1")
    if op.get_bind().dialect.name == 'postgresql':
        op.execute("SELECT setval(pg_get_serial_sequence('flow_versions', 'id'), 1)")


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_constraint('fk_projects_flow_version', type_='foreignkey')
        batch_op.drop_column('flow_version_id')

    op.drop_table('flow_versions')
    # ### end Alembic commands ###
