"""Configuration values for v3, and the TBD_PARVEZ marker convention from CLAUDE.md."""

from pathlib import Path

from app import workflow_config as wc

APP = Path(__file__).resolve().parents[1] / "app"


def test_client_signoff_config_exists():
    assert isinstance(wc.CLIENT_SIGNOFF_SLA_DAYS, int) and wc.CLIENT_SIGNOFF_SLA_DAYS > 0
    assert isinstance(wc.INVITE_CODE_TTL_DAYS, int) and wc.INVITE_CODE_TTL_DAYS > 0
    assert isinstance(wc.INVITE_MAX_ATTEMPTS, int) and wc.INVITE_MAX_ATTEMPTS > 0
    assert set(wc.SIGNOFF_ATTACHMENT_TYPES) == {"application/pdf", "image/jpeg", "image/png", "image/webp"}
    assert wc.MAX_SIGNOFF_ATTACHMENT_MB > 0
    assert wc.SIGNOFF_CONFIRMATION_TEXT.strip()


def test_undecided_values_use_the_tbd_parvez_marker():
    sources = {p.name: p.read_text(encoding="utf-8") for p in APP.glob("*_config.py")}
    assert all("PLACEHOLDER" not in text for text in sources.values())
    for name in (
        "REVIEW_SLA_HOURS",
        "VISIT_INTERVAL_DAYS",
        "MAX_PHOTO_MB",
        "CLIENT_SIGNOFF_SLA_DAYS",
        "INVITE_CODE_TTL_DAYS",
        "SIGNOFF_CONFIRMATION_TEXT",
    ):
        line = next(i for i, src in enumerate(sources["workflow_config.py"].splitlines()) if src.startswith(name))
        context = "\n".join(sources["workflow_config.py"].splitlines()[max(0, line - 3) : line])
        assert "TBD_PARVEZ" in context, name
    assert "TBD_PARVEZ" in sources["template_config.py"]
