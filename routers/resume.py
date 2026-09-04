"""Resume routes."""
from fastapi import APIRouter, File, UploadFile

from services.resume_parser import parse_and_store_resume
from utils.pdf_parser import extract_text_from_pdf

router = APIRouter()


@router.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    try:
        text = extract_text_from_pdf(file.file)

        if not text.strip():
            return {"error": "No text extracted from PDF"}

        return parse_and_store_resume(text)

    except Exception as e:
        return {"error": str(e)}