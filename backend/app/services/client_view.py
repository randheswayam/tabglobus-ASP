"""The client's view of their own project, built field by field from an allow-list (decision 0002).
Internal records (audit, notes, review comments, red flags, problems, staff contacts) are never read here."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app.models import Project, SharedUpdate, SignoffRequest, SignoffStatus, StageStatus, User
from app.modules.workflow import versions
from app.schemas import iso_utc, stage_summary

_STATE = {
    StageStatus.completed: "completed",
    StageStatus.historical: "historical",
    StageStatus.active: "in_progress",
    StageStatus.locked: "upcoming",
}


def _shared_requests(db: Session, project: Project) -> list[SignoffRequest]:
    return list(
        db.scalars(
            select(SignoffRequest)
            .where(SignoffRequest.project_id == project.id, SignoffRequest.status != SignoffStatus.draft)
            .order_by(SignoffRequest.stage_key, SignoffRequest.version)
        )
    )


def project_card(db: Session, project: Project) -> dict:
    summary = stage_summary(project)
    return {
        "id": project.id,
        "name": project.name,
        "location": project.location,
        "phase": summary["phase"],
        "current_stages": summary["current_stages"],
        "stage_progress": summary["stage_progress"],
        "official_progress": project.official_progress,
        "waiting_for_you": sum(1 for r in _shared_requests(db, project) if r.status == SignoffStatus.sent),
    }


def project_detail(db: Session, project: Project, user: User, signoff_out) -> dict:
    requests = _shared_requests(db, project)
    approved = {r.stage_key: r for r in requests if r.status == SignoffStatus.approved}
    rows = {r.key: r for r in project.stages}

    def stage(s):
        r = rows[s["key"]]
        signed = approved.get(s["key"]) if r.status == StageStatus.completed else None
        return {
            "key": s["key"],
            "number": s["number"],
            "label": s["label"],
            "icon": s["icon"],
            "detail": s["detail"],
            "workstream": s["workstream"],
            "state": _STATE[r.status],
            "is_signoff": sc.is_signoff(s),
            "started_at": iso_utc(r.started_at),
            "completed_at": iso_utc(r.completed_at),
            "historical": "Completed before SiteFlow" if r.status == StageStatus.historical else None,
            "signed": {"by": signed.signer_name, "at": iso_utc(signed.responded_at), "version": signed.version}
            if signed
            else None,
        }

    flow = versions.flow_for(project)
    return {
        **project_card(db, project),
        "phases": [
            {
                "number": p["number"],
                "name": p["name"],
                "icon": p["icon"],
                "stages": [stage(s) for s in flow.stages if s["phase"] == p["number"]],
            }
            for p in flow.phases
        ],
        "signoffs": [signoff_out(db, user, r) for r in requests],
        "shared_updates": [
            {
                "id": u.id,
                "note": u.note,
                "shared_at": iso_utc(u.created_at),
                "stage": u.site_visit.current_stage,
                "photos": [{"id": ph.media_id, "captured_at": iso_utc(ph.media.captured_at)} for ph in u.photos],
            }
            for u in db.scalars(
                select(SharedUpdate).where(SharedUpdate.project_id == project.id).order_by(SharedUpdate.id.desc())
            )
        ],
    }
