"""The customer app's API. Only the Client role reaches it, and every response is built from an allow-list:
no internal notes, audit, review comments, red flags or problems (decision 0002)."""
import hashlib
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app import workflow_config as wc
from app.db import get_db
from app.deps import get_current_user
from app.models import ProjectMember, Role, SignoffAttachment, SignoffRequest, SignoffStatus, SignoffView, User
from app.routers.signoffs import file_response
from app.schemas import iso_utc
from app.services import audit, stages
from app.services.signoffs import attachment_out

router = APIRouter(prefix="/client", tags=["client app"])


def require_client(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.client:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This area is the client app")
    return user


def _member_project_ids(db: Session, user: User) -> list[int]:
    return list(db.scalars(select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)))


def _my_request(db: Session, user: User, signoff_id: int) -> SignoffRequest:
    """A sent (or answered) package on one of the client's projects; drafts and other projects are 404."""
    req = db.get(SignoffRequest, signoff_id)
    if req is None or req.status == SignoffStatus.draft or req.project_id not in _member_project_ids(db, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sign-off not found")
    return req


def _viewed(db: Session, user: User, req: SignoffRequest) -> set[int]:
    return set(db.scalars(select(SignoffView.attachment_id).where(SignoffView.request_id == req.id,
                                                                  SignoffView.user_id == user.id)))


def client_signoff_out(db: Session, user: User, req: SignoffRequest) -> dict:
    viewed = _viewed(db, user, req)
    return {
        "id": req.id, "project": {"id": req.project_id, "name": req.project.name},
        "stage_key": req.stage_key, "stage": sc.BY_KEY[req.stage_key]["label"], "version": req.version,
        "status": req.status.value, "title": req.title, "summary": req.summary,
        "sent_at": iso_utc(req.sent_at), "responded_at": iso_utc(req.responded_at),
        "response_comment": req.response_comment, "signer_name": req.signer_name,
        "confirmation_text": wc.SIGNOFF_CONFIRMATION_TEXT, "can_respond": req.status == SignoffStatus.sent,
        "attachments": [attachment_out(a, a.id in viewed) for a in req.attachments],
    }


def _respond(db: Session, req: SignoffRequest) -> None:
    if req.status != SignoffStatus.sent:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Version {req.version} has already been answered")


def _fingerprint(request: Request) -> str:
    """Evidence of where the sign-off came from, without storing the address itself."""
    ip = request.client.host if request.client else ""
    return hashlib.sha256(f"{ip}|{request.headers.get('user-agent', '')}".encode()).hexdigest()


def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip().lower()


class ApproveIn(BaseModel):
    confirm: bool = False
    signer_name: str = ""


class ChangesIn(BaseModel):
    comment: str | None = None


@router.get("/signoffs")
def my_signoffs(user: User = Depends(require_client), db: Session = Depends(get_db)) -> list[dict]:
    ids = _member_project_ids(db, user)
    rows = db.scalars(select(SignoffRequest).where(SignoffRequest.project_id.in_(ids),
                                                   SignoffRequest.status != SignoffStatus.draft)
                      .order_by(SignoffRequest.id.desc())).all()
    return [client_signoff_out(db, user, r) for r in rows]


@router.get("/signoffs/{signoff_id}")
def my_signoff(signoff_id: int, user: User = Depends(require_client), db: Session = Depends(get_db)) -> dict:
    return client_signoff_out(db, user, _my_request(db, user, signoff_id))


@router.get("/signoffs/{signoff_id}/attachments/{attachment_id}")
def open_attachment(signoff_id: int, attachment_id: int, user: User = Depends(require_client),
                    db: Session = Depends(get_db)) -> Response:
    req = _my_request(db, user, signoff_id)
    att = db.get(SignoffAttachment, attachment_id)
    if att is None or att.request_id != req.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    if att.id not in _viewed(db, user, req):
        db.add(SignoffView(request_id=req.id, attachment_id=att.id, user_id=user.id))
        db.commit()
    return file_response(att)


@router.post("/signoffs/{signoff_id}/approve")
def approve(signoff_id: int, body: ApproveIn, request: Request, user: User = Depends(require_client),
            db: Session = Depends(get_db)) -> dict:
    req = _my_request(db, user, signoff_id)
    _respond(db, req)
    viewed = _viewed(db, user, req)
    unviewed = [a.filename for a in req.attachments if a.id not in viewed]
    missing = (["attachments"] if unviewed else []) + ([] if body.confirm else ["confirm"])
    invalid = [] if body.signer_name.strip() and _norm(body.signer_name) == _norm(user.name) else ["signer_name"]
    if missing or invalid:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {
            "message": "Open every document, tick the confirmation and type your full name to sign off",
            "missing": missing, "invalid": invalid, "unviewed": unviewed})
    now = datetime.now(timezone.utc)
    req.status, req.responded_at, req.signer_id = SignoffStatus.approved, now, user.id
    req.signer_name, req.method = body.signer_name.strip(), "client_app"
    req.confirmation_text, req.fingerprint = wc.SIGNOFF_CONFIRMATION_TEXT, _fingerprint(request)
    audit.record(db, user, "signoff.approved", project_id=req.project_id, entity_type="signoff", entity_id=req.id,
                 detail={"stage": sc.BY_KEY[req.stage_key]["label"], "version": req.version, "signer": req.signer_name})
    stages.complete(db, req.project, req.stage_key, user,
                    f"Signed off by {req.signer_name} in the client app (version {req.version}).")
    db.commit()
    db.refresh(req)
    return client_signoff_out(db, user, req)


@router.post("/signoffs/{signoff_id}/request-changes")
def request_changes(signoff_id: int, body: ChangesIn, user: User = Depends(require_client),
                    db: Session = Depends(get_db)) -> dict:
    req = _my_request(db, user, signoff_id)
    _respond(db, req)
    comment = (body.comment or "").strip()
    if not comment:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"message": "Say what should change", "missing": ["comment"], "invalid": []})
    req.status, req.responded_at, req.signer_id = SignoffStatus.changes_requested, datetime.now(timezone.utc), user.id
    req.response_comment, req.method = comment, "client_app"
    audit.record(db, user, "signoff.changes_requested", project_id=req.project_id, entity_type="signoff",
                 entity_id=req.id, detail={"stage": sc.BY_KEY[req.stage_key]["label"], "version": req.version,
                                           "comment": comment})
    db.commit()
    db.refresh(req)
    return client_signoff_out(db, user, req)
