"""Derived project progress (plan section 4, Step 2). Progress is calculated, never typed in.

stage progress   = Done items ÷ items in the stage
project progress = Σ stage weight × stage progress

A visit records the checklist for its current stage only, so stages before it count as
complete and stages after it as zero. This reading is pending Parvez's confirmation (D2).
"""

from decimal import ROUND_HALF_UP, Decimal

from app import template_config as tc


def derive_progress(current_stage: str, checklist_states: dict[str, str], config: list[dict] | None = None) -> float:
    stages = tc.STAGES if config is None else config
    if abs(sum(s["weight"] for s in stages) - 100) > 1e-9:
        raise ValueError("Stage weights must sum to 100")

    names = [s["name"] for s in stages]
    if current_stage not in names:
        raise ValueError(f"Unknown stage: {current_stage!r}")
    idx = names.index(current_stage)
    stage = stages[idx]

    item_ids = {i["id"] for i in stage["checklist"]}
    unknown = set(checklist_states) - item_ids
    if unknown:
        raise ValueError(f"Items not in stage {current_stage!r}: {', '.join(sorted(unknown))}")
    bad = {k: v for k, v in checklist_states.items() if v not in tc.CHECKLIST_STATES}
    if bad:
        raise ValueError(f"Invalid checklist state for {', '.join(sorted(bad))}")

    done = sum(1 for i in item_ids if checklist_states.get(i) == "Done")
    total = sum((Decimal(str(s["weight"])) for s in stages[:idx]), Decimal(0))
    total += Decimal(str(stage["weight"])) * Decimal(done) / Decimal(len(item_ids))
    return float(total.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
