"""Bulk import of in-progress projects (PRD 7.19, FR-27). Admin only. The preview validates every row and writes
nothing; the commit (next task) runs the same checks and creates projects through the normal onboarding path."""

import csv
import hashlib
import io
import re
from dataclasses import dataclass, field
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app.db import get_db
from app.deps import require_role, require_staff
from app.models import ImportBatch, Project, Role, User
from app.modules.projects import service
from app.modules.projects.clients import ClientIn, ContactIn, SiteIn
from app.schemas import iso_utc, user_brief
from app.services import audit

router = APIRouter(prefix="/admin/import/projects", tags=["import"], dependencies=[Depends(require_staff)])
require_admin = require_role(Role.admin)

COLUMNS = [
    "project_name",
    "location",
    "client_name",
    "client_email",
    "site_address",
    "current_stage",
    "civil_engineer_email",
    "confirmed_by",
    "legal_expected_date",
]
REQUIRED = ("project_name", "location", "civil_engineer_email")
MAX_BYTES = 1024 * 1024
MAX_ROWS = 500
_CHUNK = 64 * 1024
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# A cell starting with one of these runs as a formula when the file is opened in a spreadsheet.
_FORMULA = ("=", "+", "-", "@")


@dataclass
class RowResult:
    row: int  # the line number in the file (the header is row 1)
    values: dict
    errors: list[str] = field(default_factory=list)
    engineer: User | None = None

    @property
    def ok(self) -> bool:
        return not self.errors

    def out(self) -> dict:
        return {"row": self.row, "ok": self.ok, "errors": self.errors, "values": self.values}


async def read_csv(file: UploadFile) -> str:
    """The file as text, or an error: 415 if it isn't a CSV, 413 past 1 MB, 422 if it isn't UTF-8."""
    return (await read_upload(file))[0]


async def read_upload(file: UploadFile) -> tuple[str, bytes]:
    name = (file.filename or "").lower()
    if not name.endswith(".csv"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload the list as a .csv file")
    data = bytearray()
    while chunk := await file.read(_CHUNK):
        data += chunk
        if len(data) > MAX_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The file can be at most 1 MB")
    try:
        return bytes(data).decode("utf-8-sig"), bytes(data)  # utf-8-sig drops the byte-order mark Excel writes
    except UnicodeDecodeError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "The file isn't UTF-8 text. Save it as 'CSV UTF-8' and try again."
        ) from None


def parse(db: Session, text: str) -> list[RowResult]:
    reader = csv.DictReader(io.StringIO(text))
    header = [h.strip() for h in (reader.fieldnames or [])]
    missing = [c for c in COLUMNS if c not in header]
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {"message": "The file needs the template's columns", "missing": missing},
        )
    rows = list(reader)
    if len(rows) > MAX_ROWS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Import at most {MAX_ROWS} projects at a time")

    engineers = {
        u.email.lower(): u
        for u in db.scalars(select(User).where(User.role == Role.civil_engineer, User.is_active.is_(True)))
    }
    existing = {n.lower() for n in db.scalars(select(func.lower(Project.name)))}
    seen: dict[str, int] = {}
    results = []
    for i, raw in enumerate(rows, start=2):
        values = {c: (raw.get(c) or "").strip() for c in COLUMNS}
        r = RowResult(row=i, values=values)
        for c in COLUMNS:
            if values[c].startswith(_FORMULA):
                r.errors.append(f"{c} starts with = + - or @")
        for c in REQUIRED:
            if not values[c]:
                r.errors.append(f"{c} is required")
        stage = values["current_stage"]
        if stage:
            if stage not in sc.BY_KEY:
                r.errors.append(f"current_stage '{stage}' is not a stage")
            elif stage == sc.STAGES[0]["key"]:
                r.errors.append(f"current_stage '{stage}' is the first stage; leave it blank for a new project")
            if not values["confirmed_by"]:
                r.errors.append("confirmed_by is required when current_stage is set")
        if values["civil_engineer_email"]:
            r.engineer = engineers.get(values["civil_engineer_email"].lower())
            if r.engineer is None:
                r.errors.append("civil_engineer_email is not an active Civil Engineer")
        if values["client_email"] and not _EMAIL.match(values["client_email"]):
            r.errors.append("client_email is not an email address")
        if values["legal_expected_date"]:
            try:
                if not _DATE.match(values["legal_expected_date"]):
                    raise ValueError
                date.fromisoformat(values["legal_expected_date"])
            except ValueError:
                r.errors.append("legal_expected_date must be YYYY-MM-DD")
        name = values["project_name"].lower()
        if name:
            if name in seen:
                r.errors.append(f"project_name repeats row {seen[name]}")
            else:
                seen[name] = i
            if name in existing:
                r.errors.append(f"a project named '{values['project_name']}' already exists")
        results.append(r)
    return results


