"""Resume parsing: PDF text -> structured resume via LLM, stored in DB."""
import datetime
import json
import re

from config import RESUME_PARSE_MODEL
from database.connection import conn
from services.ai_client import client


def parse_phone_number(phone_str: str) -> dict:
    if not phone_str:
        return {"country_code": "", "national_number": ""}
    
    trimmed = str(phone_str).strip()
    
    if trimmed.startswith("+"):
        match = re.match(r"^\+(\d{1,3})[\s\-]?(\d{6,14})$", trimmed)
        if match:
            return {"country_code": "+" + match.group(1), "national_number": match.group(2)}
        digits = re.sub(r"\D", "", trimmed)
        if len(digits) > 10:
            cc_len = len(digits) - 10
            return {"country_code": "+" + digits[:cc_len], "national_number": digits[cc_len:]}
        return {"country_code": "+" + digits[:2], "national_number": digits[2:]}
    
    clean_digits = re.sub(r"\D", "", trimmed)
    if len(clean_digits) == 10:
        return {"country_code": "", "national_number": clean_digits}
    if len(clean_digits) == 11 and clean_digits.startswith("0"):
        return {"country_code": "", "national_number": clean_digits}
    if len(clean_digits) == 12 and clean_digits.startswith("91"):
        return {"country_code": "+91", "national_number": clean_digits[2:]}
    
    return {"country_code": "", "national_number": clean_digits}


def compute_experience_years(experience_list: list) -> str:
    """Calculate total experience years deterministically from experience dates."""
    if not isinstance(experience_list, list) or not experience_list:
        return ""
    
    current_year = datetime.date.today().year
    total_months = 0
    
    for item in experience_list:
        if not isinstance(item, dict):
            continue
        s_date = str(item.get("start_date", "")).strip()
        e_date = str(item.get("end_date", "")).strip()
        
        s_match = re.search(r"\b(19\d\d|20\d\d)\b", s_date)
        if not s_match:
            continue
        start_yr = int(s_match.group(1))
        
        if not e_date or "present" in e_date.lower() or "current" in e_date.lower() or "now" in e_date.lower():
            end_yr = current_year
        else:
            e_match = re.search(r"\b(19\d\d|20\d\d)\b", e_date)
            end_yr = int(e_match.group(1)) if e_match else current_year
            
        if end_yr >= start_yr:
            total_months += (end_yr - start_yr) * 12
            
    if total_months > 0:
        years = round(total_months / 12.0, 1)
        return str(years).rstrip(".0")
    return ""


def run_ocr_fallback_if_needed(text: str) -> str:
    """If text is empty or < 30 chars, attempt OCR if pytesseract is available."""
    if len(text.strip()) >= 30:
        return text
    print("[resume_parser] Minimal text detected. Checking OCR fallback...")
    try:
        import pytesseract
        print("[resume_parser] pytesseract is installed.")
    except ImportError:
        print("[resume_parser] OCR module (pytesseract) not available; returning raw text.")
    return text


def parse_and_store_resume(text: str) -> dict:
    text = run_ocr_fallback_if_needed(text)
    current_year = datetime.date.today().year

    prompt = f"""You are a strict JSON generator for resume parsing.

Return ONLY valid JSON. No explanation, no markdown, no backticks.

Output Format:
{{
  "name": "",
  "first_name": "",
  "last_name": "",
  "email": "",
  "phone": {{
    "country_code": "",
    "national_number": ""
  }},
  "address": "",
  "city": "",
  "state": "",
  "country": "",
  "pincode": "",
  "linkedin": "",
  "github": "",
  "portfolio": "",
  "twitter": "",
  "college": "",
  "degree": "",
  "branch": "",
  "graduation_year": "",
  "gpa": "",
  "tenth_percentage": "",
  "twelfth_percentage": "",
  "current_company": "",
  "current_role": "",
  "experience_years": "",
  "notice_period": "",
  "current_ctc": "",
  "expected_ctc": "",
  "education": [
    {{
      "degree": "",
      "institution": "",
      "start_date": "",
      "end_date": "",
      "percentage": null,
      "cgpa": null
    }}
  ],
  "experience": [
    {{
      "company": "",
      "role": "",
      "start_date": "",
      "end_date": "",
      "description": ""
    }}
  ],
  "projects": [
    {{
      "name": "",
      "description": "",
      "technologies": []
    }}
  ],
  "skills": [],
  "summary": "",
  "dob": "",
  "gender": "",
  "nationality": "",
  "languages": ""
}}

Rules:
- Current year is {current_year}.
- If a field is not present in the resume, return empty string "" or null (do NOT fabricate defaults like "India", "Indian", "Immediate", or "English, Hindi").
- Do NOT put full address into the city field. City must be ONLY the city name (e.g., "Pune", "Mumbai", "New York"). If city cannot be identified, return "".
- For skills, return a JSON array of strings.
- For links, check extracted text and hyperlink section.

Resume Text:
{text}
"""

    parsed = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=RESUME_PARSE_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )
            raw_output = response.choices[0].message.content
            match = re.search(r"\{.*\}", raw_output, re.DOTALL)
            if match:
                parsed = json.loads(match.group())
                break
        except Exception as e:
            print(f"[resume_parser] Parse attempt {attempt + 1} failed: {e}")

    if not parsed or not isinstance(parsed, dict):
        parsed = {
            "name": "", "email": "", "phone": "", "address": "", "city": "",
            "state": "", "country": "", "pincode": "", "linkedin": "", "github": "",
            "portfolio": "", "college": "", "degree": "", "skills": [], "summary": ""
        }

    # Normalize phone format
    phone_data = parsed.get("phone")
    if isinstance(phone_data, str):
        parsed["phone"] = parse_phone_number(phone_data)
        parsed["phone_raw"] = phone_data
    elif isinstance(phone_data, dict):
        parsed["phone_raw"] = f"{phone_data.get('country_code', '')} {phone_data.get('national_number', '')}".strip()
    else:
        parsed["phone"] = {"country_code": "", "national_number": ""}
        parsed["phone_raw"] = ""

    # Derive names if missing
    if not parsed.get("first_name") and parsed.get("name"):
        parts = parsed["name"].strip().split()
        parsed["first_name"] = parts[0]
        parsed["last_name"] = " ".join(parts[1:]) if len(parts) > 1 else ""

    # Deterministic experience years calculation
    if isinstance(parsed.get("experience"), list) and parsed["experience"]:
        calc_exp = compute_experience_years(parsed["experience"])
        if calc_exp:
            parsed["experience_years"] = calc_exp

    # Insert into DB only if valid
    resume_id = None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                    INSERT INTO resumes (name, email, phone, raw_json)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """,
                (
                    parsed.get("name"),
                    parsed.get("email"),
                    parsed.get("phone_raw"),
                    json.dumps(parsed)
                )
            )
            row = cur.fetchone()
            if row:
                resume_id = row[0]
            conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[resume_parser] DB Insert error: {e}")

    parsed["resume_id"] = resume_id
    return parsed