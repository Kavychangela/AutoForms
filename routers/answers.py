"""AI answer generation routes."""
from fastapi import APIRouter

from schemas.answer import AnswerRequest
from services.answer_generator import generate_answer as generate_answer_service

router = APIRouter()


@router.post("/generate-answer")
async def generate_answer(req: AnswerRequest):
    try:
        return generate_answer_service(req)
    except Exception as e:
        return {"error": str(e)}