def summary(results: list[RowResult]) -> dict:
    ok = sum(1 for r in results if r.ok)
    return {"rows": len(results), "ok": ok, "errors": len(results) - ok}


@router.get("/template")
def template(_: User = Depends(require_admin)) -> Response:
    example = (
        "Sathe House,Pashan Pune,Sathe family,sathe@example.com,Survey 12 Pashan,grid,engineer@example.com,Parvez,"
    )
    body = ",".join(COLUMNS) + "\r\n" + example + "\r\n"
    return Response(
        body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="siteflow-projects-template.csv"'},
    )


@router.post("/preview")
async def preview(
    file: UploadFile = File(...), _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    results = parse(db, await read_csv(file))
    return {"counts": summary(results), "rows": [r.out() for r in results], "stages": [s["key"] for s in sc.STAGES]}


MODES = ("all_or_nothing", "valid_rows_only")


def _create(db: Session, r: RowResult, architect: User, admin: User, batch: ImportBatch) -> Project:
    v = r.values
    client = None
    if v["client_name"]:
        contacts = (
            [ContactIn(name=v["client_name"], email=v["client_email"], is_signatory=True)] if v["client_email"] else []
        )
        client = ClientIn(name=v["client_name"], contacts=contacts)
    return service.create_project(
        db,
        architect,
        name=v["project_name"],
        location=v["location"],
        engineer=r.engineer,
        legal_expected_date=date.fromisoformat(v["legal_expected_date"]) if v["legal_expected_date"] else None,
        start_stage=v["current_stage"] or None,
        historical_confirmed_by=v["confirmed_by"] or None,
        client=client,
        site=SiteIn(address=v["site_address"]) if v["site_address"] else None,
        actor=admin,
        audit_extra={"import_batch_id": batch.id},
    )


@router.post("/commit", status_code=status.HTTP_201_CREATED)
async def commit(
    file: UploadFile = File(...),
    mode: str = Form(...),
    architect_id: int = Form(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if mode not in MODES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "mode must be all_or_nothing or valid_rows_only")
    architect = db.get(User, architect_id)
    if architect is None or architect.role != Role.architect or not architect.is_active:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "architect_id must be an active Architect")
    text, raw = await read_upload(file)
    results = parse(db, text)
    counts = summary(results)
    batch = ImportBatch(
        by_id=admin.id,
        filename=(file.filename or "import.csv").replace("\\", "/").split("/")[-1][:200],
        sha256=hashlib.sha256(raw).hexdigest(),
        mode=mode,
        rows=counts["rows"],
        errors=[{"row": r.row, "errors": r.errors} for r in results if not r.ok],
    )
    db.add(batch)
    db.flush()
    refused = mode == "all_or_nothing" and counts["errors"] > 0
    projects = [] if refused else [_create(db, r, architect, admin, batch) for r in results if r.ok]
    batch.imported = len(projects)
    batch.project_ids = [p.id for p in projects]
    audit.record(
        db,
        admin,
        "import.committed",
        project_id=None,
        entity_type="import_batch",
        entity_id=batch.id,
        detail={"mode": mode, "rows": counts["rows"], "imported": len(projects), "refused": refused},
    )
    db.commit()
    if refused:
        # Both paths are audited: the batch records the refusal and the row errors.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {
                "message": "Nothing was imported: fix the rows with errors, or import the valid rows only",
                "counts": counts,
                "rows": [r.out() for r in results],
                "batch_id": batch.id,
            },
        )
    return {
        "batch_id": batch.id,
        "counts": counts,
        "rows": [r.out() for r in results],
        "projects": [{"id": p.id, "name": p.name} for p in projects],
    }


batches_router = APIRouter(prefix="/admin/import", tags=["import"], dependencies=[Depends(require_staff)])


@batches_router.get("/batches")
def list_batches(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict]:
    return [
        {
            "id": b.id,
            "at": iso_utc(b.created_at),
            "by": user_brief(b.by),
            "filename": b.filename,
            "sha256": b.sha256,
            "mode": b.mode,
            "rows": b.rows,
            "imported": b.imported,
            "errors": b.errors,
            "project_ids": b.project_ids,
        }
        for b in db.scalars(select(ImportBatch).order_by(ImportBatch.id.desc()))
    ]
