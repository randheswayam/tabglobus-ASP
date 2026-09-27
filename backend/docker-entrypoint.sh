#!/bin/sh
# Migrate the database, create the seed users on first start, then serve the API.
set -e
python -m alembic upgrade head
if [ -n "$SEED_PASSWORD" ]; then
  python -m app.seed
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
