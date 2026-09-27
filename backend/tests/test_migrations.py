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
