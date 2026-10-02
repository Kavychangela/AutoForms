from typing import Any, Optional, Union

from pydantic import BaseModel


class OptionItem(BaseModel):
    index: int
    text: str


class AISelectRequest(BaseModel):
    question: str           # e.g. "Year of Study"
    options: list[str] = [] # e.g. ["1st Year", "2nd Year", "3rd Year", "Final Year", "Graduate"]
    option_items: Optional[list[OptionItem]] = None
    profile: dict[str, Any] # the parsed resume data
    multi_select: bool = False
    form_purpose: str = "job application"


class AISelectResponse(BaseModel):
    selected: list[str] = []       # text fallback for backwards compatibility
    selected_indices: list[int] = [] # indices of selected options
    selected_index: Optional[int] = None


class FieldInfo(BaseModel):
    id: str
    label: str
    field_type: str  # "text", "textarea", "select", "radio", "checkbox"
    placeholder: Optional[str] = ""
    autocomplete: Optional[str] = ""
    options: Optional[list[Union[str, OptionItem]]] = []
    maxlength: Optional[int] = None
    minlength: Optional[int] = None


class FillPlanRequest(BaseModel):
    fields: list[FieldInfo]
    profile: dict[str, Any]
    form_purpose: Optional[str] = "job application"


class FillPlanResponse(BaseModel):
    plan: dict[str, Any] # field_id -> string value | int option_index | list of option_indices | null
