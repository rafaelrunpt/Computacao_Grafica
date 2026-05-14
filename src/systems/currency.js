// Cintilas — currency obtida em baús e quests.
const state = { cintilas: 0 };
const listeners = new Set();

export function getCintilas() { return state.cintilas; }

export function ganharCintilas(qtd) {
    if (qtd <= 0) return state.cintilas;
    state.cintilas += qtd;
    listeners.forEach(fn => { try { fn(state.cintilas, qtd); } catch {} });
    mostrarToastCintilas(qtd);
    return state.cintilas;
}

export function gastarCintilas(qtd) {
    if (state.cintilas < qtd) return false;
    state.cintilas -= qtd;
    listeners.forEach(fn => { try { fn(state.cintilas, -qtd); } catch {} });
    return true;
}

export function temCintilas(qtd) { return state.cintilas >= qtd; }
export function onCintilasChange(fn) { listeners.add(fn); }

// ----------------------------------------------------------------------
// Toast pequeno "+N ✦ Cintilas" no canto superior direito
// ----------------------------------------------------------------------
let _toastStack = null;
function ensureStack() {
    if (_toastStack) return _toastStack;
    _toastStack = document.createElement('div');
    _toastStack.id = 'cintilas-toast-stack';
    _toastStack.style.cssText = `
        position: fixed; top: 84px; right: 22px;
        display: flex; flex-direction: column; gap: 6px;
        z-index: 220; pointer-events: none;
    `;
    document.body.appendChild(_toastStack);
    return _toastStack;
}

function mostrarToastCintilas(qtd) {
    const stack = ensureStack();
    const t = document.createElement('div');
    t.style.cssText = `
        background: linear-gradient(180deg, rgba(20,40,80,0.92), rgba(8,20,48,0.95));
        border: 1px solid #6aa0ff;
        border-radius: 8px;
        padding: 7px 14px;
        color: #cde2ff;
        font-family: 'Courier New', monospace;
        font-size: 14px; font-weight: bold; letter-spacing: 1px;
        box-shadow: 0 0 12px rgba(80,140,255,0.45), inset 0 0 10px rgba(40,80,180,0.4);
        text-shadow: 0 0 6px #6aa0ff, 1px 1px 0 #000;
        opacity: 0; transform: translateX(20px);
        transition: opacity 0.25s ease-out, transform 0.3s cubic-bezier(.2,.7,.3,1);
    `;
    t.innerHTML = `<span style="color:#a0c8ff">✦</span> +${qtd} Cintilas`;
    stack.appendChild(t);
    requestAnimationFrame(() => {
        t.style.opacity = '1';
        t.style.transform = 'translateX(0)';
    });
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(20px)';
    }, 1800);
    setTimeout(() => t.remove(), 2200);
}
