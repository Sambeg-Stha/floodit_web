# FloodIt Web

## Run the server
# Create the virtual environment and install dependencies
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# Start the server (no activation needed)
./venv/bin/python -m uvicorn server:app --reload

Then open http://127.0.0.1:8000 in your browser.
Data analysis is at http://127.0.0.1:8000/dataanalysis.html.

## Stored data
- CSV (`data/sessions/<session_id>.csv`): one file per session, one row per submitted game step, with columns: `session_id`, `timestep`, `board`, `moves_left`, `action`, `next_board`, `next_moves_left`, `was_solved`, `timestamp`.
- `was_solved` is session-level: it starts as `False` and is backfilled to `True` on every row of that session once the player solves the board.
- Written on every `POST /api/session/step` call, appended to that session's file.
- Ordering: rows in each session file are re-sorted by timestep once the game finishes or no player has been active for 10 minutes.

