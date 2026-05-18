// --------------------------------------------------------
// ECRÃ INICIAL — ANIDIA: O Desvanecer da Magia
// --------------------------------------------------------
// Mostra o título cinematográfico com vista orbital sobre o
// panorama do mundo. Finaliza com qualquer tecla / clique.
// --------------------------------------------------------
import * as THREE from 'three';
import { switchMusic, resumeAudio, getCurrentTrack } from '../systems/audio.js';
import { settings, setSetting } from '../systems/settings.js';

let _ativa = true;
let _onIniciar = null;

// --------------------------------------------------------
// CÂMARA — órbita lenta com leve dolly + bobbing
// --------------------------------------------------------
export const titleCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
let _t = 0;
const _focal = new THREE.Vector3(0, 5, -8);

export function updateTitleCamera(dt) {
    if (!_ativa) return;
    _t += dt;
    const ang = _t * 0.075;                       // velocidade de rotação
    const r   = 78 + Math.sin(_t * 0.18) * 7;     // dolly suave
    const h   = 30 + Math.cos(_t * 0.22) * 2.5;   // pequeno bobbing
    titleCamera.position.set(
        _focal.x + Math.cos(ang) * r,
        _focal.y + h,
        _focal.z + Math.sin(ang) * r
    );
    titleCamera.lookAt(_focal);
}

window.addEventListener('resize', () => {
    titleCamera.aspect = window.innerWidth / window.innerHeight;
    titleCamera.updateProjectionMatrix();
});

// --------------------------------------------------------
// OVERLAY DOM
// --------------------------------------------------------
const overlay = document.createElement('div');
overlay.id = 'title-screen';
overlay.style.cssText = `
    position: fixed; inset: 0;
    z-index: 250;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Georgia', serif;
    color: #f0d080;
    transition: opacity 0.85s ease, transform 0.85s ease;
    cursor: pointer;
    user-select: none;
`;
document.body.appendChild(overlay);

// vinhetas cinematográficas (top + bottom)
function _vinheta(side) {
    const v = document.createElement('div');
    v.style.cssText = `
        position: absolute; left: 0; right: 0; height: 30%;
        ${side === 'top' ? 'top:0;' : 'bottom:0;'}
        background: linear-gradient(${side === 'top' ? '180deg' : '0deg'},
            rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
        pointer-events: none;
    `;
    overlay.appendChild(v);
}
_vinheta('top');
_vinheta('bottom');

// canvas das partículas mágicas
const partCanvas = document.createElement('canvas');
partCanvas.style.cssText = `position:absolute;inset:0;pointer-events:none;`;
overlay.appendChild(partCanvas);
const pctx = partCanvas.getContext('2d');
function _resizePart() {
    partCanvas.width  = window.innerWidth;
    partCanvas.height = window.innerHeight;
}
window.addEventListener('resize', _resizePart);
_resizePart();

// container central
const center = document.createElement('div');
center.style.cssText = `
    position: relative; z-index: 10;
    text-align: center;
    pointer-events: none;
    transform: translateY(-20px);
`;
overlay.appendChild(center);

// linha ornamental dourada
function _ornamento() {
    const o = document.createElement('div');
    o.style.cssText = `
        width: clamp(160px, 30vw, 420px); height: 1px;
        margin: 0 auto;
        background: linear-gradient(90deg, transparent, #d4a830 40%, #ffe0a0 50%, #d4a830 60%, transparent);
        box-shadow: 0 0 8px rgba(220,160,40,0.7);
    `;
    return o;
}
center.appendChild(_ornamento());

// pequena marca acima do título (símbolo mágico estilizado)
const marca = document.createElement('div');
marca.textContent = '✦';
marca.style.cssText = `
    font-size: clamp(14px, 1.6vw, 22px);
    color: #d4a830;
    text-shadow: 0 0 12px #d4a830;
    margin: 6px 0 -4px 0;
    animation: anidiaMarcaSpin 8s linear infinite;
`;
center.appendChild(marca);

