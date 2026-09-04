"""Form-filling history routes."""
from fastapi import APIRouter

from database.connection import conn
from schemas.resume import HistoryRequest

router = APIRouter()


@router.post("/save-history")
def save_history(req: HistoryRequest):
    cur = conn.cursor()

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

        conn.commit()

        print("HIT SAVE HISTORY:", req)

        return {"status": "saved"}

    except Exception as e:
        conn.rollback()
        print("SAVE HISTORY ERROR:", e)
        return {"error": str(e)}

    finally:
        cur.close()