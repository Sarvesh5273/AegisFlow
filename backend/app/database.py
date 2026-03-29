import sqlite3
import json
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import List, Optional

DB_PATH = "aegisflow.db"


def init_db() -> None:
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
                vault_used INTEGER DEFAULT 0,
                parameters TEXT DEFAULT '{}'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS github_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                action TEXT NOT NULL,
                repo TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                created_at TEXT NOT NULL
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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_consent(
    user_id: str,
    action_type: str,
    resource: str,
    scope_granted: str,
    risk_level: str,
    expires_at: Optional[str] = None,
) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO consent_records
               (user_id, action_type, resource, scope_granted, risk_level, granted_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user_id, action_type, resource, scope_granted, risk_level, _now(), expires_at),
        )
        conn.commit()
        return cur.lastrowid


def log_action(
    user_id: str,
    action_type: str,
    resource: str,
    status: str,
    risk_level: str,
    required_scope: str,
    result_message: str,
    parameters: dict,
    vault_used: bool = False,
) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO action_logs
               (user_id, action_type, resource, status, risk_level, required_scope,
                result_message, executed_at, vault_used, parameters)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id, action_type, resource, status, risk_level,
                required_scope, result_message, _now(),
                1 if vault_used else 0, json.dumps(parameters),
            ),
        )
        conn.commit()
        return cur.lastrowid


def log_github_state(user_id: str, action: str, repo: str, metadata: dict) -> None:
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO github_state (user_id, action, repo, metadata, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (user_id, action, repo, json.dumps(metadata), _now()),
        )
        conn.commit()


def get_action_logs(limit: int = 20) -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM action_logs ORDER BY executed_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_github_state(limit: int = 20) -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM github_state ORDER BY created_at DESC LIMIT ?", (limit,)
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