// título principal — alegre, mágico, vibrante (a magia que existia)
const titulo = document.createElement('h1');
titulo.textContent = 'ANIDIA';
titulo.style.cssText = `
    margin: 14px 0 8px 0;
    font-size: clamp(64px, 12vw, 148px);
    font-weight: bold;
    letter-spacing: clamp(8px, 2.2vw, 26px);
    background: linear-gradient(180deg,
        #fffbe0 0%,
        #ffe87a 25%,
        #ffb84a 55%,
        #ff7a3a 80%,
        #c84020 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    filter: drop-shadow(0 0 24px rgba(255,200,80,0.75))
            drop-shadow(0 0 50px rgba(255,150,60,0.45))
            drop-shadow(0 5px 0 rgba(0,0,0,0.85));
    animation: anidiaShimmer 4s ease-in-out infinite,
               anidiaTituloIn 1.6s ease-out;
`;
center.appendChild(titulo);

// subtítulo — sombrio, ressequido, ecoa o desvanecer
const sub = document.createElement('div');
sub.textContent = 'O Desvanecer da Magia';
sub.style.cssText = `
    font-size: clamp(16px, 2.5vw, 28px);
    font-style: italic;
    font-weight: 300;
    letter-spacing: clamp(3px, 0.8vw, 8px);
    color: #b8a8c8;
    -webkit-text-stroke: 1.5px #5a1f8c;
    text-shadow:
        -1px -1px 0 #5a1f8c,
         1px -1px 0 #5a1f8c,
        -1px  1px 0 #5a1f8c,
         1px  1px 0 #5a1f8c,
         0    0   8px #7a2fc0,
         0    0   18px rgba(120,40,200,0.75),
         0    0   32px rgba(60,10,90,0.6);
    margin-top: -2px;
    opacity: 0.92;
    animation:
        anidiaSubIn 2.4s ease-out,
        anidiaSubFlicker 6s ease-in-out infinite 2s,
        anidiaSubGlitch 11s steps(1, end) infinite 4s;
`;
center.appendChild(sub);

const orna2 = _ornamento();
orna2.style.marginTop = '14px';
center.appendChild(orna2);

// --------------------------------------------------------
// MENU PRINCIPAL — caixas animadas (Nova Jornada, Ajustes, Crónicas)
// --------------------------------------------------------
const menu = document.createElement('div');
menu.style.cssText = `
    margin-top: clamp(38px, 6vh, 70px);
    display: flex; flex-direction: column;
    align-items: center; gap: 16px;
    pointer-events: auto;
    opacity: 0;
    animation: anidiaMenuIn 1.4s ease-out 0.8s forwards;
`;
center.appendChild(menu);

