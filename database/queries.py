"""Database helper queries.

Kept as a thin wrapper around the original inline SQL so behaviour is identical.
"""


def save_resume(cur, name, email, phone, raw_json):
    """Insert a parsed resume and return the new id (or None if unavailable)."""
    cur.execute(
        """
            INSERT INTO resumes (name, email, phone, raw_json)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """,
        (name, email, phone, raw_json),
    )

    row = cur.fetchone()

    if row:
        resume_id = row[0]
    else:
        resume_id = None

    return resume_id