"""The standing instructions point at documents that exist, and the module package for new domain code is in place."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_claude_md_references_existing_docs():
    text = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    for doc in ["docs/SiteFlow-PRD-v3.2.md", "docs/SiteFlow-PRD-V4.md", "docs/IMPLEMENTATION_PLAN.md",
                "docs/V4_IMPLEMENTATION_PLAN.md", "docs/V4_EXECUTION_PLAN.md"]:
        assert doc in text, doc
    for ref in set(re.findall(r"`(docs/[^`*]+\.md)`", text)):
        assert (ROOT / ref).exists(), ref


def test_claude_md_carries_the_v4_rules():
    text = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    assert "## V4 integration and AI rules" in text
    assert "11.4A" in text and "AI Prohibited" in text


def test_module_layout_decision_and_package():
    assert (ROOT / "docs/decisions/0003-module-layout.md").exists()
    import app.modules  # noqa: F401
