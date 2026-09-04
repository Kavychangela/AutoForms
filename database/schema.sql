-- AutoForms AI — PostgreSQL schema
-- ----------------------------------------------------------------------------
-- The backend expects exactly two tables: `resumes` and `form_history`.
-- Create them in the database configured in `.env` (default: `autoforms_db`):
--
--     psql -U postgres -d autoforms_db -f database/schema.sql
--
-- NOTE: these CREATE TABLE statements are additive/guarded with `IF NOT EXISTS`
-- and keep the column names/order used by the code in services/resume_parser.py
-- and routers/history.py.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS resumes (
    id        SERIAL PRIMARY KEY,
    name      TEXT,
    email     TEXT,
    phone     TEXT,
    raw_json  JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_history (
    id            SERIAL PRIMARY KEY,
    resume_id     INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
    website       TEXT,
    fields_filled INTEGER,
    ai_answers    INTEGER,
    created_at    TIMESTAMP DEFAULT NOW()
);