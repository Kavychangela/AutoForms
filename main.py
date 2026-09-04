"""AutoForms AI — FastAPI application entry point.

The original single-file backend (main.py) was split into focused modules:

- schemas/   → request/response Pydantic models
- database/  → PostgreSQL connection + queries
- services/  → AI clients, resume parsing, answer generation, option selection
- routers/   → API endpoint definitions
- utils/     → PDF extraction
- config.py  → environment-variable based configuration

Every endpoint, request format and response format is identical to the
original implementation.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import answers, history, resume, selection

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router)
app.include_router(answers.router)
app.include_router(selection.router)
app.include_router(history.router)