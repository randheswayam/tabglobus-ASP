"""The residential project flow from the architect's workflow diagram (docs/reference/workflow-diagram.jpeg),
PRD v3.1 section 7.1. Eighteen numbered stages (8 is split into 8A and 8B) and four pre-design activities
that run as two parallel workstreams, grouped into ten phases.

A stage is ready when all its predecessors are completed (or historical, for projects onboarded mid-way).
Gates add a condition on top:
  client_signoff          completes only when the client approves the exact sign-off package version
  legal_approval          Legal Approval must be Approved (D-01: assumed to gate Site line-out; TBD_PARVEZ)
  no_open_major_problems  no open High or Critical problems (PRD 7.15: open critical issues equal zero)

Owner roles use the roles that exist today. Structural Consultant, MEP, Interior Designer and Accounts
(PRD section 5) arrive in a later sprint; until then an Architect, Team Lead or Admin records their stages.
"""

PHASES = [
    {"number": 1, "name": "Initiation and requirements"},
    {"number": 2, "name": "Parallel pre-design"},
    {"number": 3, "name": "Structural design"},
    {"number": 4, "name": "Design development and coordination"},
    {"number": 5, "name": "Client approval and commercial gate"},
    {"number": 6, "name": "Detailed drawings"},
    {"number": 7, "name": "Construction execution"},
    {"number": 8, "name": "Civil completion"},
    {"number": 9, "name": "Interiors"},
    {"number": 10, "name": "Handover"},
]


def _stage(key, number, label, phase, workstream, owner, predecessors, gate=None, detail=""):
    return {"key": key, "number": number, "label": label, "phase": phase, "workstream": workstream,
            "owner_role": owner, "predecessors": predecessors, "gate": gate, "detail": detail}


STAGES = [
    _stage("setup", "1", "Project setup", 1, "Both", "architect", [],
           detail="Project details, team assignment, initial timeline and budget."),
    _stage("discovery", "2", "Client discovery meetings", 1, "Studio", "architect", ["setup"],
           detail="Repeatable meetings: requirements, notes, photos and documents."),
    _stage("baseline", "3", "Preliminary requirement baseline", 1, "Studio", "architect", ["discovery"],
           detail="Requirements document: scope, constraints and priorities."),
    _stage("requirements_signoff", "4", "Client sign-off: preliminary requirements", 1, "Studio", "client",
           ["baseline"], gate="client_signoff", detail="Approval to proceed to design. Triggers the parallel workstreams."),

    _stage("predesign_site_visit", None, "Pre-design site visit", 2, "Site", "civil_engineer", ["requirements_signoff"],
           detail="Site conditions, photos and videos."),
    _stage("investigations", None, "Investigations", 2, "Site", "civil_engineer", ["predesign_site_visit"],
           detail="Well, soil condition (black cotton soil), test pit (outstation)."),
    _stage("concept", None, "Preliminary concept", 2, "Studio", "architect", ["requirements_signoff"],
           detail="Initial layouts and ideas."),
    _stage("tentative_elevations", None, "Tentative elevations", 2, "Studio", "architect", ["concept"],
           detail="Not frozen, for discussion only."),

    _stage("grid", "5", "Centerline, grid, foundation basis and column positions", 3, "Studio", "architect",
           ["investigations", "tentative_elevations"], detail="Based on site data and the preliminary design."),
    _stage("grid_freeze", "6", "Architect and structural consultant freeze", 3, "Studio", "team_lead", ["grid"],
           detail="Centerline, foundation and column positions reviewed and signed off."),
    _stage("structural_design", "7", "Structural design package", 3, "Studio", "architect", ["grid_freeze"],
           detail="Structural consultant: RCC design, foundation, columns and beams."),

    _stage("architectural_package", "8A", "Architectural package", 4, "Studio", "architect", ["structural_design"],
           detail="Architectural drawings, plans and elevations."),
    _stage("structural_package", "8B", "Structural package", 4, "Studio", "architect", ["structural_design"],
           detail="Final structural drawings."),
    _stage("mep", "9", "MEP and coordination", 4, "Studio", "architect", ["architectural_package", "structural_package"],
           detail="Electrical, plumbing and HVAC drawings; clash check across disciplines."),
    _stage("elevations_package", "10", "All elevations package", 4, "Studio", "architect", ["mep"],
           detail="Final elevations (all sides), materials and finishes, optional 3D views."),

    _stage("design_freeze_signoff", "11", "Client sign-off: design freeze", 5, "Studio", "client", ["elevations_package"],
           gate="client_signoff", detail="Approval of all elevations. Changes after this stage are costly."),
    # TBD_PARVEZ (D-05): whether the 50% is on the total fee, the stage fee or another basis.
    _stage("payment_gate", "12", "50% upfront gate", 5, "Both", "admin", ["design_freeze_signoff"],
           detail="Payment milestone cleared before detailed drawings."),

    _stage("detailed_drawings", "13", "Detailed drawings and controlled issue", 6, "Studio", "architect", ["payment_gate"],
           detail="Detailed architectural, structural and MEP drawings, issued with version control."),

    _stage("line_out", "14", "Site line-out", 7, "Site", "civil_engineer", ["detailed_drawings"], gate="legal_approval",
           detail="Site marking and verification as per approved drawings."),
    _stage("construction", "15", "Construction quality stages", 7, "Site", "civil_engineer", ["line_out"],
           detail="Site visits with checklists, photos, review and derived progress."),

    _stage("civil_completion", "16", "Civil completion", 8, "Site", "team_lead", ["construction"],
           gate="no_open_major_problems", detail="Civil completion checklist and quality sign-off; ready for interiors."),

    _stage("interiors_signoff", "17", "Client sign-off: interiors and tile selection", 9, "Both", "client",
           ["civil_completion"], gate="client_signoff", detail="Material and tile selection approvals."),

    _stage("handover_signoff", "18", "Client sign-off: handover and closeout", 10, "Both", "client",
           ["interiors_signoff"], gate="client_signoff", detail="Final inspection, snag list and handover documents."),
]

SIGNOFF_STAGES = [s["key"] for s in STAGES if s["gate"] == "client_signoff"]
CONSTRUCTION_START = "line_out"
BY_KEY = {s["key"]: s for s in STAGES}
