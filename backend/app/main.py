from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import create_all, migrate
from app.routers import auth, dashboard, legal, media, notifications, problems, projects, red_flags, reviews, site_visits, stages, template


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if get_settings().auto_migrate:
        migrate()
    else:
        create_all()
    yield


app = FastAPI(title="SiteFlow API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(stages.router)
app.include_router(legal.router)
app.include_router(site_visits.router)
app.include_router(media.router)
app.include_router(reviews.router)
app.include_router(problems.router)
app.include_router(red_flags.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(template.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
