from fastapi import APIRouter, Depends

from app import stage_config as sc
from app import template_config as tc
from app import workflow_config as wc
from app.deps import get_current_user
from app.models import User

router = APIRouter(tags=["template"])


@router.get("/template")
def get_template(_: User = Depends(get_current_user)) -> dict:
    """The residential site visit template, so the app builds its form from the same config the server validates."""
    return {
        "id": tc.TEMPLATE_ID,
        "version": tc.TEMPLATE_VERSION,
        "steps": tc.WORKFLOW_STEPS,
        "stages": [
            {
                "name": s["name"],
                "weight": s["weight"],
                "checklist": [{"id": i["id"], "label": i["label"]} for i in s["checklist"]],
            }
            for s in tc.STAGES
        ],
        "checklist_states": tc.CHECKLIST_STATES,
        "problems": tc.PROBLEMS,
        "severities": tc.SEVERITIES,
        "min_photos": tc.MIN_PHOTOS,
        "max_photo_mb": wc.MAX_PHOTO_MB,
        "max_video_mb": wc.MAX_VIDEO_MB,
        "photo_types": wc.PHOTO_TYPES,
        "video_types": wc.VIDEO_TYPES,
        # The 18-stage residential flow, for onboarding a project that is already in progress.
        "phases": sc.PHASES,
        "flow": [{"key": s["key"], "number": s["number"], "label": s["label"], "phase": s["phase"]} for s in sc.STAGES],
    }
