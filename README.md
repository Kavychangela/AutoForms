# AutoForms AI

## Description
AutoForms AI is a Chrome extension + FastAPI backend that parses a resume PDF with an LLM, then auto-fills form fields using LLM-generated answers and AI-based option selection. It also stores form fill history in PostgreSQL.

## Features
- Parse PDF resumes into structured JSON using an LLM
- Generate AI answers for essay fields
- Select matching radio/checkbox options using an LLM
- Save form fill history to PostgreSQL

## Project Structure
- `main.py` — FastAPI entry point
- `routers/` — API route definitions
- `services/` — AI/resume parsing/business logic
- `database/` — PostgreSQL connection + queries
- `schemas/` — Pydantic request/response models
- `utils/` — PDF parsing utilities
- `extension/` — Chrome extension files

## Requirements
- Python 3.10+
- PostgreSQL running with the tables expected by the app (`resumes`, `form_history`)
- A `GROQ_API_KEY` in `.env`

## Installation
1. Clone/open the project in your local environment.
2. Create and activate a virtual environment (recommended).
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Set `GROQ_API_KEY` and (optionally) DB settings.

## Environment Setup
Edit `.env`:
- `GROQ_API_KEY`
- DB settings (optional; defaults match the original project)

## Running the Backend
```bash
uvicorn main:app --reload
```

## Chrome Extension Setup
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked extension from the `extension/` folder

## API Overview
Endpoints (used by the extension):
- `POST /parse-resume` (multipart form-data with `file`)
- `POST /generate-answer` (JSON)
- `POST /ai-select` (JSON)
- `POST /save-history` (JSON)

## Technologies Used
- FastAPI
- PostgreSQL (psycopg2)
- pdfplumber
- Groq/OpenAI via OpenAI SDK