function _menuBtn(label, delay) {
    const b = document.createElement('div');
    b.className = 'anidia-menu-btn';
    b.style.cssText = `
        position: relative;
        width: clamp(280px, 32vw, 420px);
        padding: 14px 20px;
        font-family: 'Georgia', serif;
        font-size: clamp(14px, 1.6vw, 19px);
        letter-spacing: 4px;
        color: #ffe0a0;
        background: linear-gradient(180deg,
            rgba(60,30,8,0.92) 0%,
            rgba(30,18,8,0.95) 100%);
        border: 1.5px solid #c8a96e;
        border-radius: 4px;
        cursor: pointer;
        text-align: center;
        text-shadow: 0 0 10px rgba(255,210,80,0.45), 0 2px 3px #000;
        box-shadow:
            inset 0 0 12px rgba(212,168,48,0.18),
            0 4px 14px rgba(0,0,0,0.55),
            0 0 0 1px rgba(255,210,80,0.05);
        transition: transform 0.25s ease, box-shadow 0.25s ease,
                    background 0.25s ease, letter-spacing 0.25s ease,
                    border-color 0.25s ease;
        opacity: 0;
        animation: anidiaBtnIn 0.9s ease-out ${delay}s forwards;
        overflow: hidden;
    `;
    const txt = document.createElement('span');
    txt.textContent = label;
    b.appendChild(txt);
    // brilho deslizante (shine sweep)
    const shine = document.createElement('span');
    shine.style.cssText = `
        position:absolute; top:0; left:-60%; width:60%; height:100%;
        background: linear-gradient(120deg,
            transparent 0%,
            rgba(255,240,180,0.18) 50%,
            transparent 100%);
        pointer-events: none;
        transition: left 0.6s ease;
    `;
    b.appendChild(shine);

    b.addEventListener('mouseenter', () => {
        b.style.transform = 'translateY(-2px) scale(1.04)';
        b.style.letterSpacing = '6px';
        b.style.borderColor = '#ffe0a0';
        b.style.boxShadow = `
            inset 0 0 20px rgba(212,168,48,0.35),
            0 8px 26px rgba(0,0,0,0.7),
            0 0 28px rgba(255,210,80,0.45)`;
        shine.style.left = '120%';
    });
    b.addEventListener('mouseleave', () => {
        b.style.transform = '';
        b.style.letterSpacing = '4px';
        b.style.borderColor = '#c8a96e';
        b.style.boxShadow = `
            inset 0 0 12px rgba(212,168,48,0.18),
            0 4px 14px rgba(0,0,0,0.55),
            0 0 0 1px rgba(255,210,80,0.05)`;
        shine.style.left = '-60%';
    });
    b.addEventListener('mousedown', () => { b.style.transform = 'translateY(0) scale(0.98)'; });
    return b;
}

const btnNovoJogo = _menuBtn('NOVA JORNADA',       1.0);
const btnConfig   = _menuBtn('AJUSTES DE SUSERANO', 1.15);
const btnCreditos = _menuBtn('CRÓNICAS DOS CRIADORES', 1.30);
menu.appendChild(btnNovoJogo);
menu.appendChild(btnConfig);
menu.appendChild(btnCreditos);

btnNovoJogo.addEventListener('click', (e) => { e.stopPropagation(); iniciar(); });
btnConfig  .addEventListener('click', (e) => { e.stopPropagation(); abrirConfig(); });
btnCreditos.addEventListener('click', (e) => { e.stopPropagation(); abrirCreditos(); });

// rodapé
const foot = document.createElement('div');
foot.style.cssText = `
    position: absolute; bottom: 22px; left: 0; right: 0;
    text-align: center;
    font-size: 11px; color: #8a6a30;
    letter-spacing: 3px;
    font-family: 'Courier New', monospace;
    pointer-events: none;
`;
foot.innerHTML = `DESENVOLVIDO POR ALEXANDRE PEREIRA, FRANCISCO MONTEIRO E JOÃO GUEDES<br>PROJECTO WEBGL  ·  THREE.JS`;
overlay.appendChild(foot);

// esconde toda a UI de jogo enquanto o ecrã inicial está activo
document.body.classList.add('title-screen-active');
const styleHide = document.createElement('style');
styleHide.textContent = `
body.title-screen-active #game-hud,
body.title-screen-active #minimap-border,
body.title-screen-active #fps-counter,
body.title-screen-active #mod-menu,
body.title-screen-active #inv-overlay,
body.title-screen-active #pause-overlay,
body.title-screen-active #reward-overlay {
    display: none !important;
}
`;
document.head.appendChild(styleHide);

