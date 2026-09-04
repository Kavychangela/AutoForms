"""Database connection.

The original project created a single module-level ``psycopg2`` connection in
``main.py`` and reused it for every request.  This module keeps that exact
behaviour: the connection is created once at import time and reused.
"""
import psycopg2

from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

conn = psycopg2.connect(
    host=DB_HOST,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD,
    port=DB_PORT,
)