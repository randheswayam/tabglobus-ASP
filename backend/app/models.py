import enum
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from app import template_config as tc
from app.db import Base

Json = JSON().with_variant(JSONB(), "postgresql")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _enum(cls):
    # Store the enum value (e.g. "Not started"), not the member name, as a portable VARCHAR.
    return Enum(cls, native_enum=False, values_callable=lambda e: [m.value for m in e], length=32)


class Role(str, enum.Enum):
    architect = "architect"
    team_lead = "team_lead"
    civil_engineer = "civil_engineer"
    admin = "admin"


class StepStatus(str, enum.Enum):
    locked = "locked"
    active = "active"
    completed = "completed"


class LegalStatus(str, enum.Enum):
    not_started = "Not started"
    applied = "Applied"
    approved = "Approved"
    rejected = "Rejected"


class VisitStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    rework = "rework"
    approved = "approved"


class ReviewDecision(str, enum.Enum):
    approve = "approve"
    rework = "rework"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32))
    role: Mapped[Role] = mapped_column(_enum(Role))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(300))
    template_id: Mapped[str] = mapped_column(String(40), default=tc.TEMPLATE_ID)
    template_version: Mapped[int] = mapped_column(Integer, default=tc.TEMPLATE_VERSION)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    official_progress: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    members: Mapped[list["ProjectMember"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    steps: Mapped[list["WorkflowStep"]] = relationship(
        back_populates="project", order_by="WorkflowStep.order", cascade="all, delete-orphan")
    legal_approval: Mapped["LegalApproval | None"] = relationship(back_populates="project", uselist=False)
    site_visits: Mapped[list["SiteVisit"]] = relationship(back_populates="project", order_by="SiteVisit.id")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship()


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    __table_args__ = (UniqueConstraint("project_id", "order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    order: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(60))
    status: Mapped[StepStatus] = mapped_column(_enum(StepStatus), default=StepStatus.locked)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped[Project] = relationship(back_populates="steps")


class LegalApproval(Base):
    __tablename__ = "legal_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), unique=True)
    status: Mapped[LegalStatus] = mapped_column(_enum(LegalStatus), default=LegalStatus.not_started)
    authority_name: Mapped[str | None] = mapped_column(String(200))
    application_reference: Mapped[str | None] = mapped_column(String(120))
    application_date: Mapped[date | None] = mapped_column(Date)
    approval_date: Mapped[date | None] = mapped_column(Date)
    expected_date: Mapped[date | None] = mapped_column(Date)
    document_reference: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    project: Mapped[Project] = relationship(back_populates="legal_approval")


class SiteVisit(Base):
    __tablename__ = "site_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    engineer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[VisitStatus] = mapped_column(_enum(VisitStatus), default=VisitStatus.draft)
    submission_count: Mapped[int] = mapped_column(Integer, default=0)
    current_stage: Mapped[str | None] = mapped_column(String(60))
    # Visit details, summary and recommended action.
    form: Mapped[dict] = mapped_column(Json, default=dict)
    # {checklist_item_id: "Done" | "In progress" | "Not started"}
    checklist: Mapped[dict] = mapped_column(Json, default=dict)
    problems: Mapped[list] = mapped_column(Json, default=list)
    no_issues: Mapped[bool] = mapped_column(Boolean, default=False)
    computed_progress: Mapped[float | None] = mapped_column(Float)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    project: Mapped[Project] = relationship(back_populates="site_visits")
    reviews: Mapped[list["Review"]] = relationship(back_populates="site_visit", order_by="Review.id")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_visit_id: Mapped[int] = mapped_column(ForeignKey("site_visits.id"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[ReviewDecision] = mapped_column(_enum(ReviewDecision))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    site_visit: Mapped[SiteVisit] = relationship(back_populates="reviews")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    detail: Mapped[dict] = mapped_column(Json, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuditImmutableError(Exception):
    """Raised when code tries to change or remove a recorded audit event."""


@event.listens_for(Session, "before_flush")
def _block_audit_changes(session, _ctx, _instances):
    for obj in session.deleted:
        if isinstance(obj, AuditEvent):
            raise AuditImmutableError("Audit events are append-only")
    for obj in session.dirty:
        if isinstance(obj, AuditEvent) and session.is_modified(obj):
            raise AuditImmutableError("Audit events are append-only")