// keyframes CSS
const style = document.createElement('style');
style.textContent = `
@keyframes anidiaShimmer {
    0%,100% {
        filter: drop-shadow(0 0 24px rgba(255,200,80,0.75))
                drop-shadow(0 0 50px rgba(255,150,60,0.45))
                drop-shadow(0 5px 0 rgba(0,0,0,0.85));
    }
    50% {
        filter: drop-shadow(0 0 42px rgba(255,235,140,1))
                drop-shadow(0 0 80px rgba(255,180,90,0.7))
                drop-shadow(0 5px 0 rgba(0,0,0,0.85));
    }
}
@keyframes anidiaSubFlicker {
    0%, 88%, 100% { opacity: 0.92; }
    90%           { opacity: 0.55; }
    92%           { opacity: 0.92; }
    94%           { opacity: 0.40; }
    96%           { opacity: 0.92; }
}
/* glitch ocasional — 11s entre crises, cada crise dura ~0.5s */
@keyframes anidiaSubGlitch {
    /* estado normal (mantém o contorno roxo intacto) */
    0%, 4%, 36%, 40%, 100% {
        transform: translate(0,0) skew(0);
        text-shadow:
            -1px -1px 0 #5a1f8c,  1px -1px 0 #5a1f8c,
            -1px  1px 0 #5a1f8c,  1px  1px 0 #5a1f8c,
             0 0  8px #7a2fc0,
             0 0 18px rgba(120,40,200,0.75),
             0 0 32px rgba(60,10,90,0.6);
    }
    /* primeira crise ~0.4s */
    1% {
        transform: translate(-3px, 1px) skewX(-3deg);
        text-shadow:
             3px 0 #ff2cea, -3px 0 #00f0ff,
            -1px -1px 0 #5a1f8c,  1px -1px 0 #5a1f8c,
            -1px  1px 0 #5a1f8c,  1px  1px 0 #5a1f8c,
             0 0 18px rgba(120,40,200,0.9);
    }
    2% {
        transform: translate(2px, -1px) skewX(2deg);
        text-shadow:
            -4px 0 #ff2cea,  4px 0 #00f0ff,
            -1px -1px 0 #5a1f8c,  1px -1px 0 #5a1f8c,
            -1px  1px 0 #5a1f8c,  1px  1px 0 #5a1f8c,
             0 0 22px rgba(255,40,200,0.6);
    }
    3% {
        transform: translate(-1px, 0) skewX(0);
        text-shadow:
             2px 0 #ff2cea, -2px 0 #00f0ff,
            -1px -1px 0 #5a1f8c,  1px -1px 0 #5a1f8c,
            -1px  1px 0 #5a1f8c,  1px  1px 0 #5a1f8c;
    }
    /* segunda crise (mais violenta e ligeiramente mais longa) ~0.5s */
    37% {
        transform: translate(4px, -2px) skewX(4deg);
        text-shadow:
             4px 0 #ff2cea, -4px 0 #00f0ff,
            -1px -1px 0 #5a1f8c,  1px -1px 0 #5a1f8c,
            -1px  1px 0 #5a1f8c,  1px  1px 0 #5a1f8c,
             0 0 24px rgba(255,40,200,0.7);
    }
    38% {
        transform: translate(-3px, 2px) skewX(-3deg);
        text-shadow:
            -3px 0 #ff2cea,  3px 0 #00f0ff,
            -1px -1px 0 #5a1f8c,  1px -1px 0 #5a1f8c,
            -1px  1px 0 #5a1f8c,  1px  1px 0 #5a1f8c;
    }
    39% {
        transform: translate(1px, 0) skewX(0);
        text-shadow:
             1px 0 #ff2cea, -1px 0 #00f0ff,
            -1px -1px 0 #5a1f8c,  1px -1px 0 #5a1f8c,
            -1px  1px 0 #5a1f8c,  1px  1px 0 #5a1f8c;
    }
}
@keyframes anidiaPulse {
    0%,100% { opacity: 0.55; }
    50%     { opacity: 1; }
}
@keyframes anidiaMenuIn {
    0%   { opacity: 0; transform: translateY(20px); }
    100% { opacity: 1; transform: translateY(0); }
}
@keyframes anidiaBtnIn {
    0%   { opacity: 0; transform: translateY(18px) scale(0.94); }
    60%  { opacity: 1; }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes anidiaPanelIn {
    0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.92); }
    100% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
}
@keyframes anidiaBackdropIn {
    0%   { opacity: 0; backdrop-filter: blur(0px); }
    100% { opacity: 1; backdrop-filter: blur(6px); }
}
@keyframes anidiaTituloIn {
    0%   { opacity: 0; transform: scale(0.8); letter-spacing: clamp(2px, 0.5vw, 6px); }
    60%  { opacity: 1; }
    100% { opacity: 1; transform: scale(1); }
}
@keyframes anidiaSubIn {
    0%, 35% { opacity: 0; transform: translateY(10px); }
    100%    { opacity: 1; transform: translateY(0); }
}
@keyframes anidiaMarcaSpin {
    0%   { transform: rotate(0deg) scale(1); }
    50%  { transform: rotate(180deg) scale(1.15); }
    100% { transform: rotate(360deg) scale(1); }
}
`;
document.head.appendChild(style);

