"""Files attached to a stage: photos, videos, PDFs and AutoCAD drawings (DWG, DXF), as evidence of the work or,
on a historical stage, of work done before SiteFlow. Staff only; the client app never reads these."""

import hashlib
import os
import re
import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app import stage_config as sc
from app import workflow_config as wc
from app.db import get_db
from app.deps import get_current_user, get_visible_project, require_staff
from app.models import Project, StageAttachment, StageStatus, User
from app.modules.workflow import versions
from app.services import audit, stages
from app.services.filecheck import EXTENSIONS, STAGE_FILE_TYPES, read_checked
from app.services.stages import attachment_out
from app.services.storage import get_storage

router = APIRouter(tags=["stages"], dependencies=[Depends(require_staff)])
KIND_LABEL = {"photo": "photo", "video": "video", "document": "document", "cad": "AutoCAD drawing"}


def _display_name(name: str | None) -> str:
    base = os.path.basename((name or "").replace("\\", "/")).strip()
    return re.sub(r"[\x00-\x1f\"]", "", base)[:200] or "file"


def _stage(key: str, project: Project) -> dict:
    stage = versions.flow_for(project).by_key.get(key)
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    return stage


def _may_attach(user: User, stage: dict) -> None:
    if user.role.value != stage["owner_role"] and user.role.value not in stages.STAFF_COMPLETERS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot add files to this stage")


@router.post("/projects/{project_id}/stages/{key}/attachments", status_code=status.HTTP_201_CREATED)
async def add_attachment(
    key: str,
    file: UploadFile = File(...),
    project: Project = Depends(get_visible_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    stage = _stage(key, project)
    _may_attach(user, stage)
    if sc.is_signoff(stage):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Client sign-off stages take their documents in the sign-off package"
        )
    row = stages.stage_rows(db, project)[key]
    if row.status not in (StageStatus.active, StageStatus.historical):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Files can be added only while the stage is open, or as evidence on a historical stage",
        )
    name = _display_name(file.filename)
    ext = os.path.splitext(name)[1].lower()
    if ext not in STAGE_FILE_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Attach a photo (JPEG, PNG, WEBP), a video (MP4, WEBM), a PDF, or an AutoCAD drawing (DWG, DXF)",
        )
    content_type, kind = STAGE_FILE_TYPES[ext]
    data = await read_checked(file, content_type, wc.MAX_STAGE_ATTACHMENT_MB[kind], KIND_LABEL[kind])
    storage_key = f"stages/{project.id}/{key}/{secrets.token_hex(16)}{EXTENSIONS[content_type]}"
    get_storage().save(storage_key, data)
    a = StageAttachment(
        project_id=project.id,
        stage_key=key,
        kind=kind,
        filename=name,
        content_type=content_type,
        size=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        storage_key=storage_key,
        uploaded_by_id=user.id,
    )
    db.add(a)
    db.flush()
    audit.record(
        db,
        user,
        "stage.attachment_added",
        project_id=project.id,
        entity_type="stage_attachment",
        entity_id=a.id,
        detail={"stage": stage["label"], "key": key, "filename": name, "kind": kind},
    )
    db.commit()
    db.refresh(a)
    return attachment_out(a)


def _attachment(db: Session, project: Project, key: str, attachment_id: int) -> StageAttachment:
    a = db.get(StageAttachment, attachment_id)
    if a is None or a.project_id != project.id or a.stage_key != key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    return a


@router.delete(
    "/projects/{project_id}/stages/{key}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_attachment(
    key: str,
    attachment_id: int,
    project: Project = Depends(get_visible_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    stage = _stage(key, project)
    a = _attachment(db, project, key, attachment_id)
    if a.uploaded_by_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the person who added a file can remove it")
    if a.completed_at is not None or stages.stage_rows(db, project)[key].status == StageStatus.completed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Files of a completed stage can't be removed")
    storage_key = a.storage_key
    db.delete(a)
    audit.record(
        db,
        user,
        "stage.attachment_removed",
        project_id=project.id,
        entity_type="stage_attachment",
        entity_id=attachment_id,
        detail={"stage": stage["label"], "key": key, "filename": a.filename},
    )
    db.commit()
    get_storage().delete(storage_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/projects/{project_id}/stages/{key}/attachments/{attachment_id}")
def download_attachment(
    key: str, attachment_id: int, project: Project = Depends(get_visible_project), db: Session = Depends(get_db)
) -> Response:
    _stage(key, project)
    a = _attachment(db, project, key, attachment_id)
    return Response(
        get_storage().open(a.storage_key),
        media_type=a.content_type,
        headers={
            # Always a download: an AutoCAD file or PDF never renders inside SiteFlow's origin.
            "Content-Disposition": f"attachment; filename=\"{a.filename}\"; filename*=UTF-8''{quote(a.filename)}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
        },
    )
