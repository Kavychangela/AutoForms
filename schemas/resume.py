from pydantic import BaseModel


class HistoryRequest(BaseModel):
    resume_id: int
    website: str
    fields_filled: int
    ai_answers: int