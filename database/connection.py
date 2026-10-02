"""Database connection.

The original project created a single module-level ``psycopg2`` connection in
``main.py`` and reused it for every request.  This module keeps that exact
behaviour: the connection is created once at import time and reused.

Autocommit mode
---------------
The connection is shared by every request, so without autocommit a single SQL
error anywhere leaves the whole connection inside a failed (aborted) implicit
transaction.  Every later command on that shared connection then fails with
``current transaction is aborted, commands ignored until end of transaction
block``.  Enabling ``autocommit`` makes psycopg2 commit each successful
statement and roll back each failed one immediately, so a bad query can never
poison the connection for the rest of the app.  Individual role connections
are still isolated, so this does not change API behaviour.
"""
import psycopg2

from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

from config import DATABASE_URL

conn = psycopg2.connect(
    DATABASE_URL,
    sslmode="require"
)
conn.autocommit = True