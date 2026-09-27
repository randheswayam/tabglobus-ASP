"""Migrations must build exactly the schema the models describe, on an empty database and on a
database created by sprint v1 (create_all, no alembic_version table)."""
from sqlalchemy import create_engine, inspect, text

from app.db import Base, migrate


def _schema(engine) -> dict[str, set[str]]:
    insp = inspect(engine)
    return {t: {c["name"] for c in insp.get_columns(t)} for t in insp.get_table_names() if t != "alembic_version"}


def _model_schema() -> dict[str, set[str]]:
    return {t.name: {c.name for c in t.columns} for t in Base.metadata.sorted_tables}


def test_upgrade_empty_database_matches_models(tmp_path):
    engine = create_engine(f"sqlite+pysqlite:///{(tmp_path / 'm.db').as_posix()}")
    migrate(engine)
    assert _schema(engine) == _model_schema()
    with engine.connect() as c:
        assert c.execute(text("select count(*) from alembic_version")).scalar() == 1


def test_upgrade_is_idempotent(tmp_path):
    engine = create_engine(f"sqlite+pysqlite:///{(tmp_path / 'm.db').as_posix()}")
    migrate(engine)
    migrate(engine)
    assert _schema(engine) == _model_schema()


def test_v1_database_without_alembic_is_adopted(tmp_path):
    """A local.db made by sprint v1 (create_all) is stamped as the baseline, then upgraded."""
    engine = create_engine(f"sqlite+pysqlite:///{(tmp_path / 'v1.db').as_posix()}")
    migrate(engine, target="0001")
    with engine.begin() as c:
        c.execute(text("insert into users (name, email, role, password_hash, is_active, created_at) "
                       "values ('Parvez', 'parvez@siteflow.local', 'team_lead', 'x', 1, '2026-09-27')"))
        c.execute(text("drop table alembic_version"))
    migrate(engine)
    assert _schema(engine) == _model_schema()
    with engine.connect() as c:
        assert c.execute(text("select name from users")).scalar() == "Parvez"


def _seed_v2_project(c, pid, legal_status, visits):
    c.execute(text("insert into projects (id, name, location, template_id, template_version, created_by_id, official_progress, created_at) "
                   f"values ({pid}, 'P{pid}', 'Pune', 'residential', 1, 1, 0, '2026-09-27')"))
    c.execute(text("insert into legal_approvals (project_id, status, updated_at) "
                   f"values ({pid}, '{legal_status}', '2026-09-27')"))
    for n in range(visits):
        c.execute(text("insert into site_visits (project_id, engineer_id, status, submission_count, form, checklist, problems, no_issues, created_at) "
                       f"values ({pid}, 1, 'approved', 1, '{{}}', '{{}}', '[]', 0, '2026-09-27')"))


def test_stage_backfill_treats_v2_projects_as_onboarded_mid_way(tmp_path):
    from app import stage_config as sc

    engine = create_engine(f"sqlite+pysqlite:///{(tmp_path / 'v2.db').as_posix()}")
    migrate(engine, target="0005")
    with engine.begin() as c:
        c.execute(text("insert into users (id, name, email, role, password_hash, is_active, created_at) "
                       "values (1, 'Meera', 'a@x', 'architect', 'x', 1, '2026-09-27')"))
        _seed_v2_project(c, 1, "Applied", 0)   # still waiting for Legal Approval
        _seed_v2_project(c, 2, "Approved", 0)  # approved, no visit yet
        _seed_v2_project(c, 3, "Approved", 2)  # visits already running
    migrate(engine)
    with engine.connect() as c:
        rows = c.execute(text("select project_id, key, status, historical_confirmed_by from project_stages")).all()
    by = {(p, k): (s, who) for p, k, s, who in rows}
    before = [s["key"] for s in sc.STAGES[:sc.STAGES.index(sc.BY_KEY["line_out"])]]
    for pid in (1, 2, 3):
        assert len([r for r in rows if r[0] == pid]) == len(sc.STAGES)
        assert all(by[(pid, k)][0] == "historical" and by[(pid, k)][1] for k in before)
        assert by[(pid, "handover_signoff")][0] == "locked"
    assert (by[(1, "line_out")][0], by[(1, "construction")][0]) == ("active", "locked")
    assert (by[(2, "line_out")][0], by[(2, "construction")][0]) == ("active", "locked")
    assert (by[(3, "line_out")][0], by[(3, "construction")][0]) == ("completed", "active")
