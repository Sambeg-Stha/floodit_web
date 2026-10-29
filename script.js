'use strict';

const CONFIG = {
    size : 6,
    color : ['#ff2d2d', '#ffcc00', '#00e676', '#2d7dff', '#b14dff', '#00d5ff'],
    maxMove : 25,
}

const SIZE = CONFIG.size;
const NUM_COLORS = CONFIG.color.length;
const MAX_MOVE = CONFIG.maxMove;
const COLOR = CONFIG.color;

const DIRS = [[1,0], [-1,0], [0,1], [0,-1]];

let board;
let flooded;
let moves;
let gameOver;
let cellEls = [];

let sessionID = null;
let sessionStart = 0;
let stepCount = 0;

const boardEl = document.getElementById('board');
const movesEl = document.getElementById('moves');
const palletEl = document.getElementById('pallet');
const newGameBtn = document.getElementById('new-game');
const overlayEl = document.getElementById('overlay');
const overlayMessageEl = document.getElementById('overlay-message');
const playAgainBtn = document.getElementById('play-again');


function encodeBoard(b){
    return b.map(row => row.join('')).join('');
}

function encodeFlooded(mask){
    return mask.map(row => row.map(v => (v ? 1 : 0)).join('')).join('');
}

function countFlooded(mask){
    let total = 0;
    for(let r = 0; r < SIZE; r++){
        for(let c = 0; c < SIZE; c++){
            if(mask[r][c]) total += 1;
        }
    }
    return total;
}

function tMs(){
    return Math.round(performance.now() - sessionStart);
}

function startSession(){
    sessionID = crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2);
    sessionStart = performance.now();
    stepCount = 0;

    fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: sessionID,
            size: SIZE,
            num_colors: NUM_COLORS,
            max_moves: MAX_MOVE,
            board: encodeBoard(board),
        }),
    }).catch(err => console.error('session start failed', err));
}

function logStep(before, action, done){
    const payload = {
        session_id: sessionID,
        step: stepCount,
        t_ms: tMs(),
        moves_left: before.moves,
        action: action,
        state: before.state,
        flooded: before.flooded,
        next_state: encodeBoard(board),
        next_flooded: encodeFlooded(flooded),
        cells_flooded: countFlooded(flooded) - before.floodedCount,
        next_moves_left: moves,
        done: done,
    };
    stepCount += 1;

    fetch('/api/session/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify(payload),
    }).catch(err => console.error('log step failed', err));
}

function init(){
    board = Array.from({length : SIZE}, () =>
        Array.from({length: SIZE}, () =>
            Math.floor(Math.random() * NUM_COLORS)
        )
    );
    flooded = Array.from({length : SIZE}, () => Array(SIZE).fill(false));
    flooded[0][0] = true;
    expandFlood(board[0][0]);
    moves = MAX_MOVE;
    gameOver = false;
}

function buildCell(){
    boardEl.style.setProperty('--size', SIZE);
    boardEl.innerHTML = '';
    cellEls = [];
    for(let r = 0; r < SIZE; r++){
        const row = [];
        for(let c = 0; c < SIZE; c++){
            const el = document.createElement('div');
            el.className = 'cell';
            boardEl.appendChild(el);
            row.push(el);
        }
        cellEls.push(row);
    }
}

function buildPallet(){
    palletEl.innerHTML = '';
    COLOR.forEach((color, i) =>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch';
        btn.style.background = color;
        btn.setAttribute ('aria-label', 'Color ' + (i + 1));
        btn.addEventListener('click', () =>
            makeMove(i)
        );
        palletEl.appendChild(btn);
    })
}

function updatePallet(){
    const current = board[0][0]
    Array.from(palletEl.children).forEach((btn,i) => {
        btn.classList.toggle('active', i === current);
        btn.setAttribute('aria-pressed', String(i === current));
    });
}

function paint(){
    for(let r = 0; r < SIZE; r++){
        for(let c = 0; c < SIZE; c++){
            cellEls[r][c].style.background = COLOR[board[r][c]];
        }
    }
}

function expandFlood(color){
    const stack = [];
    for(let r = 0; r < SIZE; r++){
        for(let c = 0; c < SIZE; c++){
            if(flooded[r][c])
                stack.push([r,c]);
        }
    }

    while(stack.length > 0){
        const [r,c] = stack.pop();
        for(const [dr,dc] of DIRS){
            const nr = r + dr;
            const nc = c + dc;
            if(nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE)
                continue;
            if(flooded[nr][nc])
                continue;
            if(board[nr][nc] === color){
                flooded[nr][nc] = true;
                stack.push([nr,nc]);
            }
        }
    }
}

function flood(newcolor){
    const oldColor = board[0][0];
    if(newcolor == oldColor) return false;
    for(let r = 0; r < SIZE; r++){
        for(let c = 0; c< SIZE; c++){
            if(flooded[r][c])
                board[r][c] = newcolor;
        }
    }

    expandFlood(newcolor);
    return true;
}

function allFlooded(){
    for(let r = 0; r <SIZE; r++){
        for(let c = 0; c < SIZE; c++){
            if(!flooded[r][c]) 
                return false;
        }
    }

    return true;
}

function makeMove(colorIndex){
    if(gameOver)
        return;

    const before = {
        state: encodeBoard(board),
        flooded: encodeFlooded(flooded),
        floodedCount: countFlooded(flooded),
        moves: moves,
    };

    if(!flood(colorIndex))
        return;

    moves -= 1;
    movesEl.textContent = moves;
    paint();
    updatePallet();

    const won = allFlooded();
    const done = won || moves === 0;
    logStep(before, colorIndex, done);

    if(won){
        endGame(true);
    }else if(moves === 0){
        endGame(false);
    }
}

function newGame(){
    overlayEl.hidden = true;
    init();
    paint();
    updatePallet();
    movesEl.textContent = moves;
    startSession();
    newGameBtn.focus();
}

function endGame(won){
    gameOver = true;
    overlayMessageEl.textContent = won
        ? 'You Flooded the Board in ' + (MAX_MOVE - moves) + ' moves!'
        : 'Out of Moves'
    overlayEl.hidden = false;
    playAgainBtn.focus();
}

playAgainBtn.addEventListener('click', newGame);
newGameBtn.addEventListener('click', newGame);

document.addEventListener('keydown', (event) =>{
    const n = Number(event.key);
    if(Number.isInteger(n) && n >= 1 && n <= NUM_COLORS){
        makeMove(n-1);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    init();
    buildCell();
    buildPallet();
    paint();
    updatePallet();
    movesEl.textContent = moves;
    startSession();
})

