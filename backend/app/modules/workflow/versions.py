"""Flow versions. A project runs the flow it was created with: the stage engine reads the project's pinned
snapshot, never stage_config directly. Editing stage_config creates the next version on the next new project."""

import json
from dataclasses import dataclass
from functools import cached_property

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app.models import FlowVersion, Project


@dataclass
class Flow:
    phases: list[dict]
    stages: list[dict]
    version: int | None  # None: an unpinned project, which follows stage_config

    @cached_property
    def by_key(self) -> dict[str, dict]:
        return {s["key"]: s for s in self.stages}


def config_snapshot() -> dict:
    """stage_config as plain JSON, detached from the module's lists."""
    return json.loads(json.dumps({"phases": sc.PHASES, "stages": sc.STAGES}))


def current_version(db: Session) -> FlowVersion:
    """The version matching stage_config now, creating the next one if the config changed."""
    latest = db.scalars(select(FlowVersion).order_by(FlowVersion.number.desc())).first()
    snapshot = config_snapshot()
    if latest is not None and latest.snapshot == snapshot:
        return latest
    version = FlowVersion(number=latest.number + 1 if latest else 1, snapshot=snapshot)
    db.add(version)
    db.flush()
    return version


def flow_for(project: Project) -> Flow:
    v = project.flow_version
    if v is None:
        return Flow(sc.PHASES, sc.STAGES, None)
    return Flow(v.snapshot["phases"], v.snapshot["stages"], v.number)
