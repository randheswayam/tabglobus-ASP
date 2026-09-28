from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import create_all, migrate
from app.modules.fees import ledger as fees_ledger
from app.modules.identity import admin as identity_admin
from app.modules.projects import clients as project_clients
from app.modules.projects import fee_plan as project_fee_plan
from app.modules.projects import image as project_image
from app.modules.projects import importer as project_importer
from app.modules.workflow import attachments as workflow_attachments
from app.modules.workflow import exceptions as workflow_exceptions
from app.routers import (
    auth,
    client,
    dashboard,
    invites,
    legal,
    media,
    notifications,
    problems,
    projects,
    red_flags,
    reviews,
    signoffs,
    site_visits,
    stages,
    template,
    updates,
)


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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(stages.router)
app.include_router(invites.router)
app.include_router(signoffs.router)
app.include_router(client.router)
app.include_router(updates.router)
app.include_router(identity_admin.router)
app.include_router(workflow_exceptions.router)
app.include_router(workflow_attachments.router)
app.include_router(project_clients.router)
app.include_router(project_fee_plan.router)
app.include_router(project_importer.router)
app.include_router(project_image.router)
app.include_router(fees_ledger.router)
app.include_router(project_importer.batches_router)
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
