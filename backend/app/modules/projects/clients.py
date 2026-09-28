"""Clients, contacts and sites. Staff read them; the Architect or Admin creates them, either here or inline when
creating a project. None of this reaches the client app (client_view builds its own allow-listed fields)."""

import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role, require_staff
from app.models import Client, ClientContact, Role, Site, User
from app.services import audit

router = APIRouter(tags=["clients"], dependencies=[Depends(require_staff)])
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(v: str | None) -> str | None:
    return (v or "").strip() or None


class ContactIn(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = Field(None, max_length=40)
    is_signatory: bool = False

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v.strip()

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        v = _clean(v)
        if v is not None and not _EMAIL.match(v):
            raise ValueError("must be an email address")
        return v.lower() if v else None


class ClientIn(BaseModel):
    """Either {"id": ...} of an existing client, or the fields of a new one."""

    id: int | None = None
    name: str | None = None
    type: str | None = Field(None, max_length=40)
    notes: str | None = None
    contacts: list[ContactIn] = []

    @model_validator(mode="after")
    def _either(self):
        if self.id is None and not (self.name or "").strip():
            raise ValueError("give the id of an existing client or the name of a new one")
        if self.name is not None:
            self.name = self.name.strip()
        return self


class SiteIn(BaseModel):
    id: int | None = None
    address: str | None = None
    city: str | None = None
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)

    @model_validator(mode="after")
    def _either(self):
        if self.id is None and not (self.address or "").strip():
            raise ValueError("give the id of an existing site or the address of a new one")
        if self.address is not None:
            self.address = self.address.strip()
        return self


def client_out(c: Client | None) -> dict | None:
    if c is None:
        return None
    return {
        "id": c.id,
        "name": c.name,
        "type": c.type,
        "notes": c.notes,
        "contacts": [
            {"id": k.id, "name": k.name, "email": k.email, "phone": k.phone, "is_signatory": k.is_signatory}
            for k in c.contacts
        ],
    }


def site_out(s: Site | None) -> dict | None:
    if s is None:
        return None
    return {"id": s.id, "address": s.address, "city": s.city, "lat": s.lat, "lng": s.lng}


def resolve_client(db: Session, body: ClientIn | None, user: User) -> Client | None:
    if body is None:
        return None
    if body.id is not None:
        found = db.get(Client, body.id)
        if found is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "client.id is not a known client")
        return found
    c = Client(name=body.name, type=_clean(body.type), notes=_clean(body.notes), created_by_id=user.id)
    c.contacts = [ClientContact(**k.model_dump()) for k in body.contacts]
    db.add(c)
    db.flush()
    audit.record(
        db, user, "client.created", project_id=None, entity_type="client", entity_id=c.id, detail={"client": c.name}
    )
    return c


def resolve_site(db: Session, body: SiteIn | None) -> Site | None:
    if body is None:
        return None
    if body.id is not None:
        found = db.get(Site, body.id)
        if found is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "site.id is not a known site")
        return found
    s = Site(address=body.address, city=_clean(body.city), lat=body.lat, lng=body.lng)
    db.add(s)
    db.flush()
    return s


@router.get("/clients")
def list_clients(db: Session = Depends(get_db)) -> list[dict]:
    return [client_out(c) for c in db.scalars(select(Client).order_by(Client.name, Client.id))]


@router.post("/clients", status_code=status.HTTP_201_CREATED)
def create_client(
    body: ClientIn, user: User = Depends(require_role(Role.architect, Role.admin)), db: Session = Depends(get_db)
) -> dict:
    if body.id is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A new client has no id")
    c = resolve_client(db, body, user)
    db.commit()
    return client_out(c)
