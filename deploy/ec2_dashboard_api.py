import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", "/var/lib/hongshaoniuroumian/events.db"))
MODAL_SCORE_URL = os.environ.get("MODAL_SCORE_URL", "")
INGEST_API_KEY = os.environ.get("INGEST_API_KEY", "")
WINDOW_SIZE = 100


def connection() -> sqlite3.Connection:
    database = sqlite3.connect(DATABASE_PATH)
    database.row_factory = sqlite3.Row
    return database


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connection() as database:
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                raw_line TEXT NOT NULL,
                template_id INTEGER,
                template TEXT,
                template_similarity REAL,
                parameter_similarity REAL,
                scored INTEGER NOT NULL,
                matched_by_similarity INTEGER NOT NULL DEFAULT 0,
                matched_template_similarity REAL,
                score_error TEXT
            )
            """
        )
        database.execute(
            "CREATE INDEX IF NOT EXISTS events_recorded_at ON events(recorded_at)"
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="HongShaoNiuRouMian EC2 Dashboard API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("DASHBOARD_ORIGIN", "http://localhost:5173").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


class IngestRequest(BaseModel):
    line: str = Field(min_length=1, max_length=16_384)


def recent_history(database: sqlite3.Connection) -> list[str]:
    rows = database.execute(
        "SELECT raw_line FROM events ORDER BY id DESC LIMIT ?", (WINDOW_SIZE,)
    ).fetchall()
    return [row["raw_line"] for row in reversed(rows)]


def score_event(history_lines: list[str], line: str) -> dict:
    if not MODAL_SCORE_URL or not INGEST_API_KEY:
        return {"error": "Modal scoring is not configured"}

    try:
        response = requests.post(
            MODAL_SCORE_URL,
            headers={"X-Api-Key": INGEST_API_KEY},
            json={
                "source_id": os.environ.get("SOURCE_ID", "ec2-ssh"),
                "history_lines": history_lines,
                "line": line,
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as error:
        return {"error": f"Modal scoring request failed: {error}"}


@app.post("/api/ingest")
def ingest_log(request: IngestRequest) -> dict:
    with connection() as database:
        result = score_event(recent_history(database), request.line)
        database.execute(
            """
            INSERT INTO events (
                raw_line, template_id, template, template_similarity,
                parameter_similarity, scored, matched_by_similarity,
                matched_template_similarity, score_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.line,
                result.get("template_id"),
                result.get("template"),
                result.get("template_similarity"),
                result.get("parameter_similarity"),
                int(result.get("scored", False)),
                int(result.get("matched_by_similarity", False)),
                result.get("matched_template_similarity"),
                result.get("error"),
            ),
        )
        event_id = database.execute("SELECT last_insert_rowid()").fetchone()[0]

    return {"id": event_id, **result}


@app.get("/api/events")
def get_events(limit: int = 200) -> list[dict]:
    limit = min(max(limit, 1), 1_000)
    with connection() as database:
        rows = database.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(row) for row in reversed(rows)]


@app.get("/api/metrics/anomalies-per-hour")
def anomalies_per_hour(threshold: float = 0.95, hours: int = 24) -> list[dict]:
    hours = min(max(hours, 1), 24 * 90)
    with connection() as database:
        rows = database.execute(
            """
            SELECT
                substr(recorded_at, 1, 13) || ':00:00Z' AS hour,
                COUNT(*) AS anomalies
            FROM events
            WHERE scored = 1
              AND template_similarity < ?
              AND recorded_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
            GROUP BY hour
            ORDER BY hour
            """,
            (threshold, f"-{hours} hours"),
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/metrics/summary")
def summary(threshold: float = 0.95) -> dict:
    with connection() as database:
        row = database.execute(
            """
            SELECT
                COUNT(*) AS total_events,
                SUM(scored) AS scored_events,
                SUM(CASE WHEN scored = 1 AND template_similarity < ? THEN 1 ELSE 0 END) AS anomalies
            FROM events
            """,
            (threshold,),
        ).fetchone()
    return dict(row)
