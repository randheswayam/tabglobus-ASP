"""Workflow timing, red flag thresholds and media limits for the SiteFlow MVP.

Values marked TBD_PARVEZ are pending Parvez's decisions (D3 media limits, D4 review SLA,
D5 red flag thresholds). Change them here; no code changes are needed elsewhere.
"""

# The office calendar day for deadlines and date filters (Pune).
BUSINESS_TIMEZONE = "Asia/Kolkata"

# TBD_PARVEZ: pending Parvez (D4). A submitted visit waiting longer than this raises "Review overdue".
REVIEW_SLA_HOURS = 48

# TBD_PARVEZ: pending Parvez (D5). No approved visit for this long raises "No recent visit".
VISIT_INTERVAL_DAYS = 14

# From the plan: the same visit sent back this many times raises "Repeated rework".
REWORK_LIMIT = 2

# TBD_PARVEZ: pending Parvez (D3). Upload size limits.
MAX_PHOTO_MB = 10
MAX_VIDEO_MB = 100

# Red flag rules (plan section 5.3). rank orders the "Needs Architect Attention" list: higher first.
RED_FLAG_RULES = {
    "critical_issue": {"label": "Critical issue", "rank": 5},
    "overdue_fix": {"label": "Overdue fix", "rank": 4},
    "review_overdue": {"label": "Review overdue", "rank": 3},
    "repeated_rework": {"label": "Repeated rework", "rank": 3},
    "legal_delay": {"label": "Legal delay", "rank": 2},
    "no_recent_visit": {"label": "No recent visit", "rank": 1},
    "client_decision_overdue": {"label": "Client decision overdue", "rank": 4},
}

PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]
VIDEO_TYPES = ["video/mp4", "video/webm"]

# ---------- client sign-off and the customer app (sprint v3) ----------

# Shown beside the project's fee basis field. TBD_PARVEZ (D-05): the basis of fee percentages is still open.
FEE_BASIS_HELP = (
    "What the fee percentages are calculated on, for example the total fee or a stage fee. "
    "Still to be decided by Parvez (D-05)."
)

# TBD_PARVEZ: who may record an exception that passes a placeholder gate (payment, findings, drawings...).
EXCEPTION_ROLES = ["admin", "team_lead"]

# TBD_PARVEZ: a sent sign-off request older than this raises "Client decision overdue".
CLIENT_SIGNOFF_SLA_DAYS = 7

# TBD_PARVEZ: how long a client invite code stays valid.
INVITE_CODE_TTL_DAYS = 7

# Wrong codes allowed before an invite locks (security default; not a business rule).
INVITE_MAX_ATTEMPTS = 5

# Files a sign-off package may carry, and their size limit.
SIGNOFF_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
# TBD_PARVEZ: size limit for a drawing or document in a sign-off package.
MAX_SIGNOFF_ATTACHMENT_MB = 20

# TBD_PARVEZ: wording the client confirms when signing off; needs legal review before the pilot.
SIGNOFF_CONFIRMATION_TEXT = (
    "I have reviewed every document in this package and I approve this version on behalf of the client."
)

# TBD_PARVEZ: size limit per kind of file attached when completing a stage. Photo, video and document reuse
# the photo, video and sign-off limits; the AutoCAD limit is a placeholder until Parvez sets it.
MAX_STAGE_ATTACHMENT_MB = {
    "photo": MAX_PHOTO_MB,
    "video": MAX_VIDEO_MB,
    "document": MAX_SIGNOFF_ATTACHMENT_MB,
    "cad": 50,
}

# TBD_PARVEZ: days a stage may stay open before the dashboard shows it as Delayed, per stage key. Empty: the rule
# is off, and Delayed comes only from red flags. No day counts are assumed.
STAGE_DELAYED_AFTER_DAYS: dict[str, int] = {}

# Fee gates. Supplied by TAN GLOBUS AI on 28 September 2026; confirm with Parvez.
# TBD_PARVEZ (D-05): the basis of these percentages (total fee, stage fee or another basis) is still open.
UPFRONT_FEE_PERCENT = 50  # before detailed drawings (stage 12)
FINISHING_FEE_PERCENT = 80  # before the finishing package (tile and material selection)

# TBD_PARVEZ: size limit for the project image (a render or screenshot of the 3D model). Placeholder: the photo limit.
MAX_PROJECT_IMAGE_MB = MAX_PHOTO_MB

# Principal overview (sprint v4 Task 34).
# TBD_PARVEZ (V4-D03): weight of each stage in the overall completion %. Empty means every stage weighs 1;
# a stage missing from a non-empty map also weighs 1.
OVERALL_COMPLETION_WEIGHTS: dict[str, float] = {}
# TBD_PARVEZ: the stages the principal tracks as major milestones: the four client sign-offs, the 50% and 80%
# fee gates, Site line-out and civil completion. Shown in flow order.
MAJOR_MILESTONES = [
    "requirements_signoff",
    "design_freeze_signoff",
    "payment_gate",
    "line_out",
    "civil_completion",
    "finishing_fee_gate",
    "interiors_signoff",
    "handover_signoff",
]
# TBD_PARVEZ: how many days a resolved major issue stays on the overview with its resolution note.
RESOLVED_ISSUES_DAYS = 30

# TBD_PARVEZ: how long an Admin-issued password reset token stays valid (sprint v4 Task 36).
PASSWORD_RESET_TTL_HOURS = 24
