"""Backend unit tests for AutoForms AI logic."""
import pytest
from schemas.selection import AISelectRequest, AISelectResponse, FillPlanRequest, OptionItem
from services.ai_selector import select_options
from services.resume_parser import compute_experience_years, parse_phone_number


def test_parse_phone_number():
    res1 = parse_phone_number("+91 9876543210")
    assert res1 == {"country_code": "+91", "national_number": "9876543210"}

    res2 = parse_phone_number("+1 4155551234")
    assert res2 == {"country_code": "+1", "national_number": "4155551234"}

    res3 = parse_phone_number("9876543210")
    assert res3 == {"country_code": "", "national_number": "9876543210"}

    res4 = parse_phone_number("09123456789")
    assert res4 == {"country_code": "", "national_number": "09123456789"}


def test_compute_experience_years():
    exp_list = [
        {"company": "Corp A", "start_date": "2021", "end_date": "2024"},
        {"company": "Corp B", "start_date": "2024", "end_date": "Present"}
    ]
    years = compute_experience_years(exp_list)
    assert years != ""
    assert float(years) >= 3.0


def test_ai_select_schemas_and_fallback():
    req = AISelectRequest(
        question="Select your gender",
        options=["Male", "Female", "Non-binary", "Prefer not to say"],
        option_items=[
            OptionItem(index=0, text="Male"),
            OptionItem(index=1, text="Female"),
            OptionItem(index=2, text="Non-binary"),
            OptionItem(index=3, text="Prefer not to say"),
        ],
        profile={"gender": "Male"}
    )
    assert req.question == "Select your gender"
    assert len(req.option_items) == 4
