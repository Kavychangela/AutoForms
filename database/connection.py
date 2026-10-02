"""Database connection."""
import psycopg2

from config import DATABASE_URL


class LazyConnection:
    def __init__(self):
        self._conn = None

    def get_conn(self):
        if self._conn is None or getattr(self._conn, "closed", 1) != 0:
            try:
                self._conn = psycopg2.connect(DATABASE_URL, sslmode="require")
                self._conn.autocommit = True
            except Exception as e:
                print(f"[database] Warning: Failed to connect to DB: {e}")
                return None
        return self._conn

    def cursor(self):
        c = self.get_conn()
        if c is None:
            class DummyCursor:
                def __enter__(self): return self
                def __exit__(self, *args): pass
                def execute(self, *args, **kwargs): pass
                def fetchone(self): return None
            return DummyCursor()
        return c.cursor()

    def commit(self):
        if self._conn and getattr(self._conn, "closed", 1) == 0:
            try:
                self._conn.commit()
            except Exception:
                pass

    def rollback(self):
        if self._conn and getattr(self._conn, "closed", 1) == 0:
            try:
                self._conn.rollback()
            except Exception:
                pass


conn = LazyConnection()