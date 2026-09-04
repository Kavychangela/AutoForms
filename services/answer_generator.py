"""AI answer generation for essay-style form fields.

This is the exact logic that previously lived inside the ``/generate-answer``
endpoint in ``main.py``.  Nothing has been changed beyond moving it into a
function.
"""
from config import ANSWER_GENERATION_MODEL
from services.ai_client import client


def generate_answer(req):
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
        model=ANSWER_GENERATION_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7   # slight creativity for natural writing
    )

    answer = response.choices[0].message.content.strip()
    return {"answer": answer}