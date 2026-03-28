import sqlite3
import json
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import List, Optional

DB_PATH = "aegisflow.db"


def init_db() -> None:
    """Create tables on startup if they don't exist."""
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS consent_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                resource TEXT NOT NULL,
                scope_granted TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                granted_at TEXT NOT NULL,
                expires_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS action_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                resource TEXT NOT NULL,
                status TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                required_scope TEXT NOT NULL,
                result_message TEXT NOT NULL,
                executed_at TEXT NOT NULL,
                parameters TEXT DEFAULT '{}'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cloud_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                status TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def log_consent(
    user_id: str,
    action_type: str,
    resource: str,
    scope_granted: str,
    risk_level: str,
    expires_at: Optional[str] = None,
) -> int:
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO consent_records
            (user_id, action_type, resource, scope_granted, risk_level, granted_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, action_type, resource, scope_granted, risk_level, now, expires_at),
        )
        conn.commit()
        return cursor.lastrowid


def log_action(
    user_id: str,
    action_type: str,
    resource: str,
    status: str,
    risk_level: str,
    required_scope: str,
    result_message: str,
    parameters: dict,
) -> int:
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO action_logs
            (user_id, action_type, resource, status, risk_level, required_scope,
             result_message, executed_at, parameters)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                action_type,
                resource,
                status,
                risk_level,
                required_scope,
                result_message,
                now,
                json.dumps(parameters),
            ),
        )
        conn.commit()
        return cursor.lastrowid


def upsert_cloud_resource(resource_type: str, resource_id: str, status: str, metadata: dict) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM cloud_state WHERE resource_id = ?", (resource_id,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE cloud_state SET status = ?, metadata = ?, updated_at = ? WHERE resource_id = ?",
                (status, json.dumps(metadata), now, resource_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO cloud_state (resource_type, resource_id, status, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (resource_type, resource_id, status, json.dumps(metadata), now, now),
            )
        conn.commit()


def get_action_logs(limit: int = 20) -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM action_logs ORDER BY executed_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_cloud_state() -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM cloud_state ORDER BY updated_at DESC"
        ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["metadata"] = json.loads(d["metadata"])
            result.append(d)
        return result


def get_consent_records(limit: int = 20) -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM consent_records ORDER BY granted_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
