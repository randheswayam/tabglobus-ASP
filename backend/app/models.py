import enum
from datetime import UTC, date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
    inspect,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from app import template_config as tc
from app.db import Base

Json = JSON().with_variant(JSONB(), "postgresql")


def _now() -> datetime:
    return datetime.now(UTC)


def _enum(cls):
    # Store the enum value (e.g. "Not started"), not the member name, as a portable VARCHAR.
    return Enum(cls, native_enum=False, values_callable=lambda e: [m.value for m in e], length=32)


class Role(str, enum.Enum):
    """Stored values never change. Mapping to PRD v3.2 section 5 (decision 0003):
    admin = Principal Architect / Admin; architect = Project Architect / Project Manager and Architect / Designer;
    team_lead = Reviewer / Team Lead; civil_engineer = Civil / Site Engineer; client = Client / External Reviewer.
    """

    architect = "architect"
    team_lead = "team_lead"
    civil_engineer = "civil_engineer"
    admin = "admin"
    client = "client"  # the customer app: sees only their own projects through /client/*
    structural_consultant = "structural_consultant"
    mep_consultant = "mep_consultant"
    interior_designer = "interior_designer"
    accounts = "accounts"
    office_coordinator = "office_coordinator"


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


class MediaKind(str, enum.Enum):
    photo = "photo"
    video = "video"


class ProblemStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


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
        back_populates="project", order_by="WorkflowStep.order", cascade="all, delete-orphan"
    )
    legal_approval: Mapped["LegalApproval | None"] = relationship(back_populates="project", uselist=False)
    site_visits: Mapped[list["SiteVisit"]] = relationship(back_populates="project", order_by="SiteVisit.id")
    stages: Mapped[list["ProjectStage"]] = relationship(
        back_populates="project", order_by="ProjectStage.id", cascade="all, delete-orphan"
    )


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
    engineer: Mapped[User] = relationship()
    reviews: Mapped[list["Review"]] = relationship(back_populates="site_visit", order_by="Review.id")
    media: Mapped[list["Media"]] = relationship(back_populates="site_visit", order_by="Media.id")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_visit_id: Mapped[int] = mapped_column(ForeignKey("site_visits.id"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[ReviewDecision] = mapped_column(_enum(ReviewDecision))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    site_visit: Mapped[SiteVisit] = relationship(back_populates="reviews")
    reviewer: Mapped[User] = relationship()


class Media(Base):
    """A photo or video attached to a site visit. The file itself lives in storage under storage_key."""

    __tablename__ = "media"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_visit_id: Mapped[int] = mapped_column(ForeignKey("site_visits.id"), index=True)
    kind: Mapped[MediaKind] = mapped_column(_enum(MediaKind))
    problem_ref: Mapped[int | None] = mapped_column(Integer)  # index into the visit's problem list
    content_type: Mapped[str] = mapped_column(String(60))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    storage_key: Mapped[str] = mapped_column(String(200), unique=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    site_visit: Mapped[SiteVisit] = relationship(back_populates="media")
    uploader: Mapped[User] = relationship()


class Problem(Base):
    """A problem from an approved site visit, tracked until someone resolves it."""

    __tablename__ = "problems"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    site_visit_id: Mapped[int] = mapped_column(ForeignKey("site_visits.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)  # position in the visit's problem list (matches media problem_ref)
    category: Mapped[str] = mapped_column(String(40))
    problem: Mapped[str] = mapped_column(String(300))  # config list item, or the free text for "Other"
    severity: Mapped[str] = mapped_column(String(20))
    location: Mapped[str] = mapped_column(String(300))
    responsible_party: Mapped[str] = mapped_column(String(200))
    target_date: Mapped[date] = mapped_column(Date)
    status: Mapped[ProblemStatus] = mapped_column(_enum(ProblemStatus), default=ProblemStatus.open, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolution_note: Mapped[str | None] = mapped_column(Text)

    project: Mapped[Project] = relationship()
    resolved_by: Mapped["User | None"] = relationship()


class RedFlag(Base):
    """One raising of a red flag rule (plan section 5.3) for one subject (a problem, a visit or the project).

    Cleared automatically when the rule stops holding, or by Parvez with a reason. A manual clear keeps the
    flag down while the rule keeps holding; condition_ended_at records when it stopped, which re-arms it."""

    __tablename__ = "red_flags"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    rule: Mapped[str] = mapped_column(String(40))
    key: Mapped[str] = mapped_column(String(40))  # problem-<id>, visit-<id> or project
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    clear_kind: Mapped[str | None] = mapped_column(String(10))  # auto | manual
    cleared_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    clear_reason: Mapped[str | None] = mapped_column(Text)
    condition_ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped[Project] = relationship()
    cleared_by: Mapped["User | None"] = relationship()


class Notification(Base):
    """An in-app notification for one person (plan F10). Push and email come later."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    kind: Mapped[str] = mapped_column(String(30))  # step_unlocked | submitted | approved | rework | red_flag
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project | None"] = relationship()


class StageStatus(str, enum.Enum):
    locked = "locked"  # predecessors not done yet
    active = "active"  # open for work; the stage engine says whether a gate still blocks it
    completed = "completed"
    historical = "historical"  # completed before SiteFlow tracked stages (PRD 7.19); never a system sign-off


class ProjectStage(Base):
    """One stage of the residential flow (stage_config.STAGES) for one project."""

    __tablename__ = "project_stages"
    __table_args__ = (UniqueConstraint("project_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    key: Mapped[str] = mapped_column(String(40))
    status: Mapped[StageStatus] = mapped_column(_enum(StageStatus), default=StageStatus.locked)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    completion_note: Mapped[str | None] = mapped_column(Text)
    historical_confirmed_by: Mapped[str | None] = mapped_column(String(120))
    historical_note: Mapped[str | None] = mapped_column(Text)

    project: Mapped[Project] = relationship(back_populates="stages")
    completed_by: Mapped["User | None"] = relationship()


class SignoffStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    approved = "approved"
    changes_requested = "changes_requested"


class SignoffRequest(Base):
    """One version of a client sign-off package for a milestone stage (4, 11, 17 or 18).
    Frozen once sent; immutable once the client responds (see the guard at the end of this module)."""

    __tablename__ = "signoff_requests"
    __table_args__ = (UniqueConstraint("project_id", "stage_key", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    stage_key: Mapped[str] = mapped_column(String(40))
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[SignoffStatus] = mapped_column(_enum(SignoffStatus), default=SignoffStatus.draft)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_comment: Mapped[str | None] = mapped_column(Text)
    signer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    signer_name: Mapped[str | None] = mapped_column(String(120))
    method: Mapped[str | None] = mapped_column(String(30))
    confirmation_text: Mapped[str | None] = mapped_column(Text)
    fingerprint: Mapped[str | None] = mapped_column(String(64))
    supersedes_id: Mapped[int | None] = mapped_column(ForeignKey("signoff_requests.id"))

    attachments: Mapped[list["SignoffAttachment"]] = relationship(
        back_populates="request", order_by="SignoffAttachment.id"
    )
    project: Mapped[Project] = relationship()
    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])
    signer: Mapped["User | None"] = relationship(foreign_keys=[signer_id])


class SignoffAttachment(Base):
    __tablename__ = "signoff_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("signoff_requests.id"), index=True)
    filename: Mapped[str] = mapped_column(String(120))  # display name only; never a storage path
    content_type: Mapped[str] = mapped_column(String(60))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    storage_key: Mapped[str] = mapped_column(String(200), unique=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    request: Mapped[SignoffRequest] = relationship(back_populates="attachments")


class SignoffView(Base):
    """The client opened an attachment. Approval needs a view of every attachment in the version."""

    __tablename__ = "signoff_views"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("signoff_requests.id"), index=True)
    attachment_id: Mapped[int] = mapped_column(ForeignKey("signoff_attachments.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class SharedUpdate(Base):
    """A site update the Architect chose to show the client: a note and selected photos from an approved visit.
    Nothing about a visit reaches the client unless it is shared this way."""

    __tablename__ = "shared_updates"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    site_visit_id: Mapped[int] = mapped_column(ForeignKey("site_visits.id"))
    note: Mapped[str] = mapped_column(Text)
    shared_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    photos: Mapped[list["SharedUpdatePhoto"]] = relationship(
        order_by="SharedUpdatePhoto.id", cascade="all, delete-orphan"
    )
    site_visit: Mapped[SiteVisit] = relationship()
    shared_by: Mapped[User] = relationship()


class SharedUpdatePhoto(Base):
    __tablename__ = "shared_update_photos"
    __table_args__ = (UniqueConstraint("update_id", "media_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    update_id: Mapped[int] = mapped_column(ForeignKey("shared_updates.id"), index=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("media.id"))

    media: Mapped[Media] = relationship()


class ClientInvite(Base):
    """A one-time code the Architect shares with a client to set their password. Only a hash is stored."""

    __tablename__ = "client_invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    code_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # replaced by a newer invite
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserSession(Base):
    """One signed-in device. Only a hash of the refresh token is kept; revoking the session ends its access tokens."""

    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # The hash rotated out by the last refresh: presenting it again means the token was copied (reuse).
    previous_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    user_agent: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), index=True)
    # None for events SiteFlow records by itself, such as red flags raised or cleared automatically.
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    detail: Mapped[dict] = mapped_column(Json, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class SignoffImmutableError(Exception):
    """Raised when code tries to change a sign-off version the client has already answered."""


class AuditImmutableError(Exception):
    """Raised when code tries to change or remove a recorded audit event."""


_ANSWERED = (SignoffStatus.approved, SignoffStatus.changes_requested)


@event.listens_for(Session, "before_flush")
def _block_answered_signoff_changes(session, _ctx, _instances):
    """An answered sign-off is evidence: its content, response and attachments never change afterwards."""
    for obj in list(session.dirty) + list(session.deleted):
        if isinstance(obj, SignoffRequest) and (obj in session.deleted or session.is_modified(obj)):
            history = inspect(obj).attrs.status.history
            original = history.deleted[0] if history.deleted else obj.status
            if original in _ANSWERED:
                raise SignoffImmutableError(f"Sign-off version {obj.version} was answered and cannot change")
    for obj in list(session.new) + list(session.deleted):
        if isinstance(obj, SignoffAttachment) and obj.request is not None and obj.request.status != SignoffStatus.draft:
            raise SignoffImmutableError("Documents of a sent sign-off cannot change")


@event.listens_for(Session, "before_flush")
def _block_audit_changes(session, _ctx, _instances):
    for obj in session.deleted:
        if isinstance(obj, AuditEvent):
            raise AuditImmutableError("Audit events are append-only")
    for obj in session.dirty:
        if isinstance(obj, AuditEvent) and session.is_modified(obj):
            raise AuditImmutableError("Audit events are append-only")
