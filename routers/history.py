"""Form-filling history routes."""
from fastapi import APIRouter

from database.connection import conn
from schemas.resume import HistoryRequest

router = APIRouter()


@router.post("/save-history")
def save_history(req: HistoryRequest):
    with conn.cursor() as cur:
        try:
            cur.execute(
                """
                    INSERT INTO form_history (resume_id, website, fields_filled, ai_answers)
                    VALUES (%s, %s, %s, %s)
                """,
                (
                    req.resume_id,
                    req.website,
                    req.fields_filled,
                    req.ai_answers
                )
            )

            # The shared connection runs in autocommit mode, so the write is
            # already committed; this call is kept for explicit clarity and is
            # a documented no-op under autocommit.
            conn.commit()

            print("HIT SAVE HISTORY:", req)

            return {"status": "saved"}

        except Exception as e:
            # Defensive: clears any failed statement state on the shared
            # connection so subsequent requests are never poisoned.
            conn.rollback()
            print("SAVE HISTORY ERROR:", e)
            return {"error": str(e)}