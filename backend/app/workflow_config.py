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
