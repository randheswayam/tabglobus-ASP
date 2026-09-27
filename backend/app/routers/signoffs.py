"""The Architect's side of client sign-off: prepare a package for a milestone stage, attach files, send it."""
import hashlib
import os
import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app import workflow_config as wc
from app.db import get_db
from app.deps import get_visible_project, require_role, require_staff, visible_projects
from app.models import (Project, ProjectMember, Role, SignoffAttachment, SignoffRequest, SignoffStatus, StageStatus,
                        User)
from app.services import audit, notify, red_flags, stages
from app.services.filecheck import EXTENSIONS, content_type_of, read_checked
from app.services.signoffs import OPEN, attachment_out, requests_for, signoff_out
from app.services.storage import get_storage

router = APIRouter(tags=["sign-offs"], dependencies=[Depends(require_staff)])


def _not_blank(v: str | None) -> str | None:
    if v is not None and not v.strip():
        raise ValueError("must not be blank")
    return v.strip() if v else v


class SignoffIn(BaseModel):
    stage_key: str
    title: str
    summary: str

    _clean = field_validator("title", "summary")(_not_blank)


class SignoffEdit(BaseModel):
    title: str | None = None
    summary: str | None = None

    _clean = field_validator("title", "summary")(_not_blank)


def _visible_signoff(db: Session, user: User, signoff_id: int) -> SignoffRequest:
    req = db.get(SignoffRequest, signoff_id)
    if req is None or db.scalars(visible_projects(user).where(Project.id == req.project_id)).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sign-off not found")
    return req


def _draft(req: SignoffRequest) -> None:
    if req.status != SignoffStatus.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Version {req.version} was {req.status.value} and can no longer change")


def _safe_filename(name: str | None) -> str:
    """A display name only: never used as a storage path."""
    base = os.path.basename((name or "").replace("\\", "/")).strip()
    base = re.sub(r"[\x00-\x1f]", "", base)[:120]
    return base or "document"


@router.post("/projects/{project_id}/signoffs", status_code=status.HTTP_201_CREATED)
def create_signoff(body: SignoffIn, user: User = Depends(require_role(Role.architect)),
                   project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> dict:
    if body.stage_key not in sc.SIGNOFF_STAGES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "stage_key must be a client sign-off stage")
    row = stages.stage_rows(db, project).get(body.stage_key)
    if row is None or row.status != StageStatus.active:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{sc.BY_KEY[body.stage_key]['label']} is not open yet")
    history = requests_for(db, project, body.stage_key)
    if any(r.status in OPEN for r in history):
        raise HTTPException(status.HTTP_409_CONFLICT, "This stage already has a package in progress")
    previous = history[-1] if history else None
    req = SignoffRequest(project_id=project.id, stage_key=body.stage_key, version=(previous.version + 1 if previous else 1),
                         title=body.title, summary=body.summary, created_by_id=user.id,
                         supersedes_id=previous.id if previous else None)
    db.add(req)
    db.flush()
    audit.record(db, user, "signoff.created", project_id=project.id, entity_type="signoff", entity_id=req.id,
                 detail={"stage": sc.BY_KEY[req.stage_key]["label"], "version": req.version})
    db.commit()
    db.refresh(req)
    return signoff_out(req)


@router.get("/projects/{project_id}/signoffs")
def list_signoffs(project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> list[dict]:
    return [signoff_out(r) for r in requests_for(db, project)]


@router.patch("/signoffs/{signoff_id}")
def edit_signoff(signoff_id: int, body: SignoffEdit, user: User = Depends(require_role(Role.architect)),
                 db: Session = Depends(get_db)) -> dict:
    req = _visible_signoff(db, user, signoff_id)
    _draft(req)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(req, field, value)
    db.commit()
    db.refresh(req)
    return signoff_out(req)


@router.post("/signoffs/{signoff_id}/attachments", status_code=status.HTTP_201_CREATED)
async def add_attachment(signoff_id: int, file: UploadFile = File(...), user: User = Depends(require_role(Role.architect)),
                         db: Session = Depends(get_db)) -> dict:
    req = _visible_signoff(db, user, signoff_id)
    _draft(req)
    ctype = content_type_of(file)
    if ctype not in wc.SIGNOFF_ATTACHMENT_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Attach a PDF, JPEG, PNG or WEBP file")
    data = await read_checked(file, ctype, wc.MAX_SIGNOFF_ATTACHMENT_MB, "sign-off document")
    key = f"signoffs/{req.id}/{secrets.token_hex(16)}{EXTENSIONS[ctype]}"
    get_storage().save(key, data)
    att = SignoffAttachment(request_id=req.id, filename=_safe_filename(file.filename), content_type=ctype, size=len(data),
                            sha256=hashlib.sha256(data).hexdigest(), storage_key=key, uploaded_by_id=user.id)
    db.add(att)
    db.flush()
    audit.record(db, user, "signoff.attachment_added", project_id=req.project_id, entity_type="signoff",
                 entity_id=req.id, detail={"version": req.version, "filename": att.filename})
    db.commit()
    db.refresh(att)
    return attachment_out(att)


@router.delete("/signoffs/{signoff_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_attachment(signoff_id: int, attachment_id: int, user: User = Depends(require_role(Role.architect)),
                      db: Session = Depends(get_db)) -> Response:
    req = _visible_signoff(db, user, signoff_id)
    _draft(req)
    att = db.get(SignoffAttachment, attachment_id)
    if att is None or att.request_id != req.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    key = att.storage_key
    audit.record(db, user, "signoff.attachment_removed", project_id=req.project_id, entity_type="signoff",
                 entity_id=req.id, detail={"version": req.version, "filename": att.filename})
    db.delete(att)
    db.commit()
    get_storage().delete(key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/signoffs/{signoff_id}/send")
def send_signoff(signoff_id: int, user: User = Depends(require_role(Role.architect)), db: Session = Depends(get_db)) -> dict:
    req = _visible_signoff(db, user, signoff_id)
    _draft(req)
    missing = [] if req.attachments else ["attachments"]
    has_client = db.scalar(select(func.count()).select_from(ProjectMember).join(User, User.id == ProjectMember.user_id)
                           .where(ProjectMember.project_id == req.project_id, User.role == Role.client))
    if not has_client:
        missing.append("client")
    if missing:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"message": "Add at least one document and invite the client before sending", "missing": missing})
    req.status, req.sent_at = SignoffStatus.sent, datetime.now(timezone.utc)
    audit.record(db, user, "signoff.sent", project_id=req.project_id, entity_type="signoff", entity_id=req.id,
                 detail={"stage": sc.BY_KEY[req.stage_key]["label"], "version": req.version})
    notify.signoff_sent(db, req.project, sc.BY_KEY[req.stage_key]["label"], req.version, user)
    red_flags.sync_red_flags(db, req.project, req.sent_at)
    db.commit()
    db.refresh(req)
    return signoff_out(req)


@router.get("/signoffs/{signoff_id}/attachments/{attachment_id}")
def download_attachment(signoff_id: int, attachment_id: int, user: User = Depends(require_staff),
                        db: Session = Depends(get_db)) -> Response:
    req = _visible_signoff(db, user, signoff_id)
    att = db.get(SignoffAttachment, attachment_id)
    if att is None or att.request_id != req.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    return file_response(att)


def file_response(att: SignoffAttachment) -> Response:
    return Response(get_storage().open(att.storage_key), media_type=att.content_type, headers={
        "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"})