// --------------------------------------------------------
// PARTÍCULAS MÁGICAS — sobem em espiral e desvanecem
// --------------------------------------------------------
const particulas = [];
function _novaParticula() {
    const azulado = Math.random() > 0.7;
    return {
        x: Math.random() * partCanvas.width,
        y: partCanvas.height + 10,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.6,
        r: 1.0 + Math.random() * 2.4,
        life: 1,
        decay: 0.0006 + Math.random() * 0.0014,
        cor: azulado ? '#9bb6ff' : (Math.random() > 0.5 ? '#ffe9b5' : '#ffd070'),
        wobble: Math.random() * Math.PI * 2,
        wobAmp: 0.25 + Math.random() * 0.45,
    };
}

function _tickParticulas() {
    if (_ativa && particulas.length < 110) particulas.push(_novaParticula());
    pctx.clearRect(0, 0, partCanvas.width, partCanvas.height);
    for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.wobble += 0.05;
        p.x += p.vx + Math.sin(p.wobble) * p.wobAmp;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0 || p.y < -30) { particulas.splice(i, 1); continue; }

        pctx.globalAlpha = Math.min(1, p.life * 1.2);
        pctx.shadowColor = p.cor;
        pctx.shadowBlur = p.r * 5;
        pctx.fillStyle = p.cor;
        pctx.beginPath();
        pctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        pctx.fill();
    }
    pctx.shadowBlur = 0;
    pctx.globalAlpha = 1;
    requestAnimationFrame(_tickParticulas);
}
_tickParticulas();

