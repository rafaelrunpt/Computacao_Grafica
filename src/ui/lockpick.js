// Mini-jogo de lockpick para abrir baús no mundo.
// Mecânica: alinhar 3 pinos. Em cada pino, um cursor oscila ao longo da
// barra; o jogador carrega em ESPAÇO quando o cursor está sobre a "sweet
// spot" dourada. Cada falha consome 1 das 3 tentativas; 3 acertos abrem
// a fechadura.

let isAberto = false;
let cbs = { onSuccess: null, onFail: null };
let state = null;
let raf = null;
let _last = 0;

// ---- DOM ----
const overlay = document.createElement('div');
overlay.id = 'lockpick-overlay';
overlay.style.cssText = `
    position: fixed; inset: 0;
    display: none;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,0.62);
    z-index: 300;
    font-family: 'Courier New', monospace;
    backdrop-filter: blur(2px);
`;
document.body.appendChild(overlay);

const panel = document.createElement('div');
panel.style.cssText = `
    background: linear-gradient(180deg, #2a1a08, #140a04);
    border: 2px solid #d4a830;
    border-radius: 14px;
    padding: 26px 34px 22px;
    width: 480px;
    color: #f0d080;
    text-align: center;
    box-shadow: 0 0 32px rgba(212,168,48,0.45), inset 0 0 20px rgba(80,40,0,0.5);
`;
panel.innerHTML = `
    <div style="font-size:20px;font-weight:bold;letter-spacing:6px;margin-bottom:4px;text-shadow:0 0 8px #d4a830,1px 1px 0 #000;">
        🔒 FECHADURA
    </div>
    <div id="lp-status" style="font-size:11px;letter-spacing:3px;opacity:0.65;margin-bottom:18px;">PINO 1 / 3</div>

    <div id="lp-pins" style="display:flex;justify-content:center;gap:18px;margin-bottom:18px;"></div>

    <div id="lp-bar" style="position:relative;height:38px;background:rgba(0,0,0,0.65);border:1px solid #6a4818;border-radius:6px;overflow:hidden;box-shadow:inset 0 2px 6px rgba(0,0,0,0.6);transition:box-shadow 0.18s;">
        <div id="lp-sweet" style="position:absolute;top:0;bottom:0;background:linear-gradient(90deg,rgba(255,200,80,0.0),rgba(255,210,90,0.85) 35%,rgba(255,210,90,0.85) 65%,rgba(255,200,80,0.0));box-shadow:inset 0 0 10px rgba(255,200,80,0.5);"></div>
        <div id="lp-cursor" style="position:absolute;top:-2px;bottom:-2px;width:3px;background:#fff;box-shadow:0 0 8px #fff,0 0 14px #ffcc66;border-radius:2px;"></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
        <div style="font-size:11px;letter-spacing:2px;opacity:0.7;">TENTATIVAS</div>
        <div id="lp-attempts" style="display:flex;gap:8px;"></div>
    </div>

    <div style="margin-top:18px;font-size:11px;letter-spacing:2px;opacity:0.55;">
        ESPAÇO  TENTAR  ·  ESC  SAIR
    </div>
`;
overlay.appendChild(panel);

const elPins   = panel.querySelector('#lp-pins');
const elBar    = panel.querySelector('#lp-bar');
const elSweet  = panel.querySelector('#lp-sweet');
const elCursor = panel.querySelector('#lp-cursor');
const elAtt    = panel.querySelector('#lp-attempts');
const elStatus = panel.querySelector('#lp-status');

function pinDot(filled) {
    const d = document.createElement('div');
    d.style.cssText = `
        width:14px;height:14px;border-radius:50%;
        border:2px solid ${filled ? '#ffd060' : '#7a5818'};
        background:${filled ? 'radial-gradient(circle,#ffe080,#a07020)' : 'rgba(0,0,0,0.45)'};
        box-shadow:${filled ? '0 0 12px #ffd060' : 'inset 0 1px 2px rgba(0,0,0,0.55)'};
        transition: all 0.2s;
    `;
    return d;
}

