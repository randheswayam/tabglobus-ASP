import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import workflow_config as wc
from app.db import get_db
from app.deps import require_role, visible_projects
from app.models import Media, MediaKind, Project, Role, SiteVisit, User, VisitStatus
from app.schemas import media_out
from app.services import audit
from app.services.storage import get_storage

router = APIRouter(tags=["media"])

_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "video/mp4": ".mp4", "video/webm": ".webm"}
_CHUNK = 1024 * 1024


def _signature_matches(content_type: str, head: bytes) -> bool:
    """The Content-Type header is set by the client, so check the file's own magic bytes as well."""
    return {
        "image/jpeg": head[:3] == b"\xff\xd8\xff",
        "image/png": head[:8] == b"\x89PNG\r\n\x1a\n",
        "image/webp": head[:4] == b"RIFF" and head[8:12] == b"WEBP",
        "video/mp4": head[4:8] == b"ftyp",
        "video/webm": head[:4] == b"\x1a\x45\xdf\xa3",
    }.get(content_type, False)


def _unprocessable(message: str, field: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {"message": message, "missing": [], "invalid": [field]})


def visible_visit(db: Session, user: User, visit_id: int) -> SiteVisit:
    visit = db.get(SiteVisit, visit_id)
    if visit is None or db.scalars(visible_projects(user).where(Project.id == visit.project_id)).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Site visit not found")
    return visit


@router.post("/site-visits/{visit_id}/media", status_code=status.HTTP_201_CREATED)
async def upload_media(visit_id: int, file: UploadFile = File(...), kind: str = Form(...),
                       problem_ref: int | None = Form(None), captured_at: datetime | None = Form(None),
                       lat: float | None = Form(None), lng: float | None = Form(None),
                       user: User = Depends(require_role(Role.civil_engineer)), db: Session = Depends(get_db)) -> dict:
    visit = visible_visit(db, user, visit_id)
    if visit.status not in (VisitStatus.draft, VisitStatus.rework):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Media can't be added to a {visit.status.value} visit")
    try:
        media_kind = MediaKind(kind)
    except ValueError:
        raise _unprocessable("kind must be photo or video", "kind")
    if problem_ref is not None and problem_ref < 0:
        raise _unprocessable("problem_ref must be a problem number from 0", "problem_ref")
    if (lat is None) != (lng is None) or (lat is not None and not (-90 <= lat <= 90 and -180 <= lng <= 180)):
        raise _unprocessable("Give both lat and lng, within range", "gps")

    allowed, limit_mb = ((wc.PHOTO_TYPES, wc.MAX_PHOTO_MB) if media_kind == MediaKind.photo
                         else (wc.VIDEO_TYPES, wc.MAX_VIDEO_MB))
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in allowed:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            f"A {media_kind.value} must be one of: {', '.join(allowed)}")

    # Read in chunks and stop as soon as the limit is passed, so a huge upload never sits in memory.
    limit = limit_mb * 1024 * 1024
    data = bytearray()
    while chunk := await file.read(_CHUNK):
        data += chunk
        if len(data) > limit:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                f"A {media_kind.value} can be at most {limit_mb} MB")
    if not _signature_matches(content_type, bytes(data[:16])):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"The file is not a valid {content_type}")

    key = f"visits/{visit.id}/{secrets.token_hex(16)}{_EXT[content_type]}"
    get_storage().save(key, bytes(data))
    when = captured_at or datetime.now(timezone.utc)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    media = Media(site_visit_id=visit.id, kind=media_kind, problem_ref=problem_ref, content_type=content_type,
                  size=len(data), sha256=hashlib.sha256(data).hexdigest(), storage_key=key,
                  captured_at=when.astimezone(timezone.utc), lat=lat, lng=lng, uploader_id=user.id)
    db.add(media)
    db.flush()
    audit.record(db, user, "media.added", project_id=visit.project_id, entity_type="media", entity_id=media.id,
                 detail={"visit_id": visit.id, "kind": media_kind.value, "problem_ref": problem_ref})
    db.commit()
    db.refresh(media)
    return media_out(media)