// --------------------------------------------------------
// PAINEL MODAL — usado por Ajustes e Crónicas
// --------------------------------------------------------
function _abrirModal(titulo, builder) {
    // garantir que a melodia do título continua a soar
    _garantirMusicaTitulo();

    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed; inset: 0; z-index: 320;
        background: rgba(8,4,16,0.55);
        backdrop-filter: blur(6px);
        animation: anidiaBackdropIn 0.35s ease-out forwards;
        opacity: 0;
    `;
    document.body.appendChild(backdrop);

    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed; left: 50%; top: 50%;
        transform: translate(-50%,-50%);
        z-index: 321;
        min-width: clamp(320px, 46vw, 560px);
        max-width: 92vw;
        max-height: 84vh; overflow: auto;
        padding: 26px 30px 22px;
        font-family: 'Georgia', serif; color: #f0d080;
        background: linear-gradient(180deg,
            rgba(40,22,8,0.96) 0%,
            rgba(20,12,6,0.98) 100%);
        border: 1.5px solid #c8a96e;
        border-radius: 8px;
        box-shadow:
            inset 0 0 22px rgba(212,168,48,0.18),
            0 18px 60px rgba(0,0,0,0.75),
            0 0 40px rgba(212,168,48,0.25);
        animation: anidiaPanelIn 0.5s cubic-bezier(.2,.9,.3,1.3) forwards;
        opacity: 0;
    `;
    document.body.appendChild(panel);

    const cabecalho = document.createElement('div');
    cabecalho.style.cssText = `
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(212,168,48,0.35);`;
    const h = document.createElement('div');
    h.textContent = titulo;
    h.style.cssText = `
        font-size: clamp(18px, 2.1vw, 24px);
        letter-spacing: 5px;
        color: #ffe0a0;
        text-shadow: 0 0 14px rgba(255,210,80,0.55);`;
    cabecalho.appendChild(h);

    const fechar = document.createElement('div');
    fechar.textContent = '✕';
    fechar.style.cssText = `
        cursor:pointer; padding: 4px 10px; border-radius: 4px;
        color:#c8a96e; font-size: 18px;
        transition: background 0.2s, color 0.2s;`;
    fechar.onmouseenter = () => { fechar.style.background = 'rgba(212,168,48,0.18)'; fechar.style.color = '#ffe0a0'; };
    fechar.onmouseleave = () => { fechar.style.background = 'transparent'; fechar.style.color = '#c8a96e'; };
    cabecalho.appendChild(fechar);
    panel.appendChild(cabecalho);

    const body = document.createElement('div');
    panel.appendChild(body);
    builder(body);

    const close = () => {
        panel.style.animation = 'none';
        backdrop.style.animation = 'none';
        panel.style.transition = 'opacity 0.25s, transform 0.25s';
        backdrop.style.transition = 'opacity 0.25s';
        panel.style.opacity = '0';
        panel.style.transform = 'translate(-50%,-50%) scale(0.94)';
        backdrop.style.opacity = '0';
        setTimeout(() => { panel.remove(); backdrop.remove(); }, 280);
    };
    fechar.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    return { panel, body, close };
}

function _slider(min, max, step, value, onInput, suffix = '') {
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:flex;align-items:center;gap:10px;`;
    const s = document.createElement('input');
    s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
    s.style.cssText = `flex:1;accent-color:#d4a830;`;
    const v = document.createElement('span');
    v.style.cssText = `min-width:54px;text-align:right;font-family:'Courier New',monospace;color:#ffe0a0;font-size:13px;`;
    const fmt = () => v.textContent = (suffix === '%' ? Math.round(s.value * 100) + '%' : Number(s.value).toFixed(step < 1 ? 2 : 0) + suffix);
    fmt();
    s.oninput = () => { fmt(); onInput(parseFloat(s.value)); };
    wrap.appendChild(s); wrap.appendChild(v);
    return wrap;
}

function _toggle(value, onChange) {
    const lbl = document.createElement('label');
    lbl.style.cssText = `display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:#f0d080;font-size:13px;`;
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!value;
    cb.style.cssText = `accent-color:#d4a830;width:16px;height:16px;`;
    const span = document.createElement('span'); span.textContent = value ? 'Activado' : 'Desactivado';
    cb.onchange = () => { onChange(cb.checked); span.textContent = cb.checked ? 'Activado' : 'Desactivado'; };
    lbl.appendChild(cb); lbl.appendChild(span);
    return lbl;
}

function _row(label) {
    const r = document.createElement('div');
    r.style.cssText = `display:grid;grid-template-columns:1fr 1.4fr;gap:14px;align-items:center;
        padding: 8px 4px; border-bottom: 1px dashed rgba(200,169,110,0.18);`;
    const l = document.createElement('div');
    l.textContent = label;
    l.style.cssText = `font-size:13px;color:#c8a96e;letter-spacing:1px;`;
    r.appendChild(l);
    return r;
}

