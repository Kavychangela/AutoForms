"""AI-powered field/option selection.

This is the exact logic that previously lived inside the ``/ai-select``
endpoint in ``main.py`` (including the ``build_prompt`` helper).  Nothing has
been changed beyond moving it into functions.
"""
from config import AI_SELECT_MODEL
from services.ai_client import client


def build_prompt(req) -> str:
    profile_summary = "\n".join(
        f"  {k}: {v}" for k, v in req.profile.items() if v
    )
    mode = "one option" if not req.multi_select else "one or more options"
    return f"""You are helping auto-fill a {req.form_purpose} form.

Candidate profile:
{profile_summary}

Form question: "{req.question}"

Available options:
{chr(10).join(f'- {o}' for o in req.options if o)}

Choose {mode} from the list above that best matches this candidate's profile.
Reply with ONLY the exact option text(s), one per line. No explanations."""


def select_options(req):
    prompt = build_prompt(req)

    try:
        response = client.chat.completions.create(
            model=AI_SELECT_MODEL,          # fast + cheap; swap to gpt-4o for higher accuracy
            max_tokens=100,
            temperature=0,                # deterministic — we want the best single answer
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[ai-select] LLM error: {e}")
        return []

    # Parse the response — each line is one chosen option
    lines = [line.strip().lstrip("- ").strip() for line in raw.splitlines() if line.strip()]

    # Validate: only return options that actually exist in the provided list
    option_lower = {o.lower(): o for o in req.options if o}
    validated = []
    for line in lines:
        match = option_lower.get(line.lower())
        if match:
            validated.append(match)
        else:
            # Fuzzy fallback: check if any option contains the returned text
            for orig_lower, orig in option_lower.items():
                if line.lower() in orig_lower or orig_lower in line.lower():
                    if orig not in validated:
                        validated.append(orig)
                    break

    # For single-select, only return the first match
    if not req.multi_select and len(validated) > 1:
        validated = [validated[0]]

    print(f"[ai-select] Q: '{req.question}' | Options: {req.options} | Selected: {validated}")
    return validated