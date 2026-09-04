"""Resume parsing: PDF text → structured resume via the LLM, stored in the DB.

This is the exact logic that previously lived inside the ``/parse-resume``
endpoint in ``main.py``.  Nothing has been changed beyond moving it into a
function.
"""
import json
import re

from config import RESUME_PARSE_MODEL
from database.connection import conn
from services.ai_client import client


def parse_and_store_resume(text):
    prompt = f"""
        You are a strict JSON generator.

        Return ONLY valid JSON. No explanation, no markdown, no backticks.

        Format:
        {{
          "name": "",
          "email": "",
          "phone": "",
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
          "skills": [],
          "summary": "",
          "experience": "",
          "dob": "",
          "gender": "",
          "nationality": "",
          "languages": ""
        }}

        Rules:
        - If a field is not found in the resume, return an empty string "" for it.
        - For skills, return a JSON array of strings.
        - For summary, write a 2-3 sentence professional summary based on the resume.
        - For experience, write a brief paragraph describing work history.
        - Do NOT add any explanation or text outside the JSON object.

        Resume:
        {text}
        """

    response = client.chat.completions.create(
        model=RESUME_PARSE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    raw_output = response.choices[0].message.content

    match = re.search(r"\{.*\}", raw_output, re.DOTALL)

    if match:
        try:
            parsed = json.loads(match.group())
        except Exception:
            parsed = {"error": "Bad JSON from LLM", "raw": raw_output}
    else:
        parsed = {"error": "No JSON found in LLM response", "raw": raw_output}

    # ✅ Insert into DB only if valid
    resume_id = None
    if "error" not in parsed:
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
                    parsed.get("phone"),
                    json.dumps(parsed)
                )
            )

            row = cur.fetchone()

            if row:
                resume_id = row[0]
            else:
                resume_id = None

            # The shared connection runs in autocommit mode, so the write is
            # already committed; this call is kept for explicit clarity and is
            # a documented no-op under autocommit.  The INSERT's failure state
            # is rolled back automatically, so it can never poison the shared
            # connection with an aborted transaction.
            conn.commit()

    return {
        "resume_id": resume_id,  # temp (we'll improve later)
        **parsed
    }