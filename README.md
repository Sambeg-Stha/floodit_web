# FloodIt Web

A small Flood It game written in plain HTML, CSS and JavaScript. No build step,
no dependencies and no backend.

## Play

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://127.0.0.1:8000.

## Rules

The top-left cell is your starting region. Pick a color to flood every connected
cell of that color, then repeat. Flood the whole board within 25 moves.

## Controls

- Click a color swatch, or press `1`-`6`.
- `NEW GAME` starts a fresh board.

## Seeds

`?seed=N` pins the board sequence so a game can be reproduced exactly. Each
`NEW GAME` press advances the seed by one.
