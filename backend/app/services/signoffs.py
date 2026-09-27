"""Client sign-off packages: a versioned title, summary and attachments for one milestone stage.
A version is editable only as a draft; once sent it is frozen, and once the client responds it is immutable."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app.models import Project, SignoffRequest, SignoffStatus
from app.schemas import iso_utc, user_brief

OPEN = (SignoffStatus.draft, SignoffStatus.sent)


def requests_for(db: Session, project: Project, stage_key: str | None = None) -> list[SignoffRequest]:
    stmt = select(SignoffRequest).where(SignoffRequest.project_id == project.id)
    if stage_key:
        stmt = stmt.where(SignoffRequest.stage_key == stage_key)
    return list(db.scalars(stmt.order_by(SignoffRequest.stage_key, SignoffRequest.version)))


def latest_by_stage(db: Session, project: Project) -> dict:
    """{stage key: {status, version, sent_at}} of the newest version per stage, for the stage engine."""
    out = {}
    for r in requests_for(db, project):
        out[r.stage_key] = {"status": r.status.value, "version": r.version, "sent_at": iso_utc(r.sent_at)}
    return out


def attachment_out(a, viewed_by_client: bool | None = None) -> dict:
    out = {
        "id": a.id,
        "filename": a.filename,
        "content_type": a.content_type,
        "size": a.size,
        "uploaded_at": iso_utc(a.created_at),
    }
    if viewed_by_client is not None:
        out["viewed"] = viewed_by_client
    return out


def signoff_out(r: SignoffRequest) -> dict:
    """The staff view of a package: everything, including the client's response."""
    return {
        "id": r.id,
        "project_id": r.project_id,
        "stage_key": r.stage_key,
        "stage": sc.BY_KEY[r.stage_key]["label"],
        "version": r.version,
        "status": r.status.value,
        "title": r.title,
        "summary": r.summary,
        "created_by": user_brief(r.created_by),
        "created_at": iso_utc(r.created_at),
        "sent_at": iso_utc(r.sent_at),
        "responded_at": iso_utc(r.responded_at),
        "response_comment": r.response_comment,
        "signer_name": r.signer_name,
        "signed_by": user_brief(r.signer),
        "method": r.method,
        "supersedes_id": r.supersedes_id,
        "attachments": [attachment_out(a) for a in r.attachments],
    }
