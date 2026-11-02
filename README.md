# FloodIt Web

## Run the server
# Create and activate a virtual environment and download dependencies

# Start the server
uvicorn server:app --reload

Then open http://127.0.0.1:8000 in your browser.

## Stored data
- CSV (`data/YYYY-MM-DD.csv`): one row per submitted game step — session id, step number, timings, moves left, action, board state before/after, cells flooded and done flag.
- Stored on every `POST /api/session/step` call, appended to the current UTC-day file.
- Daily ordering: each UTC day gets its own file, and rows are re-sorted by session id then step number once the day rolls over or no player has been active for 10 minutes.
- JSON (`data/sessions/<session_id>.json`): the session header written once at start — size, color count, max moves, board, seed, start time and version.

