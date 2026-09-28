"""GET /principal/overview: for each project, overall completion, client fees, major milestones and major issues,
with portfolio totals. Guarded by require_principal; nobody else, Admin included, reads it."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app import workflow_config as wc
from app.clock import business_date
from app.db import get_db
from app.deps import require_principal, require_staff, visible_projects
from app.models import Problem, ProblemStatus, Project, SiteVisit, User
from app.modules.fees.ledger import totals as fee_totals
from app.modules.projects.image import image_out
from app.modules.workflow.health import project_health
from app.schemas import iso_utc, user_brief
from app.services import stages
from app.services.red_flags import sync_red_flags

router = APIRouter(tags=["principal"], dependencies=[Depends(require_staff)])

MAJOR = ("Critical", "High")


def _weight(key: str) -> float:
    return wc.OVERALL_COMPLETION_WEIGHTS.get(key, 1)


def completion(project: Project, rows: dict) -> dict:
    """Stages completed or historical out of all stages, weighted by OVERALL_COMPLETION_WEIGHTS. The construction
    progress from approved visits is reported beside it, not mixed in."""
    done = [s["key"] for s in sc.STAGES if s["key"] in rows and rows[s["key"]].status.value in stages.DONE]
    total = sum(_weight(s["key"]) for s in sc.STAGES)
    return {
        "percent": round(100 * sum(_weight(k) for k in done) / total, 1) if total else 0.0,
        "stages_done": len(done),
        "stages_total": len(sc.STAGES),
        "construction_progress": project.official_progress,
    }


def milestones(rows: dict, health: dict | None) -> list[dict]:
    by_key = {s["key"]: s for p in (health or {}).get("phases", []) for s in p["stages"]}
    out = []
    for s in sc.STAGES:
        if s["key"] not in wc.MAJOR_MILESTONES:
            continue
        h, row = by_key.get(s["key"], {}), rows.get(s["key"])
        out.append(
            {
                "key": s["key"],
                "number": s["number"],
                "label": s["label"],
                "icon": s["icon"],
                "health": h.get("health", "upcoming"),
                "reason": h.get("reason"),
                "completed_at": iso_utc(row.completed_at) if row and row.completed_at else None,
                "completed_by": user_brief(row.completed_by) if row and row.completed_by else None,
            }
        )
    return out


def _aware(t: datetime) -> datetime:
    return t.replace(tzinfo=UTC) if t.tzinfo is None else t


def issue_out(db: Session, p: Problem, now: datetime) -> dict:
    today = business_date(now)
    visit = db.get(SiteVisit, p.site_visit_id)
    out = {
        "id": p.id,
        "severity": p.severity,
        "category": p.category,
        "problem": p.problem,
        "location": p.location,
        "responsible_party": p.responsible_party,
        "target_date": p.target_date.isoformat(),
        "days_open": (today - business_date(_aware(p.created_at))).days,
        "overdue": p.status == ProblemStatus.open and p.target_date < today,
        "recommended_action": (visit.form or {}).get("recommended_action") if visit else None,
        "status": p.status.value,
    }
    if p.status == ProblemStatus.resolved:
        out |= {
            "resolved_at": iso_utc(p.resolved_at),
            "resolved_by": user_brief(p.resolved_by),
            "resolution_note": p.resolution_note,
        }
    return out


def issues(db: Session, project: Project, now: datetime) -> dict:
    order = {s: n for n, s in enumerate(MAJOR)}
    major = db.scalars(select(Problem).where(Problem.project_id == project.id, Problem.severity.in_(MAJOR))).all()
    since = now - timedelta(days=wc.RESOLVED_ISSUES_DAYS)
    open_ = sorted(
        (p for p in major if p.status == ProblemStatus.open),
        key=lambda p: (order[p.severity], p.target_date, p.id),
    )
    resolved = sorted(
        (p for p in major if p.status == ProblemStatus.resolved and p.resolved_at and _aware(p.resolved_at) >= since),
        key=lambda p: _aware(p.resolved_at),
        reverse=True,
    )
    return {"open": [issue_out(db, p, now) for p in open_], "resolved": [issue_out(db, p, now) for p in resolved]}


def _portfolio(rows: list[dict]) -> dict:
    by_currency: dict[str, dict[str, Decimal]] = {}
    for r in rows:
        f = r["fees"]
        t = by_currency.setdefault(f["currency"], {"due": Decimal(0), "received": Decimal(0)})
        t["due"] += Decimal(f["due"])
        t["received"] += Decimal(f["received"])
    percents = [r["completion"]["percent"] for r in rows]
    return {
        "projects": len(rows),
        "average_completion": round(sum(percents) / len(percents), 1) if percents else None,
        "fees": [
            {
                "currency": c,
                "due": f"{t['due']:.2f}",
                "received": f"{t['received']:.2f}",
                "outstanding": f"{t['due'] - t['received']:.2f}",
            }
            for c, t in sorted(by_currency.items())
        ],
        "open_major_issues": sum(len(r["issues"]["open"]) for r in rows),
        "milestones_waiting": sum(1 for r in rows for m in r["milestones"] if m["health"] in ("waiting", "delayed")),
    }


@router.get("/principal/overview")
def overview(user: User = Depends(require_principal), db: Session = Depends(get_db)) -> dict:
    now = datetime.now(UTC)
    projects = db.scalars(visible_projects(user)).all()
    for p in projects:  # time-based red flags move with the clock, as on the dashboard
        sync_red_flags(db, p, now)
    db.commit()
    out = []
    for p in projects:
        rows = stages.stage_rows(db, p)
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "location": p.location,
                "image": image_out(p),
                "completion": completion(p, rows),
                "fees": fee_totals(db, p),
                "milestones": milestones(rows, project_health(db, p, now)),
                "issues": issues(db, p, now),
            }
        )
    return {"portfolio": _portfolio(out), "projects": out}
