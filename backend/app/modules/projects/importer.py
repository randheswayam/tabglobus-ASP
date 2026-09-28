"""Bulk import of in-progress projects (PRD 7.19, FR-27). Admin only. The preview validates every row and writes
nothing; the commit (next task) runs the same checks and creates projects through the normal onboarding path."""

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app.db import get_db
from app.deps import require_role, require_staff
from app.models import Project, Role, User

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
    name = (file.filename or "").lower()
    if not name.endswith(".csv"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload the list as a .csv file")
    data = bytearray()
    while chunk := await file.read(_CHUNK):
        data += chunk
        if len(data) > MAX_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The file can be at most 1 MB")
    try:
        return bytes(data).decode("utf-8-sig")  # utf-8-sig drops the byte-order mark Excel writes
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
