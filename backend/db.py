"""SQLite 持久层（原生 sqlite3，无 ORM）。

对外只暴露四个函数，与「秋招军师」保持同一风格：
- query(sql, params)      -> list[dict]
- query_one(sql, params)  -> dict | None
- execute(sql, params)    -> lastrowid
- init_db()               -> 建表（幂等）

内容数据（知识点/题目）存 Markdown 文件，本库只存学习者产生的数据。
"""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS topic_progress (
    topic_slug TEXT PRIMARY KEY,
    learned    INTEGER NOT NULL DEFAULT 0,
    learned_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS problem_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_slug TEXT NOT NULL,
    code        TEXT NOT NULL DEFAULT '',
    passed      INTEGER NOT NULL,
    total       INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS problem_mastery (
    problem_slug  TEXT PRIMARY KEY,
    status        TEXT NOT NULL DEFAULT 'wrong',   -- wrong | passed
    pass_count    INTEGER NOT NULL DEFAULT 0,
    fail_count    INTEGER NOT NULL DEFAULT 0,
    last_passed_at TEXT,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_slug TEXT NOT NULL,
    quiz_index INTEGER NOT NULL,
    correct    INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS bench_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_slug TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
"""


@contextmanager
def _connect():
    """借出一个连接，退出时提交事务并 close。

    注意：sqlite3 连接对象的 `with conn` 只管事务（commit/rollback），
    并不会关闭连接，靠 CPython 引用计数兜底在异常路径下会滞留句柄，
    所以这里显式 close。
    """
    Path(config.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")  # 每连接生效
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def query(sql: str, params: tuple = ()) -> list[dict]:
    with _connect() as conn:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]


def query_one(sql: str, params: tuple = ()) -> dict | None:
    with _connect() as conn:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None


def execute(sql: str, params: tuple = ()) -> int:
    with _connect() as conn:
        cursor = conn.execute(sql, params)
        return cursor.lastrowid


def init_db() -> None:
    with _connect() as conn:
        # journal_mode 是数据库级持久属性，建库时设一次即可
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)
