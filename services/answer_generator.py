"""AI answer generation for essay-style form fields."""
from config import ANSWER_GENERATION_MODEL
from services.ai_client import client


def generate_answer(req):
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

    limits_desc = ""
    if hasattr(req, "maxlength") and req.maxlength:
        limits_desc += f"\n- Maximum character limit: {req.maxlength} characters."
    if hasattr(req, "word_limit") and req.word_limit:
        limits_desc += f"\n- Maximum word limit: {req.word_limit} words."

    prompt = f"""You are helping a candidate fill out a {req.form_purpose} form.

Candidate resume information:
{resume_summary}

Question / Field label:
"{req.question}"

Rules:
- Write a professional, personalized answer based strictly on the candidate's background.
- Do NOT invent or embellish any employment history, projects, achievements, technologies, dates, companies, or education not supported by the resume.
- Keep it concise (3-5 sentences max unless specified otherwise).{limits_desc}
- Sound natural and human.
- Do NOT add any preamble, greeting ("Dear Sir/Madam"), or extra text — output only the answer itself.
"""

    response = client.chat.completions.create(
        model=ANSWER_GENERATION_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3
    )

    answer = response.choices[0].message.content.strip()
    return {"answer": answer}