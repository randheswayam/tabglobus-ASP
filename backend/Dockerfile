FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini .
COPY migrations ./migrations
COPY app ./app
COPY docker-entrypoint.sh .

RUN useradd --create-home --uid 10001 siteflow \
    && mkdir -p /data/media \
    && chown -R siteflow /data \
    && chmod +x docker-entrypoint.sh
USER siteflow

ENV MEDIA_DIR=/data/media \
    AUTO_MIGRATE=false
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
