from fastapi import FastAPI, UploadFile, File
import pdfplumber
from openai import OpenAI
import json
import os
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import re

load_dotenv()  # Loads variables from .env file

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),   # Read from .env, never hardcoded
    base_url="https://api.groq.com/openai/v1"
)

def extract_text_from_pdf(file):
    text = ""
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            text += (page.extract_text() or "") + "\n"
    return text

@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    try:
        text = extract_text_from_pdf(file.file)

        if not text.strip():
            return {"error": "No text extracted from PDF"}

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
            model="llama-3.3-70b-versatile",
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

        return parsed

    except Exception as e:
        return {"error": str(e)}


# ─── AI Answer Generation ─────────────────────────────────────────────────────

from pydantic import BaseModel
from typing import Optional

class AnswerRequest(BaseModel):
    question: str
    context: dict          # the parsed resume data
    form_purpose: Optional[str] = "job application"  # e.g. "internship", "college", "job application"

@app.post("/generate-answer")
async def generate_answer(req: AnswerRequest):
    try:
        # Build a compact resume summary for the prompt
        ctx = req.context
        skills = ", ".join(ctx.get("skills", [])) if isinstance(ctx.get("skills"), list) else ctx.get("skills", "")
        resume_summary = f"""
Name: {ctx.get("name", "")}
College: {ctx.get("college", "")}
Degree: {ctx.get("degree", "")} in {ctx.get("branch", "")}
Graduation Year: {ctx.get("graduation_year", "")}
GPA: {ctx.get("gpa", "")}
Skills: {skills}
Experience: {ctx.get("experience", "")}
Current Role: {ctx.get("current_role", "")}
Current Company: {ctx.get("current_company", "")}
Summary: {ctx.get("summary", "")}
        """.strip()

        prompt = f"""
You are helping a candidate fill out a {req.form_purpose} form.

Here is the candidate's resume information:
{resume_summary}

The form has this question/field:
"{req.question}"

Write a professional, personalized answer for this question based on the candidate's background.

Rules:
- Keep it concise: 3-5 sentences max unless the question clearly requires more
- Sound natural and human, not like a template
- Be specific — use actual details from the resume (skills, college, projects, experience)
- Do NOT start with "I am writing to..." or "Dear Sir/Madam"
- Do NOT add any preamble, explanation, or extra text — just the answer itself
- If the question is about motivation or goals, connect it to their actual background
        """

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7   # slight creativity for natural writing
        )

        answer = response.choices[0].message.content.strip()
        return {"answer": answer}

    except Exception as e:
        return {"error": str(e)}