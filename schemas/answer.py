from typing import Optional

from pydantic import BaseModel


class AnswerRequest(BaseModel):
    question: str
    context: dict          # the parsed resume data
    form_purpose: Optional[str] = "job application"  # e.g. "internship", "college", "job application"  