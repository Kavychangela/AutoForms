import json
import re
from typing import Any

from config import AI_SELECT_MODEL
from schemas.selection import AISelectRequest, AISelectResponse, FillPlanRequest, FillPlanResponse
from services.ai_client import client


def build_select_prompt(req: AISelectRequest) -> str:
    profile_summary = "\n".join(
        f"  {k}: {v}" for k, v in req.profile.items() if v
    )
    
    # Build list of options with 0-based indices
    options_formatted = []
    if req.option_items:
        for opt in req.option_items:
            options_formatted.append(f"[{opt.index}] {opt.text}")
    else:
        for idx, opt in enumerate(req.options):
            options_formatted.append(f"[{idx}] {opt}")
            
    mode = "one option index" if not req.multi_select else "a list of option indices"
    
    return f"""You are helping auto-fill a {req.form_purpose} form.

Candidate profile:
{profile_summary}

Form question: "{req.question}"

Available options:
{chr(10).join(options_formatted)}

Instructions:
- Select {mode} that accurately corresponds to the candidate's profile.
- Return valid JSON in this exact format: {{"selected_indices": [0]}} or {{"selected_indices": null}} if the candidate's profile does not provide enough evidence to answer.
- CRITICAL: Do NOT guess sensitive attributes (gender, race/ethnicity, disability, veteran status, religion, citizenship, work authorization, salary expectations, notice period) if not explicitly present in the profile.
- For sensitive questions, if an option like "Prefer not to say" or "Decline to answer" exists and profile is silent, you may select its index.
- If you cannot determine the answer with high confidence, return {{"selected_indices": null}}.
- Reply ONLY with the JSON object."""


def select_options(req: AISelectRequest) -> AISelectResponse:
    options_count = len(req.option_items) if req.option_items else len(req.options)
    if options_count == 0:
        return AISelectResponse(selected=[], selected_indices=[], selected_index=None)

    prompt = build_select_prompt(req)

    raw_output = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=AI_SELECT_MODEL,
                max_tokens=500,
                temperature=0,
                messages=[{"role": "user", "content": prompt}]
            )
            raw_output = response.choices[0].message.content.strip()
            
            match = re.search(r"\{.*\}", raw_output, re.DOTALL)
            if match:
                data = json.loads(match.group())
                selected_indices = data.get("selected_indices")
                
                if selected_indices is None or selected_indices == []:
                    return AISelectResponse(selected=[], selected_indices=[], selected_index=None)
                
                if isinstance(selected_indices, int):
                    selected_indices = [selected_indices]
                
                if isinstance(selected_indices, list):
                    valid_indices = [
                        idx for idx in selected_indices
                        if isinstance(idx, int) and 0 <= idx < options_count
                    ]
                    
                    if not req.multi_select and len(valid_indices) > 1:
                        valid_indices = [valid_indices[0]]
                        
                    # Build text fallback array
                    selected_texts = []
                    for idx in valid_indices:
                        if req.option_items:
                            item = next((o for o in req.option_items if o.index == idx), None)
                            if item: selected_texts.append(item.text)
                        elif 0 <= idx < len(req.options):
                            selected_texts.append(req.options[idx])
                            
                    sel_index = valid_indices[0] if valid_indices else None
                    return AISelectResponse(
                        selected=selected_texts,
                        selected_indices=valid_indices,
                        selected_index=sel_index
                    )
        except Exception as e:
            print(f"[ai-select] Attempt {attempt + 1} failed: {e}")

    print(f"[ai-select] Unresolvable response for question '{req.question}': {raw_output}")
    return AISelectResponse(selected=[], selected_indices=[], selected_index=None)


def generate_fill_plan(req: FillPlanRequest) -> FillPlanResponse:
    if not req.fields:
        return FillPlanResponse(plan={})

    profile_summary = "\n".join(
        f"  {k}: {v}" for k, v in req.profile.items() if v
    )

    fields_desc = []
    for f in req.fields:
        opts_str = ""
        if f.options:
            formatted_opts = []
            for idx, opt in enumerate(f.options):
                opt_text = opt.text if hasattr(opt, "text") else (opt.get("text") if isinstance(opt, dict) else str(opt))
                formatted_opts.append(f"[{idx}] {opt_text}")
            opts_str = f" | Options: {', '.join(formatted_opts)}"
        
        limits = ""
        if f.maxlength: limits += f" (maxlength: {f.maxlength})"
        fields_desc.append(
            f"- ID: {f.id} | Label: \"{f.label}\" | Type: {f.field_type} | Autocomplete: \"{f.autocomplete}\"{limits}{opts_str}"
        )

    prompt = f"""You are an automated form filling AI for a {req.form_purpose}.

Candidate profile:
{profile_summary}

Fields to fill:
{chr(10).join(fields_desc)}

Rules:
1. For text/textarea fields: return the exact factual string value from the candidate profile. Stay strictly within length limits. If the profile does not provide enough evidence, return null.
2. For select/radio fields: return the integer 0-based option index (e.g. 0, 1, 2) that best matches the candidate profile. If the profile does not support an answer, return null.
3. For checkbox fields: return a list of integer 0-based option indices, or null if no options apply.
4. Never guess or fabricate sensitive attributes (gender, race/ethnicity, disability, veteran status, religion, citizenship, work authorization, salary expectations, notice period). If missing from profile, return null.
5. Return ONLY a JSON object mapping field IDs to values/indices or null.

Example output format:
{{
  "f_0": "John",
  "f_1": 0,
  "f_2": null
}}"""

    plan = {}
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=AI_SELECT_MODEL,
                max_tokens=1000,
                temperature=0,
                messages=[{"role": "user", "content": prompt}]
            )
            raw = response.choices[0].message.content.strip()
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                plan = json.loads(match.group())
                break
        except Exception as e:
            print(f"[fill-plan] Attempt {attempt + 1} error: {e}")

    # Validate output map keys
    validated_plan = {}
    field_map = {f.id: f for f in req.fields}
    for fid, val in plan.items():
        if fid in field_map:
            validated_plan[fid] = val
        else:
            validated_plan[fid] = None

    return FillPlanResponse(plan=validated_plan)