function abrirConfig() {
    _abrirModal('⚙  AJUSTES DE SUSERANO', (body) => {
        const sec = (titulo) => {
            const s = document.createElement('div');
            s.style.cssText = `margin: 14px 0 6px; font-size:12px; letter-spacing: 3px;
                color:#d4a830; text-shadow:0 0 8px rgba(212,168,48,0.4);`;
            s.textContent = titulo;
            body.appendChild(s);
        };

        sec('SOPROS E ECOUS');
        const rMaster = _row('Sopro do Mundo');
        rMaster.appendChild(_slider(0, 1, 0.01, settings.masterVolume, v => setSetting('masterVolume', v), '%'));
        body.appendChild(rMaster);

        const rMusic = _row('Melodias');
        rMusic.appendChild(_slider(0, 1, 0.01, settings.musicVolume, v => setSetting('musicVolume', v), '%'));
        body.appendChild(rMusic);

        const rSfx = _row('Ecos da Batalha');
        rSfx.appendChild(_slider(0, 1, 0.01, settings.sfxVolume, v => setSetting('sfxVolume', v), '%'));
        body.appendChild(rSfx);

        const rMute = _row('Silenciar o Reino');
        rMute.appendChild(_toggle(settings.muted, v => setSetting('muted', v)));
        body.appendChild(rMute);

        sec('VISÕES DO MUNDO');
        const rFov = _row('Alcance do Olhar');
        rFov.appendChild(_slider(50, 110, 1, settings.fov, v => setSetting('fov', v), '°'));
        body.appendChild(rFov);

        const rFps = _row('Mostrar Cadência');
        rFps.appendChild(_toggle(settings.showFps, v => setSetting('showFps', v)));
        body.appendChild(rFps);

        const rFs = _row('Ecrã Inteiro');
        rFs.appendChild(_toggle(!!document.fullscreenElement, v => {
            setSetting('fullscreen', v);
            if (v && !document.fullscreenElement) document.documentElement.requestFullscreen?.();
            else if (!v && document.fullscreenElement) document.exitFullscreen?.();
        }));
        body.appendChild(rFs);

        sec('ARTE DA GUERRA');
        const rSens = _row('Agilidade da Mão');
        rSens.appendChild(_slider(0.1, 3.0, 0.05, settings.mouseSensitivity, v => setSetting('mouseSensitivity', v), 'x'));
        body.appendChild(rSens);

        const rInv = _row('Inverter Eixo Y');
        rInv.appendChild(_toggle(settings.invertY, v => setSetting('invertY', v)));
        body.appendChild(rInv);

        const hint = document.createElement('div');
        hint.style.cssText = `margin-top:14px;font-size:11px;color:#8a6a30;
            font-style:italic;letter-spacing:1px;text-align:center;`;
        hint.textContent = 'Mais ajustes estarão disponíveis na trégua durante a jornada.';
        body.appendChild(hint);
    });
}

function abrirCreditos() {
    _abrirModal('⚜  CRÓNICAS DOS CRIADORES', (body) => {
        body.style.cssText = `text-align:center;line-height:1.9;font-size:14px;`;
        body.innerHTML = `
            <div style="margin: 14px 0 6px; font-size:11px; letter-spacing:4px; color:#d4a830;">DESENVOLVIDO POR</div>
            <div style="font-size:18px;letter-spacing:3px;color:#ffe0a0;text-shadow:0 0 12px rgba(255,210,80,0.4);">
                ALEXANDRE PEREIRA<br>
                FRANCISCO MONTEIRO<br>
                JOÃO GUEDES
            </div>

            <div style="margin: 22px 0 6px; font-size:11px; letter-spacing:4px; color:#d4a830;">PROJECTO</div>
            <div style="color:#f0d080;">WebGL  ·  three.js</div>

            <div style="margin: 22px 0 6px; font-size:11px; letter-spacing:4px; color:#d4a830;">AGRADECIMENTOS</div>
            <div style="color:#c8a96e;font-size:13px;font-style:italic;">
                À magia que ainda restou,<br>
                e a quem ousou despertá-la.
            </div>

            <div style="margin-top: 24px; font-size:11px; color:#8a6a30; letter-spacing:2px;">
                ANIDIA · O DESVANECER DA MAGIA · 2026
            </div>
        `;
    });
}

