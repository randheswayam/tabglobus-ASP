import hashlib
import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import workflow_config as wc
from app.db import get_db
from app.deps import get_current_user, require_role, require_staff, visible_projects
from app.models import Media, MediaKind, Project, Role, SiteVisit, User, VisitStatus
from app.schemas import media_out
from app.services import audit
from app.services.filecheck import EXTENSIONS, content_type_of, read_checked
from app.services.storage import get_storage

router = APIRouter(tags=["media"], dependencies=[Depends(require_staff)])


def _unprocessable(message: str, field: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {"message": message, "missing": [], "invalid": [field]})


def visible_visit(db: Session, user: User, visit_id: int) -> SiteVisit:
    visit = db.get(SiteVisit, visit_id)
    if visit is None or db.scalars(visible_projects(user).where(Project.id == visit.project_id)).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Site visit not found")
    return visit


@router.post("/site-visits/{visit_id}/media", status_code=status.HTTP_201_CREATED)
async def upload_media(
    visit_id: int,
    file: UploadFile = File(...),
    kind: str = Form(...),
    problem_ref: int | None = Form(None),
    captured_at: datetime | None = Form(None),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    user: User = Depends(require_role(Role.civil_engineer)),
    db: Session = Depends(get_db),
) -> dict:
    visit = visible_visit(db, user, visit_id)
    if visit.status not in (VisitStatus.draft, VisitStatus.rework):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Media can't be added to a {visit.status.value} visit")
    try:
        media_kind = MediaKind(kind)
    except ValueError:
        raise _unprocessable("kind must be photo or video", "kind") from None
    if problem_ref is not None and problem_ref < 0:
        raise _unprocessable("problem_ref must be a problem number from 0", "problem_ref")
    if (lat is None) != (lng is None) or (lat is not None and not (-90 <= lat <= 90 and -180 <= lng <= 180)):
        raise _unprocessable("Give both lat and lng, within range", "gps")

    allowed, limit_mb = (
        (wc.PHOTO_TYPES, wc.MAX_PHOTO_MB) if media_kind == MediaKind.photo else (wc.VIDEO_TYPES, wc.MAX_VIDEO_MB)
    )
    content_type = content_type_of(file)
    if content_type not in allowed:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"A {media_kind.value} must be one of: {', '.join(allowed)}"
        )

    data = await read_checked(file, content_type, limit_mb, media_kind.value)

    key = f"visits/{visit.id}/{secrets.token_hex(16)}{EXTENSIONS[content_type]}"
    get_storage().save(key, bytes(data))
    when = captured_at or datetime.now(UTC)
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    media = Media(
        site_visit_id=visit.id,
        kind=media_kind,
        problem_ref=problem_ref,
        content_type=content_type,
        size=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        storage_key=key,
        captured_at=when.astimezone(UTC),
        lat=lat,
        lng=lng,
        uploader_id=user.id,
    )
    db.add(media)
    db.flush()
    audit.record(
        db,
        user,
        "media.added",
        project_id=visit.project_id,
        entity_type="media",
        entity_id=media.id,
        detail={"visit_id": visit.id, "kind": media_kind.value, "problem_ref": problem_ref},
    )
    db.commit()
    db.refresh(media)
    return media_out(media)


def _visible_media(db: Session, user: User, media_id: int) -> Media:
    media = db.get(Media, media_id)
    if media is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")
    visible_visit(db, user, media.site_visit_id)  # 404 when the project isn't visible
    return media


@router.get("/media/{media_id}")
def download_media(media_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    media = _visible_media(db, user, media_id)
    return Response(
        get_storage().open(media.storage_key),
        media_type=media.content_type,
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    media_id: int, user: User = Depends(require_role(Role.civil_engineer)), db: Session = Depends(get_db)
) -> Response:
    media = _visible_media(db, user, media_id)
    if media.uploader_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the person who added it can remove it")
    visit = media.site_visit
    if visit.status not in (VisitStatus.draft, VisitStatus.rework):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Media can't be removed from a {visit.status.value} visit")
    audit.record(
        db,
        user,
        "media.removed",
        project_id=visit.project_id,
        entity_type="media",
        entity_id=media.id,
        detail={"visit_id": visit.id, "kind": media.kind.value, "problem_ref": media.problem_ref},
    )
    key = media.storage_key
    db.delete(media)
    db.commit()
    get_storage().delete(key)  # after the commit, so a failed commit never loses the file
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class RetagIn(BaseModel):
    problem_ref: int | None = None


@router.patch("/media/{media_id}")
def retag_media(
    media_id: int, body: RetagIn, user: User = Depends(require_role(Role.civil_engineer)), db: Session = Depends(get_db)
) -> dict:
    """Move a photo to another problem (or untag it), e.g. when a problem above it is removed from the form."""
    media = _visible_media(db, user, media_id)
    if media.uploader_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the person who added it can change it")
    if media.site_visit.status not in (VisitStatus.draft, VisitStatus.rework):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Media on a {media.site_visit.status.value} visit can't change")
    if body.problem_ref is not None and body.problem_ref < 0:
        raise _unprocessable("problem_ref must be a problem number from 0", "problem_ref")
    media.problem_ref = body.problem_ref
    db.commit()
    db.refresh(media)
    return media_out(media)
