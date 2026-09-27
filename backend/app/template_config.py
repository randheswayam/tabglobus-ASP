"""Fixed residential template for the SiteFlow MVP.

Values marked TBD_PARVEZ are pending Parvez's sign-off (decisions D2 and D3 in the
implementation plan). Change them here; no code changes are needed elsewhere.
"""

TEMPLATE_ID = "residential"
TEMPLATE_VERSION = 1

WORKFLOW_STEPS = ["Legal Approval", "Site Visit", "Team Lead Review"]

LEGAL_STATUSES = ["Not started", "Applied", "Approved", "Rejected"]

# TBD_PARVEZ: pending Parvez (D2/D3). Stage weights are an equal split and must sum to 100.
# TBD_PARVEZ: pending Parvez (D2/D3). Checklist items are drafts for the P1 workshop.
STAGES = [
    {
        "name": "Foundation",
        "weight": 12.5,
        "checklist": [
            {"id": "fdn-excavation", "label": "Excavation to drawing depth"},
            {"id": "fdn-pcc", "label": "PCC bed laid"},
            {"id": "fdn-footing-rebar", "label": "Footing reinforcement checked"},
            {"id": "fdn-footing-concrete", "label": "Footing concrete poured"},
        ],
    },
    {
        "name": "Plinth",
        "weight": 12.5,
        "checklist": [
            {"id": "pln-beam", "label": "Plinth beam cast"},
            {"id": "pln-filling", "label": "Plinth filling and compaction"},
            {"id": "pln-dpc", "label": "Damp proof course laid"},
        ],
    },
    {
        "name": "Superstructure",
        "weight": 12.5,
        "checklist": [
            {"id": "sup-columns", "label": "Columns cast"},
            {"id": "sup-beams", "label": "Beams cast"},
            {"id": "sup-slab", "label": "Slab cast"},
            {"id": "sup-curing", "label": "Curing completed"},
        ],
    },
    {
        "name": "Masonry",
        "weight": 12.5,
        "checklist": [
            {"id": "msn-walls", "label": "External walls built"},
            {"id": "msn-partitions", "label": "Internal partitions built"},
            {"id": "msn-lintels", "label": "Lintels and sills cast"},
        ],
    },
    {
        "name": "Plastering",
        "weight": 12.5,
        "checklist": [
            {"id": "pls-internal", "label": "Internal plaster"},
            {"id": "pls-external", "label": "External plaster"},
        ],
    },
    {
        "name": "Services",
        "weight": 12.5,
        "checklist": [
            {"id": "svc-plumbing", "label": "Plumbing lines laid"},
            {"id": "svc-electrical", "label": "Electrical conduits and wiring"},
            {"id": "svc-testing", "label": "Pressure and circuit tests"},
        ],
    },
    {
        "name": "Finishes",
        "weight": 12.5,
        "checklist": [
            {"id": "fin-flooring", "label": "Flooring and tiling"},
            {"id": "fin-doors-windows", "label": "Doors and windows fixed"},
            {"id": "fin-painting", "label": "Painting"},
            {"id": "fin-fixtures", "label": "Fixtures installed"},
        ],
    },
    {
        "name": "Handover",
        "weight": 12.5,
        "checklist": [
            {"id": "hnd-snag", "label": "Snag list closed"},
            {"id": "hnd-cleaning", "label": "Site cleaned"},
            {"id": "hnd-documents", "label": "Handover documents ready"},
        ],
    },
]

CHECKLIST_STATES = ["Done", "In progress", "Not started"]

# Draft list from plan section 4, for Parvez to confirm.
PROBLEMS = {
    "Structural": [
        "Crack in beam, column or slab",
        "Honeycombing in concrete",
        "Rebar spacing or cover not per drawing",
        "Formwork misalignment",
    ],
    "Quality": [
        "Poor curing",
        "Plaster hollowness",
        "Level or plumb deviation",
        "Brickwork joint issues",
    ],
    "Water": [
        "Seepage or dampness",
        "Waterproofing defect",
        "Drainage slope issue",
    ],
    "Site": [
        "Material shortage",
        "Labour shortage",
        "Equipment breakdown",
        "Deviation from approved drawing",
    ],
    "Safety": [
        "Missing barricading",
        "No safety gear in use",
        "Unsafe scaffolding",
    ],
    "Other": [],  # free text, flagged for Parvez
}

SEVERITIES = ["Low", "Medium", "High", "Critical"]

# TBD_PARVEZ: pending Parvez (D2/D3). Enforced once media capture ships (v2).
MIN_PHOTOS = 5