// Garante que a melodia do título está a soar. Útil para reentradas (modais).
function _garantirMusicaTitulo() {
    // Arranca a faixa IMEDIATAMENTE durante o gesto do utilizador — o play()
    // sincrono dentro do handler de click é o que destranca o AudioContext
    // em Safari/iOS. O resume corre em paralelo (idempotente).
    if (getCurrentTrack() !== 'title') switchMusic('title', 0.8);
    resumeAudio().then(() => {
        // Se o buffer só carregar depois ou o play silenciou por contexto
        // suspenso, força um (re)start agora com o contexto já retomado.
        if (getCurrentTrack() !== 'title') switchMusic('title', 0.8);
    });
}

// --------------------------------------------------------
// SPLASH SCREEN — Bypass Autoplay
// --------------------------------------------------------
const splash = document.createElement('div');
splash.id = 'autoplay-bypass';
splash.style.cssText = `
    position: fixed; inset: 0;
    z-index: 400;
    background: #000;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    cursor: pointer;
    transition: opacity 1.5s ease;
`;

const splashContent = document.createElement('div');
splashContent.style.textAlign = 'center';
splashContent.innerHTML = `
    <div style="font-size: 11px; letter-spacing: 6px; color: #5a4a30; margin-bottom: 24px;">DESENVOLVIDO EM WEBGL</div>
    <div style="font-size: 22px; letter-spacing: 14px; color: #f0d080; text-shadow: 0 0 20px rgba(212,168,48,0.4); animation: splashPulse 2s ease-in-out infinite;">DESPERTAR ANIDIA</div>
    <div style="font-size: 10px; letter-spacing: 3px; color: #666; margin-top: 50px;">CLIQUE PARA INICIAR EM ECRÃ INTEIRO</div>
    <div style="font-size: 9px; letter-spacing: 2px; color: #3a3a3a; margin-top: 6px;">(activa som e entra em ecrã inteiro)</div>
`;
splash.appendChild(splashContent);

const splashStyle = document.createElement('style');
splashStyle.textContent = `
@keyframes splashPulse {
    0%, 100% { opacity: 0.6; transform: scale(0.98); }
    50%      { opacity: 1;   transform: scale(1.02); }
}
`;
document.head.appendChild(splashStyle);
document.body.appendChild(splash);

// Pede ecrã inteiro logo na primeira interacção (gesto do utilizador
// obrigatório por política do browser) e arranca a melodia do título.
function _entrarFullscreenSafely() {
    const el = document.documentElement;
    const req = el.requestFullscreen
             || el.webkitRequestFullscreen
             || el.mozRequestFullScreen
             || el.msRequestFullscreen;
    if (!req) return;
    try {
        const p = req.call(el);
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) { /* ignora — alguns browsers atiram se já em fullscreen */ }
}

splash.addEventListener('click', () => {
    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    // Melodia primeiro — tem de arrancar dentro do gesto do utilizador
    // (browsers bloqueiam play() fora dele). Ecrã inteiro pode esperar.
    _garantirMusicaTitulo();
    _entrarFullscreenSafely();
    setTimeout(() => splash.remove(), 1600);
});

// --------------------------------------------------------
// API
// --------------------------------------------------------
export function isTelaInicialAberta() { return _ativa; }
export function onTelaInicialFechar(fn) { _onIniciar = fn; }

function iniciar() {
    if (!_ativa) return;
    _ativa = false;
    overlay.style.opacity = '0';
    overlay.style.transform = 'scale(1.04)';
    document.body.classList.remove('title-screen-active');
    setTimeout(() => { overlay.style.display = 'none'; }, 900);
    if (_onIniciar) { try { _onIniciar(); } catch (e) { console.error(e); } }
}

// Enter / Espaço inicia nova jornada; Esc fecha modais se abertos
window.addEventListener('keydown', (e) => {
    if (!_ativa) return;

    // Se o splash ainda estiver visível, qualquer tecla remove-o
    const s = document.getElementById('autoplay-bypass');
    if (s) { s.click(); return; }

    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation();
        iniciar();
    }
}, true);

overlay.style.cursor = 'default';
