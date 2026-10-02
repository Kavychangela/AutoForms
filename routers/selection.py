"""AI field/option selection routes."""
from fastapi import APIRouter

from schemas.selection import (
    AISelectRequest,
    AISelectResponse,
    FillPlanRequest,
    FillPlanResponse,
)
from services.ai_selector import generate_fill_plan, select_options

router = APIRouter()


@router.post("/ai-select", response_model=AISelectResponse)
async def ai_select(req: AISelectRequest):
    return select_options(req)


@router.post("/fill-plan", response_model=FillPlanResponse)
async def fill_plan(req: FillPlanRequest):
    return generate_fill_plan(req)
