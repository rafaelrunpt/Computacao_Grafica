// --------------------------------------------------------
// TELA INICIAL — ANIDIA: O Desvanecer da Magia
// --------------------------------------------------------
// Mostra título cinematográfico com vista orbital sobre o
// panorama do mundo. Dispensa-se com qualquer tecla / clique.
// --------------------------------------------------------
import * as THREE from 'three';

let _ativa = true;
let _onIniciar = null;

// --------------------------------------------------------
// CÂMARA — orbita lenta com leve dolly + bobbing
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

// prompt de início pulsante
const prompt = document.createElement('div');
prompt.innerHTML = '⚜  PREMIR PARA INICIAR  ⚜';
prompt.style.cssText = `
    margin-top: clamp(46px, 8vh, 90px);
    font-size: clamp(13px, 1.4vw, 18px);
    letter-spacing: 5px;
    color: #ffe0a0;
    text-shadow: 0 0 14px rgba(255,210,80,0.55), 0 2px 4px #000;
    animation: anidiaPulse 1.7s ease-in-out infinite;
    pointer-events: none;
`;
center.appendChild(prompt);

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
foot.innerHTML = `PROJECTO WEBGL  ·  THREE.JS`;
overlay.appendChild(foot);

// esconde toda a UI de jogo enquanto a tela inicial está activa
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

// dispensa com clique no overlay ou qualquer tecla
overlay.addEventListener('click', iniciar);
window.addEventListener('keydown', (e) => {
    if (!_ativa) return;
    e.preventDefault();
    e.stopPropagation();
    iniciar();
}, true); // capture phase — corre antes dos outros listeners
