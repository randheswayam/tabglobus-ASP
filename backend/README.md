# SiteFlow backend

FastAPI + SQLAlchemy 2 + Alembic. Python 3.12 in `backend/.venv`.

```
cd backend
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

## Run locally

From `Code/`, `backend/.venv/Scripts/python run_local.py` starts the API on port 8000 and the web app on 8080. By default the data goes to `backend/local.db` (SQLite). On first run the four demo users are created and their shared password is printed once, or taken from `SEED_PASSWORD`. Set `API_PORT` and `WEB_PORT` to use other ports; the printed app link then carries `?api=`.

The database schema is managed by Alembic. The app runs `alembic upgrade head` at startup, and a database created by sprint v1 is adopted by stamping the v1 baseline first.

## Run on PostgreSQL

1. Start Docker Desktop, then start the database: `docker compose up -d db` (PostgreSQL 16, user and password `siteflow`, port 5432).
2. Point the app at it and run:

   ```
   DATABASE_URL=postgresql+psycopg://siteflow:siteflow@localhost:5432/siteflow backend/.venv/Scripts/python run_local.py
   ```

   Migrations run automatically. To run them by hand: `cd backend && DATABASE_URL=... .venv/Scripts/python -m alembic upgrade head`.
3. To start over, `docker compose down -v` removes the database volume.

## Tests

```
cd backend
.venv/Scripts/python -m pytest                      # in-memory SQLite, about a minute
```

To run the same suite on PostgreSQL, create a separate test database once, then set `TEST_DATABASE_URL`:

```
docker compose exec -T db psql -U siteflow -c "create database siteflow_test;"
TEST_DATABASE_URL=postgresql+psycopg://siteflow:siteflow@localhost:5432/siteflow_test .venv/Scripts/python -m pytest
```

On PostgreSQL the schema is built once through the real migrations, and each test runs inside a transaction that is rolled back. The tests never read `DATABASE_URL`, so they can't touch a real database.

## New migrations

After changing `app/models.py`, generate a revision against a database at head and review it before committing:

```
DATABASE_URL=sqlite+pysqlite:///scratch.db .venv/Scripts/python -c "from app.db import migrate; migrate()"
DATABASE_URL=sqlite+pysqlite:///scratch.db .venv/Scripts/python -m alembic revision --autogenerate --rev-id 0006 -m "what changed"
```

`tests/test_migrations.py` fails if the migrations and the models disagree.
