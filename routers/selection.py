"""AI field/option selection routes."""
from fastapi import APIRouter

from schemas.selection import AISelectRequest, AISelectResponse
from services.ai_selector import select_options

router = APIRouter()


@router.post("/ai-select", response_model=AISelectResponse)
async def ai_select(req: AISelectRequest):
    selected = select_options(req)
    return AISelectResponse(selected=selected)