from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Notification, User
from app.schemas import iso_utc

router = APIRouter(tags=["notifications"])


def _out(n: Notification) -> dict:
    return {
        "id": n.id,
        "kind": n.kind,
        "text": n.text,
        "project": {"id": n.project.id, "name": n.project.name} if n.project else None,
        "created_at": iso_utc(n.created_at),
        "read_at": iso_utc(n.read_at),
    }


def _unread(db: Session, user: User) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )


@router.get("/notifications")
def my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    items = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(50)
    ).all()
    return {"unread": _unread(db, user), "items": [_out(n) for n in items]}


@router.post("/notifications/read-all")
def read_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    db.commit()
    return {"unread": 0}


@router.post("/notifications/{notification_id}/read")
def read_one(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if n.read_at is None:
        n.read_at = datetime.now(UTC)
        db.commit()
        db.refresh(n)
    return _out(n)
