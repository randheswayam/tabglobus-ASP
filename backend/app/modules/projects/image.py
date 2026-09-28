"""The project image: a render or screenshot of the 3D model, so each project is easy to recognise. SiteFlow keeps
the original and a small square thumbnail; it never opens or renders 3D model files themselves."""

import hashlib
import io
import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app import workflow_config as wc
from app.db import get_db
from app.deps import get_visible_project, require_role, require_staff
from app.models import Project, Role, User
from app.services import audit
from app.services.filecheck import EXTENSIONS, content_type_of, read_checked
from app.services.storage import get_storage

router = APIRouter(tags=["project image"], dependencies=[Depends(require_staff)])
TYPES = ("image/jpeg", "image/png", "image/webp")
THUMB = 96


def _iso(t: datetime | None) -> str | None:
    # Same format as app.schemas.iso_utc (imported here would be circular: schemas uses image_out).
    if t is None:
        return None
    return (t.replace(tzinfo=UTC) if t.tzinfo is None else t.astimezone(UTC)).isoformat()


def image_out(p: Project) -> dict | None:
    if not p.image_key:
        return None
    return {"thumb_url": f"/projects/{p.id}/image?size=thumb", "updated_at": _iso(p.image_updated_at)}


def _thumbnail(data: bytes) -> bytes:
    """A 96x96 JPEG, centre-cropped. A file that isn't a readable image is refused."""
    try:
        with Image.open(io.BytesIO(data)) as im:
            im.load()
            square = ImageOps.fit(ImageOps.exif_transpose(im).convert("RGB"), (THUMB, THUMB))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "The file is not a readable image") from None
    out = io.BytesIO()
    square.save(out, "JPEG", quality=85)
    return out.getvalue()


def _drop_files(p: Project) -> None:
    storage = get_storage()
    for key in (p.image_key, p.image_thumb_key):
        if key:
            storage.delete(key)


@router.put("/projects/{project_id}/image")
async def set_image(
    file: UploadFile = File(...),
    user: User = Depends(require_role(Role.architect, Role.admin)),
    project: Project = Depends(get_visible_project),
    db: Session = Depends(get_db),
) -> dict:
    content_type = content_type_of(file)
    if content_type not in TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use a JPEG, PNG or WEBP image of the 3D model")
    data = await read_checked(file, content_type, wc.MAX_PROJECT_IMAGE_MB, "project image")
    thumb = _thumbnail(data)
    storage, token = get_storage(), secrets.token_hex(16)
    key, thumb_key = (
        f"projects/{project.id}/image-{token}{EXTENSIONS[content_type]}",
        f"projects/{project.id}/thumb-{token}.jpg",
    )
    storage.save(key, data)
    storage.save(thumb_key, thumb)
    old = (project.image_key, project.image_thumb_key)
    project.image_key, project.image_thumb_key = key, thumb_key
    project.image_content_type, project.image_sha256 = content_type, hashlib.sha256(data).hexdigest()
    project.image_updated_at = datetime.now(UTC)
    audit.record(
        db,
        user,
        "project.image_set",
        project_id=project.id,
        entity_type="project",
        entity_id=project.id,
        detail={"replaced": old[0] is not None},
    )
    db.commit()
    for k in old:
        if k:
            storage.delete(k)
    return image_out(project)


@router.delete("/projects/{project_id}/image", status_code=status.HTTP_204_NO_CONTENT)
def remove_image(
    user: User = Depends(require_role(Role.architect, Role.admin)),
    project: Project = Depends(get_visible_project),
    db: Session = Depends(get_db),
) -> Response:
    if not project.image_key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This project has no image")
    old = Project(image_key=project.image_key, image_thumb_key=project.image_thumb_key)
    project.image_key = project.image_thumb_key = project.image_content_type = project.image_sha256 = None
    project.image_updated_at = datetime.now(UTC)
    audit.record(db, user, "project.image_removed", project_id=project.id, entity_type="project", entity_id=project.id)
    db.commit()
    _drop_files(old)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/projects/{project_id}/image")
def get_image(
    size: str = Query("full", pattern="^(full|thumb)$"), project: Project = Depends(get_visible_project)
) -> Response:
    if not project.image_key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This project has no image")
    thumb = size == "thumb"
    return Response(
        get_storage().open(project.image_thumb_key if thumb else project.image_key),
        media_type="image/jpeg" if thumb else project.image_content_type,
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
        },
    )
