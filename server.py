import csv
import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE = Path(__file__).parent
DATA_DIR = BASE / "data"
DATA_DIR.mkdir(exist_ok=True)

# Session headers (config, board, seed, version) are stored one JSON file per
# session
SESSIONS_DIR = DATA_DIR / "sessions"
SESSIONS_DIR.mkdir(exist_ok=True)

APP_VERSION = "0.1.0"

SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

ACTIVE_TIMEOUT_SECONDS = 10 * 60

STEP_FIELDS = [
    "session_id",
    "step",
    "t_ms",
    "dt_ms",
    "noops_before",
    "moves_left",
    "action",
    "state",
    "flooded",
    "next_state",
    "next_flooded",
    "cells_flooded",
    "next_moves_left",
    "done",
    "logged_at",
]

app = FastAPI()
session: dict[str, dict] = {}
_last_day: str | None = None
_csv_lock = threading.Lock()


class StartResponse(BaseModel):
    session_id : str
    size : int
    num_colors : int
    max_moves : int
    board : str
    seed : int | None = None

class StepRequest(BaseModel):
    session_id : str
    step : int
    t_ms : int
    dt_ms : int = 0
    noops_before : int = 0
    moves_left : int
    action : int 
    state : str
    flooded : str
    next_state : str
    next_flooded : str
    cells_flooded : int
    next_moves_left : int
    done : bool


def _utc_day() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _csv_path(day: str) -> Path:
    return DATA_DIR / f"{day}.csv"


def _append_row(day: str, row: dict) -> None:
    path = _csv_path(day)
    new_file = not path.exists() or path.stat().st_size == 0
    if new_file:
        with path.open("w", newline="", encoding="utf-8-sig") as f:
            csv.DictWriter(f, fieldnames=STEP_FIELDS).writeheader()
    with path.open("a", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=STEP_FIELDS).writerow(row)


def _sort_day(day: str) -> None:
    path = _csv_path(day)
    if not path.exists():
        return

    with path.open("r", newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        return

    rows.sort(key=lambda r: (r["session_id"], int(r["step"])))
    tmp = path.with_suffix(".csv.tmp")
    with tmp.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=STEP_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    os.replace(tmp, path)


def _has_active_players(now: float) -> bool:
    for meta in session.values():
        if meta.get("done"):
            continue
        if now - meta.get("last_seen", 0.0) < ACTIVE_TIMEOUT_SECONDS:
            return True
    return False


def _record_step(req: StepRequest) -> None:
    global _last_day

    today = _utc_day()
    row = req.model_dump()
    row["logged_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

    with _csv_lock:
        if _last_day is not None and today != _last_day:
            _sort_day(_last_day)
        _last_day = today

        _append_row(today, row)

        meta = session.get(req.session_id)
        if meta is not None:
            meta["last_seen"] = time.monotonic()
            if req.done:
                meta["done"] = True
        if not _has_active_players(time.monotonic()):
            _sort_day(today)


def _session_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


def _validate_session_id(session_id: str) -> None:
    if not SESSION_ID_RE.match(session_id):
        raise HTTPException(status_code=400, detail="INVALID SESSION ID")


def _write_session_header(req: StartResponse) -> None:
    path = _session_path(req.session_id)
    tmp = path.with_name(f"{path.name}.tmp")
    header = req.model_dump()
    header["started_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    header["version"] = APP_VERSION
    tmp.write_text(json.dumps(header, indent=2), encoding="utf-8")
    os.replace(tmp, path)


@app.post("/api/session/start")
def start(req : StartResponse):
    _validate_session_id(req.session_id)

    now = time.monotonic()
    session[req.session_id] = {
        "started": now,
        "last_seen": now,
        "done": False,
    }
    _write_session_header(req)
    print(f"[start] {req.session_id[:8]} size={req.size} colors={req.num_colors} "
          f"moves={req.max_moves} seed={req.seed} board={req.board}")
    return {"ok" : True}

@app.post("/api/session/step")
def step(req : StepRequest):
    _validate_session_id(req.session_id)

    if req.session_id not in session:
        raise HTTPException(status_code=404, detail="UNKNOWN SESSION")

    _record_step(req)

    print(f"[{req.session_id[:8]} step {req.step}] t={req.t_ms}ms (+{req.dt_ms}ms) "
          f"noops={req.noops_before} moves {req.moves_left}->{req.next_moves_left} "
          f"action={req.action} flooded +{req.cells_flooded} done={req.done}")
    print(f"    before: {req.state} / {req.flooded}")
    print(f"    after : {req.next_state} / {req.next_flooded}")
    return{"ok": True}

@app.get("/api/ping")
def ping():
    return {"ok": True}

@app.get("/")
def index():
    return FileResponse(BASE/"index.html")

@app.get("/style.css")
def css():
    return FileResponse(BASE/"style.css", media_type="text/css")

@app.get("/script.js")
def js():
    return FileResponse(BASE/"script.js", media_type="application/javascript")
