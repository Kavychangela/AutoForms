from typing import Optional

from pydantic import BaseModel


class HistoryRequest(BaseModel):
    resume_id: Optional[int] = None
    website: str
    fields_filled: int
    ai_answers: int