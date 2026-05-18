// Códice de Encargos (tecla B).
// Estilo: pergaminho antigo com demandas. Quando um encargo passa a
// `completed`, anima um risco a atravessar o título + sumário.

import { getQuestsVisiveis, onQuestChange, getQuest } from '../systems/quests.js';

const STYLE_ID = 'quest-book-styles';
if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
    @keyframes qb-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
    }
    @keyframes qb-fade-out {
        from { opacity: 1; }
        to   { opacity: 0; }
    }
    @keyframes qb-book-in {
        0%   { transform: translate(-50%, -45%) rotate(-2.5deg) scale(0.85); opacity: 0; }
        60%  { transform: translate(-50%, -50%) rotate(0.4deg)  scale(1.02); opacity: 1; }
        100% { transform: translate(-50%, -50%) rotate(0deg)    scale(1);    opacity: 1; }
    }
    @keyframes qb-book-out {
        0%   { transform: translate(-50%, -50%) rotate(0deg)   scale(1);    opacity: 1; }
        100% { transform: translate(-50%, -52%) rotate(1.5deg) scale(0.94); opacity: 0; }
    }
    @keyframes qb-entry-in {
        0%   { transform: translateX(-12px); opacity: 0; }
        100% { transform: translateX(0);     opacity: 1; }
    }
    @keyframes qb-strike {
        0%   { transform: scaleX(0); }
        100% { transform: scaleX(1); }
    }
    @keyframes qb-new-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(220,180,90,0.0); }
        50%      { box-shadow: 0 0 0 6px rgba(220,180,90,0.35); }
    }
    @keyframes qb-stamp {
        0%   { transform: rotate(-18deg) scale(2.2); opacity: 0; }
        60%  { transform: rotate(-18deg) scale(0.92); opacity: 1; }
        100% { transform: rotate(-18deg) scale(1);    opacity: 1; }
    }
    #qb-overlay {
        position: fixed; inset: 0;
        background: radial-gradient(ellipse at center, rgba(8,5,2,0.5), rgba(0,0,0,0.78));
        z-index: 1200;
        display: none;
        font-family: 'Georgia', 'Times New Roman', serif;
        color: #2a1d10;
    }
    #qb-overlay.qb-open   { display: block; animation: qb-fade-in 220ms ease both; }
    #qb-overlay.qb-closing { display: block; animation: qb-fade-out 200ms ease both; }
    #qb-book {
        position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: min(720px, 92vw);
        height: min(560px, 86vh);
        background:
            repeating-linear-gradient(0deg, transparent 0 27px, rgba(120,80,30,0.10) 27px 28px),
            linear-gradient(155deg, #f4e3bf 0%, #e6cf95 55%, #d6b96d 100%);
        border-radius: 6px;
        box-shadow:
            0 20px 60px rgba(0,0,0,0.65),
            inset 0 0 80px rgba(120,70,20,0.35),
            inset 0 0 0 2px rgba(80,45,15,0.4);
        padding: 28px 38px 24px;
        display: flex; flex-direction: column;
        overflow: hidden;
    }
    #qb-overlay.qb-open #qb-book   { animation: qb-book-in 360ms cubic-bezier(.2,.9,.3,1.1) both; }
    #qb-overlay.qb-closing #qb-book { animation: qb-book-out 200ms ease both; }
    #qb-book::before, #qb-book::after {
        content: ''; position: absolute; pointer-events: none;
    }
    #qb-book::before {
        inset: 0;
        background:
            radial-gradient(circle at 8% 12%, rgba(80,40,10,0.18), transparent 22%),
            radial-gradient(circle at 92% 88%, rgba(80,40,10,0.20), transparent 28%),
            radial-gradient(circle at 55% 50%, transparent 60%, rgba(60,30,5,0.18) 100%);
    }
    #qb-header {
        position: relative;
        display: flex; align-items: baseline; justify-content: space-between;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(80,45,15,0.35);
        margin-bottom: 12px;
    }
    #qb-title {
        font-size: 26px; font-weight: bold; letter-spacing: 3px;
        text-transform: uppercase;
        color: #3a2410;
        text-shadow: 0 1px 0 rgba(255,235,200,0.4);
        font-variant: small-caps;
    }
    .qb-progress {
        display: inline-block;
        margin-left: 10px;
        padding: 1px 8px;
        font-size: 12px; font-weight: bold; letter-spacing: 1.5px;
        color: #f4e3bf;
        background: #5a3a18;
        border-radius: 3px;
        vertical-align: middle;
        box-shadow: inset 0 0 0 1px rgba(255,235,200,0.25);
    }
    .qb-progress.qb-progress-full {
        background: #2f5f1a;
        animation: qb-new-pulse 1.4s ease 1;
    }
    .qb-progress-bar {
        margin-top: 6px;
        height: 4px;
        background: rgba(80,45,15,0.25);
        border-radius: 2px;
        overflow: hidden;
        position: relative;
    }
    .qb-progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #8a4a1c, #c07a2a);
        transition: width 420ms cubic-bezier(.2,.9,.3,1);
    }
    .qb-entry.qb-done .qb-progress-bar-fill {
        background: linear-gradient(90deg, #4a6a1c, #6a8a2a);
    }
    #qb-hint {
        font-size: 11px; letter-spacing: 1px; opacity: 0.65;
    }
    #qb-list {
        flex: 1; overflow-y: auto;
        padding: 4px 6px 8px;
        scrollbar-width: thin;
    }
    #qb-list::-webkit-scrollbar { width: 6px; }
    #qb-list::-webkit-scrollbar-thumb { background: rgba(80,45,15,0.4); border-radius: 4px; }
    .qb-entry {
        position: relative;
        margin: 0 0 16px;
        padding: 8px 12px 10px 30px;
        animation: qb-entry-in 320ms cubic-bezier(.2,.9,.3,1) both;
    }
    .qb-entry.qb-new {
        animation: qb-entry-in 320ms cubic-bezier(.2,.9,.3,1) both, qb-new-pulse 1.6s ease 320ms 2;
        border-radius: 4px;
    }
    .qb-bullet {
        position: absolute; left: 6px; top: 11px;
        width: 14px; height: 14px;
        border: 1.5px solid #5a3a18;
        border-radius: 3px;
        background: rgba(255,245,210,0.4);
        box-shadow: inset 0 0 0 2px rgba(255,245,210,0.4);
    }
    .qb-entry.qb-done .qb-bullet {
        background: #5a3a18;
        box-shadow: inset 0 0 0 2px rgba(255,245,210,0.4);
    }
    .qb-entry.qb-done .qb-bullet::after {
        content: '✓'; position: absolute; inset: 0;
        color: #f4e3bf; font-size: 12px; font-weight: bold;
        display: flex; align-items: center; justify-content: center;
        line-height: 1;
    }
    .qb-entry-title {
        font-size: 17px; font-weight: bold; letter-spacing: 1px;
        color: #2a1808; margin-bottom: 4px;
        position: relative;
        display: inline-block;
    }
    .qb-entry-summary {
        font-size: 13px; line-height: 1.55;
        color: #3d2a14;
        position: relative;
    }
    .qb-strike {
        position: absolute; left: -4px; right: -4px; top: 50%;
        height: 2px; background: #6a2a10;
        transform-origin: left center;
        transform: scaleX(0);
        box-shadow: 0 1px 0 rgba(255,235,200,0.4);
        pointer-events: none;
    }
    .qb-entry.qb-done .qb-strike { animation: qb-strike 420ms cubic-bezier(.55,.1,.2,1) forwards; }
    .qb-entry.qb-done.qb-prefilled .qb-strike { animation: none; transform: scaleX(1); }
    .qb-entry.qb-done .qb-entry-title { color: #6a4828; }
    .qb-entry.qb-done .qb-entry-summary { color: #6a553a; }
    .qb-stamp {
        position: absolute; right: 6px; top: 50%;
        transform: translateY(-50%) rotate(-18deg);
        font-size: 11px; letter-spacing: 3px; font-weight: bold;
        color: rgba(140,30,15,0.7);
        border: 2px solid rgba(140,30,15,0.7);
        padding: 2px 8px; border-radius: 3px;
        text-transform: uppercase;
        opacity: 0;
        pointer-events: none;
    }
    .qb-entry.qb-done .qb-stamp { animation: qb-stamp 480ms cubic-bezier(.2,.9,.3,1.1) 260ms forwards; }
    .qb-entry.qb-done.qb-prefilled .qb-stamp { animation: none; opacity: 1; transform: translateY(-50%) rotate(-18deg) scale(1); }
    #qb-empty {
        margin: auto; text-align: center;
        font-style: italic; opacity: 0.55;
        font-size: 14px;
    }
    `;
    document.head.appendChild(style);
}

const overlay = document.createElement('div');
overlay.id = 'qb-overlay';
overlay.innerHTML = `
    <div id="qb-book">
        <div id="qb-header">
            <div id="qb-title">Códice de Encargos</div>
            <div id="qb-hint">B — Fechar</div>
        </div>
        <div id="qb-list"></div>
    </div>
`;
document.body.appendChild(overlay);

const listEl = overlay.querySelector('#qb-list');
let aberto = false;
let _knownCompleted = new Set();

function render({ animateNew = null } = {}) {
    const quests = getQuestsVisiveis();
    listEl.innerHTML = '';
    if (quests.length === 0) {
        const empty = document.createElement('div');
        empty.id = 'qb-empty';
        empty.textContent = 'Páginas em branco. Explorai o mundo em busca de novos encargos.';
        listEl.appendChild(empty);
        return;
    }
    for (const q of quests) {
        const entry = document.createElement('div');
        entry.className = 'qb-entry';
        if (q.completed) {
            entry.classList.add('qb-done');
            // se já estava completa antes de abrir, não anima o risco
            if (_knownCompleted.has(q.id)) entry.classList.add('qb-prefilled');
        }
        if (animateNew === q.id) entry.classList.add('qb-new');
        entry.dataset.qid = q.id;
        const prog = q.progresso;
        const progBadge = prog
            ? `<span class="qb-progress${prog.coletados >= prog.meta ? ' qb-progress-full' : ''}">${prog.coletados}/${prog.meta}</span>`
            : '';
        const progBar = prog
            ? `<div class="qb-progress-bar"><div class="qb-progress-bar-fill" style="width:${Math.min(100, (prog.coletados / prog.meta) * 100)}%"></div></div>`
            : '';
        entry.innerHTML = `
            <div class="qb-bullet"></div>
            <div class="qb-entry-title">${escapeHtml(q.title)}${progBadge}<span class="qb-strike"></span></div>
            <div class="qb-entry-summary">${escapeHtml(q.summary)}<span class="qb-strike"></span></div>
            ${progBar}
            <div class="qb-stamp">Cumprido</div>
        `;
        listEl.appendChild(entry);
        if (q.completed) _knownCompleted.add(q.id);
    }
}

function updateProgresso(id) {
    const entry = listEl.querySelector(`.qb-entry[data-qid="${id}"]`);
    if (!entry) return;
    const q = getQuestsVisiveis().find(x => x.id === id);
    if (!q || !q.progresso) return;
    const badge = entry.querySelector('.qb-progress');
    const fill = entry.querySelector('.qb-progress-bar-fill');
    if (badge) {
        badge.textContent = `${q.progresso.coletados}/${q.progresso.meta}`;
        badge.classList.toggle('qb-progress-full', q.progresso.coletados >= q.progresso.meta);
    }
    if (fill) fill.style.width = `${Math.min(100, (q.progresso.coletados / q.progresso.meta) * 100)}%`;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
}

export function abrirQuestBook() {
    if (aberto) return;
    aberto = true;
    render();
    overlay.classList.remove('qb-closing');
    overlay.classList.add('qb-open');
}

export function fecharQuestBook() {
    if (!aberto) return;
    aberto = false;
    overlay.classList.remove('qb-open');
    overlay.classList.add('qb-closing');
    setTimeout(() => {
        if (!aberto) overlay.classList.remove('qb-closing');
    }, 220);
}

export function toggleQuestBook() {
    if (aberto) fecharQuestBook(); else abrirQuestBook();
}

export function isQuestBookAberto() { return aberto; }

// quando uma quest muda enquanto o livro está aberto, refrescar
onQuestChange((evt) => {
    if (evt.type === 'discovered') {
        mostrarToast('nova', evt.id);
        if (aberto) render({ animateNew: evt.id });
    } else if (evt.type === 'completed') {
        mostrarToast('completa', evt.id);
        if (aberto) {
            _knownCompleted.delete(evt.id);
            render();
        }
    } else if (evt.type === 'progress') {
        if (aberto) updateProgresso(evt.id);
    }
});

// ----------------------------------------------------------------
// Toast no canto superior direito ao adicionar / concluir tarefa
// ----------------------------------------------------------------
const TOAST_STYLE_ID = 'qb-toast-styles';
if (!document.getElementById(TOAST_STYLE_ID)) {
    const s = document.createElement('style');
    s.id = TOAST_STYLE_ID;
    s.textContent = `
    @keyframes qbt-in {
        0%   { transform: translateX(120%) rotate(2deg); opacity: 0; }
        70%  { transform: translateX(-6px) rotate(-0.5deg); opacity: 1; }
        100% { transform: translateX(0)    rotate(0deg);    opacity: 1; }
    }
    @keyframes qbt-out {
        0%   { transform: translateX(0)    rotate(0deg);    opacity: 1; }
        100% { transform: translateX(110%) rotate(1.5deg);  opacity: 0; }
    }
    @keyframes qbt-seal-pulse {
        0%, 100% { transform: scale(1);   box-shadow: 0 0 0 0 rgba(220,180,90,0.5); }
        50%      { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(220,180,90,0); }
    }
    @keyframes qbt-shine {
        0%   { transform: translateX(-120%) skewX(-20deg); }
        100% { transform: translateX(220%)  skewX(-20deg); }
    }
    #qbt-stack {
        position: fixed; top: 18px; right: 18px;
        z-index: 1300;
        display: flex; flex-direction: column; gap: 10px;
        pointer-events: none;
        font-family: 'Georgia', 'Times New Roman', serif;
    }
    .qbt {
        position: relative;
        width: 320px;
        padding: 12px 14px 12px 56px;
        color: #2a1808;
        background:
            repeating-linear-gradient(0deg, transparent 0 22px, rgba(120,80,30,0.08) 22px 23px),
            linear-gradient(155deg, #f4e3bf 0%, #e6cf95 60%, #d6b96d 100%);
        border-radius: 5px;
        box-shadow:
            0 12px 28px rgba(0,0,0,0.5),
            inset 0 0 30px rgba(120,70,20,0.25),
            inset 0 0 0 1.5px rgba(80,45,15,0.55);
        overflow: hidden;
        animation: qbt-in 420ms cubic-bezier(.2,.9,.3,1.1) both;
    }
    .qbt.qbt-out { animation: qbt-out 280ms ease both; }
    .qbt::before {
        content: '';
        position: absolute; inset: 0;
        background:
            radial-gradient(circle at 12% 18%, rgba(80,40,10,0.18), transparent 32%),
            radial-gradient(circle at 88% 82%, rgba(80,40,10,0.18), transparent 32%);
        pointer-events: none;
    }
    .qbt::after {
        content: '';
        position: absolute; top: 0; bottom: 0; left: 0;
        width: 60px;
        background: linear-gradient(110deg, transparent 30%, rgba(255,240,200,0.55) 50%, transparent 70%);
        transform: translateX(-120%) skewX(-20deg);
        animation: qbt-shine 1.3s ease 250ms 1 forwards;
        pointer-events: none;
    }
    .qbt-seal {
        position: absolute; left: 12px; top: 50%;
        width: 32px; height: 32px;
        margin-top: -16px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #c08c3a, #6a3a10 75%);
        box-shadow: 0 0 0 2px rgba(255,235,200,0.4), inset 0 0 6px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; color: #f4e3bf;
        font-weight: bold;
        text-shadow: 0 1px 1px rgba(0,0,0,0.6);
        animation: qbt-seal-pulse 1.6s ease infinite;
    }
    .qbt.qbt-completa .qbt-seal {
        background: radial-gradient(circle at 35% 30%, #6f8a2a, #2c4010 75%);
    }
    .qbt-kicker {
        font-size: 9px; font-weight: bold;
        text-transform: uppercase; letter-spacing: 2.5px;
        color: #6a3a10;
        margin-bottom: 2px;
        font-variant: small-caps;
    }
    .qbt.qbt-completa .qbt-kicker { color: #355a18; }
    .qbt-title {
        font-size: 14px; font-weight: bold; letter-spacing: 1px;
        color: #2a1808;
        font-variant: small-caps;
        line-height: 1.25;
    }
    .qbt-sub {
        margin-top: 2px;
        font-size: 11px; font-style: italic; opacity: 0.7;
    }
    `;
    document.head.appendChild(s);
}

const stackEl = document.createElement('div');
stackEl.id = 'qbt-stack';
document.body.appendChild(stackEl);

function mostrarToast(tipo, qid) {
    const q = getQuest(qid);
    if (!q) return;
    const toast = document.createElement('div');
    toast.className = 'qbt ' + (tipo === 'completa' ? 'qbt-completa' : 'qbt-nova');
    const seal = tipo === 'completa' ? '✓' : '✦';
    const kicker = tipo === 'completa' ? 'Demanda Cumprida' : 'Novo Encargo';
    toast.innerHTML = `
        <div class="qbt-seal">${seal}</div>
        <div class="qbt-kicker">Códice de Encargos</div>
        <div class="qbt-title">${kicker} — ${escapeHtml(q.title)}</div>
        <div class="qbt-sub">Premi B para consultar o vosso Códice.</div>
    `;
    stackEl.appendChild(toast);
    const dur = 4200;
    setTimeout(() => {
        toast.classList.add('qbt-out');
        setTimeout(() => toast.remove(), 300);
    }, dur);
}