function attDot(active) {
    const d = document.createElement('div');
    d.style.cssText = `
        width:10px;height:10px;border-radius:50%;
        background:${active ? 'radial-gradient(circle,#ff7090,#601020)' : 'rgba(0,0,0,0.4)'};
        border:1px solid ${active ? '#ff8090' : '#603030'};
        box-shadow:${active ? '0 0 6px #ff4060' : 'none'};
        transition: all 0.2s;
    `;
    return d;
}

function renderHUD() {
    elPins.innerHTML = '';
    for (let i = 0; i < 3; i++) elPins.appendChild(pinDot(i < state.pin));
    elAtt.innerHTML = '';
    for (let i = 0; i < 3; i++) elAtt.appendChild(attDot(i < state.attempts));
    elStatus.textContent = `PINO ${Math.min(state.pin + 1, 3)} / 3`;
}

function novoPin() {
    // velocidade em unidades-de-barra por segundo; aumenta por pino
    state.cursorSpeed = 0.62 + state.pin * 0.24;
    state.sweetW      = 0.22 - state.pin * 0.05;       // 0.22 → 0.12
    state.sweetX      = 0.15 + Math.random() * 0.70;
    state.cursorX     = 0;
    state.cursorDir   = 1;

    elSweet.style.left  = `${(state.sweetX - state.sweetW / 2) * 100}%`;
    elSweet.style.width = `${state.sweetW * 100}%`;
}

function tick(now) {
    if (!isAberto) return;
    if (!_last) _last = now;
    const dt = Math.min(0.05, (now - _last) / 1000);
    _last = now;

    state.cursorX += state.cursorDir * state.cursorSpeed * dt;
    if (state.cursorX >= 1) { state.cursorX = 1; state.cursorDir = -1; }
    if (state.cursorX <= 0) { state.cursorX = 0; state.cursorDir =  1; }

    elCursor.style.left = `${state.cursorX * 100}%`;
    raf = requestAnimationFrame(tick);
}

function flashBar(cor, dur = 260) {
    elBar.style.boxShadow = `0 0 18px ${cor}, inset 0 0 14px ${cor}`;
    setTimeout(() => { elBar.style.boxShadow = ''; }, dur);
}

function attempt() {
    if (!isAberto || !state) return;
    const d = Math.abs(state.cursorX - state.sweetX);
    if (d <= state.sweetW / 2) {
        state.pin++;
        flashBar('#80ff80');
        if (state.pin >= 3) {
            renderHUD();
            setTimeout(() => fechar(true), 360);
            return;
        }
        novoPin();
        renderHUD();
    } else {
        state.attempts--;
        flashBar('#ff5070');
        renderHUD();
        if (state.attempts <= 0) {
            setTimeout(() => fechar(false), 380);
            return;
        }
        // sacode o cursor — retoma do início desta extremidade
        state.cursorX = state.cursorDir > 0 ? 0 : 1;
    }
}

function fechar(success) {
    if (!isAberto) return;
    isAberto = false;
    overlay.style.display = 'none';
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    _last = 0;
    if (success && cbs.onSuccess) cbs.onSuccess();
    else if (!success && cbs.onFail) cbs.onFail();
    cbs.onSuccess = null;
    cbs.onFail = null;
}

export function abrirLockpick(opts = {}) {
    if (isAberto) return;
    isAberto = true;
    cbs.onSuccess = opts.onSuccess || null;
    cbs.onFail    = opts.onFail || null;
    state = {
        pin: 0, attempts: 3,
        cursorX: 0, cursorDir: 1, cursorSpeed: 0,
        sweetX: 0.5, sweetW: 0.22,
    };
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        novoPin();
        renderHUD();
        _last = 0;
        raf = requestAnimationFrame(tick);
    });
}

export function isLockpickAberto() { return isAberto; }

window.addEventListener('keydown', (e) => {
    if (!isAberto) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        attempt();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        fechar(false);
    }
}, true); // capture: corre antes dos outros listeners
