'use strict';

const COLORS = ['#ff2d2d', '#ffcc00', '#00e676', '#2d7dff', '#b14dff', '#00d5ff'];

const sessionListEl = document.getElementById('session-list');
const dataListEl = document.getElementById('data-list');
const dataStatusEl = document.getElementById('data-status');

const modalEl = document.getElementById('step-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalBoardEl = document.getElementById('modal-board');
const modalNextBoardEl = document.getElementById('modal-next-board');
const modalActionEl = document.getElementById('modal-action');
const modalCloseBtn = document.getElementById('modal-close');
const modalPrevBtn = document.getElementById('modal-prev');
const modalNextBtn = document.getElementById('modal-next');

let selectedSession = null;
let currentRows = [];
let currentIndex = 0;
let lastTrigger = null;

async function fetchJSON(url){
    const res = await fetch(url);
    if(!res.ok)
        throw new Error(url + ' -> ' + res.status);
    return res.json();
}

async function loadSessions(){
    try{
        const data = await fetchJSON('/api/sessions');
        renderSessions(data.sessions);
    }catch(err){
        console.error('failed to load sessions', err);
        sessionListEl.innerHTML = '<p class="empty">Could not load sessions.</p>';
    }
}

function renderSessions(sessions){
    sessionListEl.innerHTML = '';

    if(!sessions.length){
        sessionListEl.innerHTML = '<p class="empty">No session CSV files found.</p>';
        return;
    }

    sessions.forEach(meta => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-item';
        btn.dataset.sessionId = meta.session_id;

        const label = document.createElement('span');
        label.className = 'list-item-label';
        label.textContent = meta.session_id;

        const info = document.createElement('span');
        info.className = 'list-item-meta';
        info.textContent = meta.steps + ' step' + (meta.steps === 1 ? '' : 's')
            + ' · ' + (meta.was_solved ? 'solved' : 'not solved');

        btn.append(label, info);
        btn.addEventListener('click', () => selectSession(meta.session_id));
        sessionListEl.appendChild(btn);
    });
}

async function selectSession(sessionId){
    if(!modalEl.hidden)
        closeModal();

    selectedSession = sessionId;
    currentRows = [];

    document.querySelectorAll('#session-list .list-item').forEach(el => {
        el.classList.toggle('active', el.dataset.sessionId === sessionId);
    });

    dataStatusEl.textContent = 'Loading ' + sessionId + '…';
    dataListEl.innerHTML = '';

    try{
        const data = await fetchJSON('/api/sessions/' + encodeURIComponent(sessionId));
        renderData(data.rows);
    }catch(err){
        console.error('failed to load session', err);
        dataStatusEl.textContent = 'Could not load this session.';
    }
}

function renderData(rows){
    currentRows = rows;
    dataListEl.innerHTML = '';

    if(!rows.length){
        dataStatusEl.textContent = 'This session has no rows.';
        return;
    }

    dataStatusEl.textContent = rows.length + ' step' + (rows.length === 1 ? '' : 's')
        + ' in ' + selectedSession + ' — click a timestep to view it';

    rows.forEach((row, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-item data-row';

        const label = document.createElement('span');
        label.className = 'list-item-label';
        label.textContent = 'Timestep ' + row.timestep;

        const info = document.createElement('span');
        info.className = 'list-item-meta';
        info.textContent = 'move ' + row.action + ' · '
            + row.moves_left + ' → ' + row.next_moves_left + ' moves';

        btn.append(label, info);
        btn.addEventListener('click', () => {
            lastTrigger = btn;
            showStep(index);
        });
        dataListEl.appendChild(btn);
    });
}

function renderBoard(el, code){
    el.innerHTML = '';
    if(!code)
        return;

    const size = Math.round(Math.sqrt(code.length));
    el.style.setProperty('--mini-size', size);

    for(const ch of code){
        const cell = document.createElement('div');
        cell.className = 'mini-cell';
        const color = COLORS[Number(ch)];
        if(color)
            cell.style.background = color;
        el.appendChild(cell);
    }
}

function showStep(index){
    if(index < 0 || index >= currentRows.length)
        return;

    currentIndex = index;
    const row = currentRows[index];

    modalTitleEl.textContent = 'Timestep ' + row.timestep;
    renderBoard(modalBoardEl, row.board);
    renderBoard(modalNextBoardEl, row.next_board);

    modalActionEl.innerHTML = '';
    const swatch = document.createElement('span');
    swatch.className = 'action-swatch';
    const actionColor = COLORS[row.action];
    if(actionColor)
        swatch.style.background = actionColor;
    const actionText = document.createElement('span');
    actionText.textContent = 'Action ' + row.action;
    modalActionEl.append(swatch, actionText);

    modalPrevBtn.disabled = index === 0;
    modalNextBtn.disabled = index === currentRows.length - 1;
    modalEl.hidden = false;
    modalNextBtn.focus();
}

function closeModal(){
    modalEl.hidden = true;
    if(lastTrigger)
        lastTrigger.focus();
}

modalCloseBtn.addEventListener('click', closeModal);
modalPrevBtn.addEventListener('click', () => showStep(currentIndex - 1));
modalNextBtn.addEventListener('click', () => showStep(currentIndex + 1));
modalEl.addEventListener('click', event => {
    if(event.target === modalEl)
        closeModal();
});
document.addEventListener('keydown', event => {
    if(modalEl.hidden)
        return;
    if(event.key === 'Escape')
        closeModal();
    else if(event.key === 'ArrowRight' && !modalNextBtn.disabled)
        showStep(currentIndex + 1);
    else if(event.key === 'ArrowLeft' && !modalPrevBtn.disabled)
        showStep(currentIndex - 1);
});

document.addEventListener('DOMContentLoaded', loadSessions);
