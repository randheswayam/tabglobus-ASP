"""Alembic environment. The database URL comes from app settings (DATABASE_URL), not alembic.ini.
The app's migrate() passes its own connection in config.attributes["connection"]."""
from alembic import context
from sqlalchemy import create_engine

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.config import get_settings
from app.db import Base

config = context.config
target_metadata = Base.metadata


def _configure(**kw) -> None:
    # render_as_batch lets ALTER TABLE work on SQLite as well as PostgreSQL.
    context.configure(target_metadata=target_metadata, render_as_batch=True, compare_type=True, **kw)


def run_migrations_offline() -> None:
    _configure(url=get_settings().database_url, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_engine(get_settings().database_url)
    with engine.connect() as conn:
        _configure(connection=conn)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
