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

const boardEl = document.getElementById('board')
const movesEl = document.getElementById('moves')

function init(){
    board = Array.from({length : SIZE}, () =>
        Array.from({length: SIZE}, () =>
            Math.floor(Math.random() * NUM_COLORS)
        )
    );
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
    if(!flooded(colorIndex))
        return;

    moves -= 1;
    movesEl.textContent = moves;
    paint();
    
    if(allFlooded()){
        gameOver = true;
        console.log('WIN');
    }else if(moves === 0){
        gameOver = true;
        console.log('LOOSE');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    buildCell();
    paint();
    movesEl.textContent = moves;
})

