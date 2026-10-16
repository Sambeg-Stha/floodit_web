'use strict';



const SIZE = 8;
const NUM_COLORS = 6;
const MAX_MOVE = 25;

const COLOR =  ['#e64553', '#df8e1d', '#40a02b', '#1e66f5', '#8839ef', '#179299'];

const DIRS = [[1,0], [-1,0], [0,1], [0,-1]];

let board;
let flooded;
let moves;
let gameOver;
let cellEls = [];

const boardEl = document.getElementById('board');
const movesEl = document.getElementById('moves');
const palletEl = document.getElementById('pallet');
const newGameBtn = document.getElementById('new-game');
const overlayEl = document.getElementById('overlay');
const overlayMessageEl = document.getElementById('overlay-message');
const playAgainBtn = document.getElementById('play-again');

function init(){
    board = Array.from({length : SIZE}, () =>
        Array.from({length: SIZE}, () =>
            Math.floor(Math.random() * NUM_COLORS)
        )
    );
    flooded = Array.from({length : SIZE}, () => Array(SIZE).fill(false));
    flooded[0][0] = true;
    moves = MAX_MOVE;
    gameOver = false;
}

function buildCell(){
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

function flood(newcolor){
    const oldColor = board[0][0];
    if(newcolor == oldColor) return false;
    for(let r = 0; r < SIZE; r++){
        for(let c = 0; c< SIZE; c++){
            if(flooded[r][c])
                board[r][c] = newcolor;
        }
    }

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
            if(board[nr][nc] === newcolor){
                flooded[nr][nc] = true;
                stack.push([nr,nc]);
            }
        }
    }
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
    if(!flood(colorIndex))
        return;

    moves -= 1;
    movesEl.textContent = moves;
    paint();
    
    if(allFlooded()){
        endGame(true);
    }else if(moves === 0){
        endGame(false);
    }
}

function newGame(){
    overlayEl.hidden = true;
    init();
    buildCell();
    paint();
    updatePallet();
    movesEl.textContent = moves;
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
})

