"""Workflow timing, red flag thresholds and media limits for the SiteFlow MVP.

Values marked PLACEHOLDER are pending Parvez's decisions (D3 media limits, D4 review SLA,
D5 red flag thresholds). Change them here; no code changes are needed elsewhere.
"""

# PLACEHOLDER: pending Parvez (D4). A submitted visit waiting longer than this raises "Review overdue".
REVIEW_SLA_HOURS = 48

# PLACEHOLDER: pending Parvez (D5). No approved visit for this long raises "No recent visit".
VISIT_INTERVAL_DAYS = 14

# From the plan: the same visit sent back this many times raises "Repeated rework".
REWORK_LIMIT = 2

# PLACEHOLDER: pending Parvez (D3). Upload size limits.
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
}

PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]
VIDEO_TYPES = ["video/mp4", "video/webm"]
