from typing import Any

from pydantic import BaseModel


class AISelectRequest(BaseModel):
    question: str           # e.g. "Year of Study"
    options: list[str]      # e.g. ["1st Year", "2nd Year", "3rd Year", "Final Year", "Graduate"]
    profile: dict[str, Any] # the parsed resume data
    multi_select: bool = False
    form_purpose: str = "job application"


class AISelectResponse(BaseModel):
    selected: list[str]     # e.g. ["Final Year"]