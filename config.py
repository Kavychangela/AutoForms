"""Application configuration loaded from environment variables.

The original project loaded ``GROQ_API_KEY`` from ``.env`` and passed it
directly to the Groq/OpenAI client.  Database credentials were hardcoded in
``main.py``; they are moved here so they can be supplied via environment
variables instead (backed by the same values through ``.env``/``.env.example``).
"""
import os

from dotenv import load_dotenv

# Loads variables from .env file (kept at project root)
load_dotenv()

# ── Groq / OpenAI (via the OpenAI SDK pointed at Groq's endpoint) ─────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# ── AI models used by the original endpoints (unchanged) ──────────────────────
# NOTE: the original default "llama-3.3-70b-versatile" is not available on this
# Groq account (404 model_not_found).  Switched to openai/gpt-oss-120b, which is
# confirmed present via GET /models on the configured API key.
RESUME_PARSE_MODEL = "openai/gpt-oss-120b"
ANSWER_GENERATION_MODEL = "openai/gpt-oss-120b"
AI_SELECT_MODEL = "openai/gpt-oss-120b"

# ── Groq API base URL (OpenAI-compatible endpoint) ─────────────────────────────
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# ── PostgreSQL connection settings ─────────────────────────────────────────────
# The original code connected to the local PostgreSQL instance with these
# values hardcoded.  They are now read from environment variables with the
# original values as defaults so the running behaviour is unchanged.
DATABASE_URL = os.getenv("DATABASE_URL")
