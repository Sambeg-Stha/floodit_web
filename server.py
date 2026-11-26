import csv
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

# One CSV file per session, named by session id
SESSIONS_DIR = DATA_DIR / "sessions"
SESSIONS_DIR.mkdir(exist_ok=True)

SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

ACTIVE_TIMEOUT_SECONDS = 10 * 60

STEP_FIELDS = [
    "session_id",
    "timestep",
    "board",
    "moves_left",
    "action",
    "next_board",
    "next_moves_left",
    "was_solved",
    "timestamp",
]

app = FastAPI()
session: dict[str, dict] = {}
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
    solved : bool = False


def _csv_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.csv"


def _append_row(session_id: str, row: dict) -> None:
    path = _csv_path(session_id)
    new_file = not path.exists() or path.stat().st_size == 0
    if new_file:
        with path.open("w", newline="", encoding="utf-8-sig") as f:
            csv.DictWriter(f, fieldnames=STEP_FIELDS).writeheader()
    with path.open("a", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=STEP_FIELDS).writerow(row)


def _sort_session(session_id: str, solved: bool | None = None) -> None:
    path = _csv_path(session_id)
    if not path.exists():
        return

    with path.open("r", newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        return

    rows.sort(key=lambda r: int(r["timestep"]))
    if solved is not None:
        for row in rows:
            row["was_solved"] = str(solved)

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
    now = time.monotonic()
    meta = session.get(req.session_id)
    solved = req.solved or bool(meta and meta.get("solved"))

    row = {
        "session_id": req.session_id,
        "timestep": req.step,
        "board": req.state,
        "moves_left": req.moves_left,
        "action": req.action,
        "next_board": req.next_state,
        "next_moves_left": req.next_moves_left,
        "was_solved": solved,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    with _csv_lock:
        _append_row(req.session_id, row)

        if meta is not None:
            meta["last_seen"] = now
            if req.solved:
                meta["solved"] = True
                meta["done"] = True
            elif req.done:
                meta["done"] = True
        if solved or req.done or not _has_active_players(now):
            _sort_session(req.session_id, solved=True if solved else None)


def _validate_session_id(session_id: str) -> None:
    if not SESSION_ID_RE.match(session_id):
        raise HTTPException(status_code=400, detail="INVALID SESSION ID")


@app.post("/api/session/start")
def start(req : StartResponse):
    _validate_session_id(req.session_id)

    now = time.monotonic()
    session[req.session_id] = {
        "started": now,
        "last_seen": now,
        "done": False,
    }
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


@app.get("/api/sessions")
def list_sessions():
    files = sorted(
        SESSIONS_DIR.glob("*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    sessions = []
    for path in files:
        try:
            with path.open("r", newline="", encoding="utf-8-sig") as f:
                rows = list(csv.DictReader(f))
        except OSError:
            continue
        sessions.append({
            "session_id": path.stem,
            "steps": len(rows),
            "was_solved": any(r.get("was_solved") == "True" for r in rows),
            "last_timestamp": rows[-1].get("timestamp") if rows else None,
        })
    return {"sessions": sessions}


@app.get("/api/sessions/{session_id}")
def session_rows(session_id: str):
    _validate_session_id(session_id)
    path = _csv_path(session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="UNKNOWN SESSION")

    with path.open("r", newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    rows.sort(key=lambda r: int(r["timestep"]))
    return {
        "session_id": session_id,
        "rows": [
            {
                "session_id": row.get("session_id"),
                "timestep": int(row["timestep"]),
                "board": row.get("board"),
                "moves_left": int(row["moves_left"]),
                "action": int(row["action"]),
                "next_board": row.get("next_board"),
                "next_moves_left": int(row["next_moves_left"]),
                "was_solved": row.get("was_solved") == "True",
                "timestamp": row.get("timestamp"),
            }
            for row in rows
        ],
    }


@app.get("/dataanalysis")
@app.get("/dataanalysis.html")
def dataanalysis():
    return FileResponse(BASE / "dataanalysis.html")


@app.get("/dataanalysis.js")
def dataanalysis_js():
    return FileResponse(BASE / "dataanalysis.js", media_type="application/javascript")


@app.get("/")
def index():
    return FileResponse(BASE/"index.html")

@app.get("/style.css")
def css():
    return FileResponse(BASE/"style.css", media_type="text/css")

@app.get("/script.js")
def js():
    return FileResponse(BASE/"script.js", media_type="application/javascript")
