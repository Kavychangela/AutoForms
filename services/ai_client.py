from openai import OpenAI

from config import GROQ_API_KEY, GROQ_BASE_URL

# Created once at import time, exactly like the original single module-level
# client in main.py.
client = OpenAI(
    api_key=GROQ_API_KEY,   # Read from .env, never hardcoded
    base_url=GROQ_BASE_URL
)