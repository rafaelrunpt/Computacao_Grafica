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

// garante que as fontes pixel estão carregadas (também usadas no loadout/HUD)
if (!document.querySelector('link[data-anidia-pixel-fonts]')) {
    const _lnk = document.createElement('link');
    _lnk.rel = 'stylesheet';
    _lnk.dataset.anidiaPixelFonts = '1';
    _lnk.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
    document.head.appendChild(_lnk);
}

// ---- SVG pixel art (sol / lua) e padrões dither para os fundos ----
const _svgToUri = (svg) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

const SUN_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' shape-rendering='crispEdges'>
<rect x='5' y='0' width='2' height='1' fill='#fff4a0'/>
<rect x='5' y='11' width='2' height='1' fill='#fff4a0'/>
<rect x='0' y='5' width='1' height='2' fill='#fff4a0'/>
<rect x='11' y='5' width='1' height='2' fill='#fff4a0'/>
<rect x='1' y='1' width='1' height='1' fill='#ffe87a'/>
<rect x='10' y='1' width='1' height='1' fill='#ffe87a'/>
<rect x='1' y='10' width='1' height='1' fill='#ffe87a'/>
<rect x='10' y='10' width='1' height='1' fill='#ffe87a'/>
<rect x='4' y='2' width='4' height='1' fill='#ffd86b'/>
<rect x='3' y='3' width='6' height='1' fill='#ffd86b'/>
<rect x='2' y='4' width='8' height='1' fill='#ffd86b'/>
<rect x='2' y='5' width='8' height='2' fill='#ffc858'/>
<rect x='2' y='7' width='8' height='1' fill='#ffb84a'/>
<rect x='3' y='8' width='6' height='1' fill='#ffb84a'/>
<rect x='4' y='9' width='4' height='1' fill='#f0a838'/>
<rect x='4' y='4' width='2' height='2' fill='#fff4a0'/>
</svg>`;
const MOON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' shape-rendering='crispEdges'>
<rect x='4' y='1' width='3' height='1' fill='#e8d4ff'/>
<rect x='2' y='2' width='5' height='1' fill='#d8b8ff'/>
<rect x='1' y='3' width='5' height='1' fill='#d8b8ff'/>
<rect x='1' y='4' width='4' height='1' fill='#a878d0'/>
<rect x='1' y='5' width='4' height='2' fill='#a878d0'/>
<rect x='1' y='7' width='4' height='1' fill='#7a4dc0'/>
<rect x='1' y='8' width='5' height='1' fill='#7a4dc0'/>
<rect x='2' y='9' width='5' height='1' fill='#5a1f8c'/>
<rect x='4' y='10' width='3' height='1' fill='#5a1f8c'/>
<rect x='2' y='3' width='1' height='1' fill='#fff'/>
<rect x='2' y='6' width='1' height='1' fill='#e8d4ff'/>
</svg>`;
const SUN_URL  = _svgToUri(SUN_SVG);
const MOON_URL = _svgToUri(MOON_SVG);

// Padrões dither 8×8 (tiling) — fundo pixel para os botões/pills
const DITHER_GOLD = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'>
<rect width='8' height='8' fill='#2a1808'/>
<rect x='0' y='0' width='1' height='1' fill='#3a2410'/>
<rect x='4' y='0' width='1' height='1' fill='#3a2410'/>
<rect x='2' y='2' width='1' height='1' fill='#3a2410'/>
<rect x='6' y='2' width='1' height='1' fill='#3a2410'/>
<rect x='1' y='4' width='1' height='1' fill='#1a0e04'/>
<rect x='5' y='4' width='1' height='1' fill='#1a0e04'/>
<rect x='3' y='6' width='1' height='1' fill='#3a2410'/>
<rect x='7' y='6' width='1' height='1' fill='#1a0e04'/>
</svg>`;
const DITHER_PURPLE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'>
<rect width='8' height='8' fill='#1c0a30'/>
<rect x='0' y='0' width='1' height='1' fill='#2a1248'/>
<rect x='4' y='0' width='1' height='1' fill='#2a1248'/>
<rect x='2' y='2' width='1' height='1' fill='#3a1a60'/>
<rect x='6' y='2' width='1' height='1' fill='#2a1248'/>
<rect x='1' y='4' width='1' height='1' fill='#10041c'/>
<rect x='5' y='4' width='1' height='1' fill='#10041c'/>
<rect x='3' y='6' width='1' height='1' fill='#2a1248'/>
<rect x='7' y='6' width='1' height='1' fill='#10041c'/>
</svg>`;
const DITHER_GOLD_URL   = _svgToUri(DITHER_GOLD);
const DITHER_PURPLE_URL = _svgToUri(DITHER_PURPLE);

// fundos compostos: dither pixel + leve gradiente vertical para profundidade
const BTN_BG_DAY   = `${DITHER_GOLD_URL}, linear-gradient(180deg, rgba(60,30,8,0.92) 0%, rgba(30,18,8,0.95) 100%)`;
const BTN_BG_NIGHT = `${DITHER_PURPLE_URL}, linear-gradient(180deg, rgba(60,30,90,0.92) 0%, rgba(28,10,48,0.96) 100%)`;

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
const ornaTop = _ornamento();
center.appendChild(ornaTop);

// pequena marca acima do título (símbolo mágico estilizado)
const marca = document.createElement('div');
marca.style.cssText = `
    width: clamp(20px, 2.4vw, 32px);
    height: clamp(20px, 2.4vw, 32px);
    margin: 6px auto -4px;
    background: ${SUN_URL} center/contain no-repeat;
    image-rendering: pixelated;
    animation: anidiaMarcaSpin 8s linear infinite;
`;
center.appendChild(marca);

// título principal — alegre, mágico, vibrante (a magia que existia)
const titulo = document.createElement('h1');
titulo.textContent = 'ANIDIA';
titulo.style.cssText = `
    margin: 14px 0 8px 0;
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(36px, 7vw, 86px);
    font-weight: normal;
    letter-spacing: clamp(4px, 1vw, 12px);
    /* Gradiente em tiras duras (pixel-band) — amarelo → laranja → vermelho → roxo escorrido */
    background: linear-gradient(180deg,
        #ffeb8a 0%,    #ffeb8a 18%,
        #f0a838 18%,   #f0a838 38%,
        #c8682a 38%,   #c8682a 55%,
        #8a2848 55%,   #8a2848 72%,
        #5a1f8c 72%,   #5a1f8c 88%,
        #2a0a48 88%,   #2a0a48 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    /* outline pixel chunky preto à volta + sombra dura */
    filter:
        drop-shadow( 3px  0   0 #000) drop-shadow(-3px  0   0 #000)
        drop-shadow( 0    3px 0 #000) drop-shadow( 0   -3px 0 #000)
        drop-shadow( 3px  3px 0 #000) drop-shadow(-3px  3px 0 #000)
        drop-shadow( 0    8px 0 rgba(0,0,0,0.85));
    animation: anidiaShimmer 4s steps(4, end) infinite,
               anidiaTituloIn 1.6s ease-out,
               anidiaTituloBob 2.6s ease-in-out infinite 1.6s;
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
    color: #d878e8;
    font-family: 'VT323', monospace;
    text-shadow:
        1px 1px 0 #3a1050,
        2px 2px 0 #1a0428;
    margin-top: -2px;
    opacity: 0.92;
    animation:
        anidiaSubIn 2.4s ease-out,
        anidiaSubFlicker 6s ease-in-out infinite 2s,
        anidiaSubGlitch 11s steps(1, end) infinite 4s;
`;
center.appendChild(sub);

const ornaBot = _ornamento();
ornaBot.style.marginTop = '14px';
center.appendChild(ornaBot);

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
        font-family: 'Press Start 2P', monospace;
        font-size: clamp(10px, 1.1vw, 13px);
        letter-spacing: 3px;
        color: #e8d8a8;
        background: ${BTN_BG_DAY};
        background-size: 8px 8px, cover;
        background-repeat: repeat, no-repeat;
        image-rendering: pixelated;
        border: 2px solid #7a6a48;
        cursor: pointer;
        text-align: center;
        text-shadow: 1px 1px 0 #000;
        box-shadow:
            inset 0 0 0 1px rgba(15,8,24,0.6),
            0 3px 0 #000;
        transition: color 0.12s ease, letter-spacing 0.15s ease,
                    border-color 0.15s ease, background 0.2s ease,
                    transform 0.05s ease;
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
        const noite = !!window.__anidiaNoite;
        b.style.color = noite ? '#fff' : '#fff4a0';
        b.style.letterSpacing = '4px';
        b.style.borderColor = noite ? '#d8b8ff' : '#ffd86b';
        shine.style.left = '120%';
    });
    b.addEventListener('mouseleave', () => {
        const noite = !!window.__anidiaNoite;
        b.style.color = noite ? '#e8d4ff' : '#e8d8a8';
        b.style.letterSpacing = '3px';
        b.style.borderColor = noite ? '#7a4dc0' : '#7a6a48';
        b.style.transform = '';
        b.style.boxShadow = `
            inset 0 0 0 1px rgba(15,8,24,0.6),
            0 3px 0 #000`;
        shine.style.left = '-60%';
    });
    b.addEventListener('mousedown', () => {
        const noite = !!window.__anidiaNoite;
        b.style.color = noite ? '#d8b8ff' : '#ffd86b';
        b.style.transform = 'translateY(3px)';
        b.style.boxShadow = `inset 0 0 0 1px rgba(15,8,24,0.6), 0 0 0 #000`;
    });
    b.addEventListener('mouseup',   () => {
        b.style.transform = '';
        b.style.boxShadow = `
            inset 0 0 0 1px rgba(15,8,24,0.6),
            0 3px 0 #000`;
    });
    return b;
}

const btnNovoJogo = _menuBtn('NOVA JORNADA',       1.0);
const btnConfig   = _menuBtn('AJUSTES DE SUSERANO', 1.15);
const btnCreditos = _menuBtn('CRÓNICAS DOS CRIADORES', 1.30);
menu.appendChild(btnNovoJogo);
menu.appendChild(btnConfig);
menu.appendChild(btnCreditos);

// --------------------------------------------------------
// SELECTOR DE MODO — escolha de iluminação antes de partir
// (a noite acrescenta dezenas de fontes de luz dinâmicas — tem
// custo de performance e por isso é escolhida aqui, fora do mundo).
// --------------------------------------------------------
const modoBox = document.createElement('div');
modoBox.style.cssText = `
    margin-top: 18px;
    width: clamp(280px, 32vw, 420px);
    display: flex; flex-direction: column; gap: 6px;
    pointer-events: auto;
    opacity: 0;
    animation: anidiaBtnIn 0.9s ease-out 1.5s forwards;
`;
menu.appendChild(modoBox);

const modoTitulo = document.createElement('div');
modoTitulo.style.cssText = `
    font-size: 9px; letter-spacing: 4px; color: #a08050;
    text-align: center; font-family: 'Press Start 2P', monospace;
    text-shadow: 1px 1px 0 #000;
`;
modoTitulo.innerHTML = `<span style="display:inline-block;width:10px;height:10px;vertical-align:-1px;margin-right:6px;background:${SUN_URL} center/contain no-repeat;image-rendering:pixelated;"></span>HORA DO MUNDO<span style="display:inline-block;width:10px;height:10px;vertical-align:-1px;margin-left:6px;background:${MOON_URL} center/contain no-repeat;image-rendering:pixelated;"></span>`;
modoBox.appendChild(modoTitulo);

const modoRow = document.createElement('div');
modoRow.style.cssText = `
    display: flex; gap: 6px;
`;
modoBox.appendChild(modoRow);

function _modoPill(label, hint, ativo) {
    const p = document.createElement('div');
    const isNoite = label.includes('NOITE');
    const iconUrl = isNoite ? MOON_URL : SUN_URL;
    const ditherUrl = isNoite ? DITHER_PURPLE_URL : DITHER_GOLD_URL;
    p.style.cssText = `
        flex: 1; padding: 10px 8px; cursor: pointer;
        text-align: center;
        font-family: 'Press Start 2P', monospace; font-size: 9px; letter-spacing: 2px;
        border: 2px solid ${ativo ? (isNoite ? '#d8b8ff' : '#ffd86b') : '#6a5020'};
        background-image: ${ditherUrl};
        background-size: 8px 8px;
        background-repeat: repeat;
        image-rendering: pixelated;
        color: ${ativo ? (isNoite ? '#d8b8ff' : '#ffd86b') : '#caa463'};
        text-shadow: 1px 1px 0 #000;
        transition: color 0.12s ease, border-color 0.15s ease, opacity 0.2s ease;
        opacity: ${ativo ? '0.6' : '1'};
        filter: ${ativo ? 'brightness(0.7) saturate(0.7)' : 'none'};
        user-select: none;
    `;
    const labelText = label.replace(/^[^A-Z]+/, '');
    p.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:6px;">
        <span style="display:inline-block;width:12px;height:12px;background:${iconUrl} center/contain no-repeat;image-rendering:pixelated;"></span>
        <span>${labelText}</span>
    </div>
    <div style="font-size:13px;letter-spacing:1px;color:${ativo ? '#c8a85a' : '#7a6850'};
        margin-top:3px;font-family:'VT323',monospace;text-shadow:none;">${hint}</div>`;
    return p;
}

let _modoNocturno = !!settings.nightMode;

const pillDia   = _modoPill('☀ DIA',   'Rápido',   !_modoNocturno);
const pillNoite = _modoPill('🌙 NOITE', 'Benchmark', _modoNocturno);
modoRow.appendChild(pillDia);
modoRow.appendChild(pillNoite);

function _refrescarPills() {
    window.__anidiaNoite = _modoNocturno;
    // Ambos os pills usam o dither do MODO ACTUAL (não do próprio pill) para consistência:
    // se NOITE está activo → ambos têm fundo roxo; se DIA está activo → ambos dourado.
    const ditherUrl = _modoNocturno ? DITHER_PURPLE_URL : DITHER_GOLD_URL;
    const cssAtivo = (ativo, modoNoite) => {
        const accentOn = modoNoite ? '#d8b8ff' : '#ffd86b';
        return `
            flex: 1; padding: 10px 8px; cursor: pointer;
            text-align: center;
            font-family: 'Press Start 2P', monospace; font-size: 9px; letter-spacing: 2px;
            border: 2px solid ${ativo ? accentOn : '#6a5020'};
            background-image: ${ditherUrl};
            background-size: 8px 8px;
            background-repeat: repeat;
            image-rendering: pixelated;
            color: ${ativo ? accentOn : '#caa463'};
            text-shadow: 1px 1px 0 #000;
            transition: color 0.12s ease, border-color 0.15s ease, opacity 0.2s ease;
            opacity: ${ativo ? '0.6' : '1'};
        filter: ${ativo ? 'brightness(0.7) saturate(0.7)' : 'none'};
            user-select: none;
        `;
    };
    const _icone = (url) => `<span style="display:inline-block;width:12px;height:12px;background:${url} center/contain no-repeat;image-rendering:pixelated;"></span>`;
    pillDia.style.cssText = cssAtivo(!_modoNocturno, false);
    pillDia.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:6px;">${_icone(SUN_URL)}<span>DIA</span></div>
        <div style="font-size:13px;letter-spacing:1px;color:${!_modoNocturno ? '#c8a85a' : '#7a6850'};
            margin-top:3px;font-family:'VT323',monospace;text-shadow:none;">Rápido</div>`;
    pillNoite.style.cssText = cssAtivo(_modoNocturno, true);
    pillNoite.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:6px;">${_icone(MOON_URL)}<span>NOITE</span></div>
        <div style="font-size:13px;letter-spacing:1px;color:${_modoNocturno ? '#c8a85a' : '#7a6850'};
            margin-top:3px;font-family:'VT323',monospace;text-shadow:none;">Benchmark</div>`;

    // Atualizar os emojis do título do seletor (pixel SVG)
    const _ic = (url) => `<span style="display:inline-block;width:10px;height:10px;vertical-align:-1px;background:${url} center/contain no-repeat;image-rendering:pixelated;"></span>`;
    modoTitulo.innerHTML = _modoNocturno
        ? `${_ic(MOON_URL)}<span style="margin:0 6px;">HORA DO MUNDO</span>${_ic(MOON_URL)}`
        : `${_ic(SUN_URL)}<span style="margin:0 6px;">HORA DO MUNDO</span>${_ic(SUN_URL)}`;

    // Símbolo no topo do título — sol pixel (dia) ou lua pixel (noite)
    marca.style.background = (_modoNocturno ? MOON_URL : SUN_URL) + ' center/contain no-repeat';

    // Fundo dos 3 botões — dourado de dia, roxo de noite
    const _bg = _modoNocturno ? BTN_BG_NIGHT : BTN_BG_DAY;
    const _bord = _modoNocturno ? '#7a4dc0' : '#7a6a48';
    [btnNovoJogo, btnConfig, btnCreditos].forEach(b => {
        b.style.background = _bg;
        b.style.backgroundSize = '8px 8px, cover';
        b.style.backgroundRepeat = 'repeat, no-repeat';
        b.style.borderColor = _bord;
        b.style.color = _modoNocturno ? '#e8d4ff' : '#e8d8a8';
    });

    // Atualizar subtítulo e tema visual do topo
    sub.textContent = _modoNocturno ? 'O Desvanecer da Magia' : 'O Despertar da Magia';
    
    if (_modoNocturno) {
        sub.style.color = '#b8a8c8';
        sub.style.webkitTextStroke = '1.5px #5a1f8c';
        sub.style.textShadow = `
            -1px -1px 0 #5a1f8c, 1px -1px 0 #5a1f8c,
            -1px 1px 0 #5a1f8c, 1px 1px 0 #5a1f8c,
            0 0 8px #7a2fc0, 0 0 18px rgba(120,40,200,0.75)`;
        // Título corrompido — full concept art: amarelo no topo a escorrer para roxo profundo
        titulo.style.background = `linear-gradient(180deg,
            #ffeb8a 0%,   #ffeb8a 16%,
            #f0a838 16%,  #f0a838 34%,
            #c8682a 34%,  #c8682a 50%,
            #8a2848 50%,  #8a2848 66%,
            #5a1f8c 66%,  #5a1f8c 84%,
            #2a0a48 84%,  #2a0a48 100%)`;
        titulo.style.webkitBackgroundClip = 'text';
        titulo.style.backgroundClip = 'text';
        titulo.style.filter = `
            drop-shadow( 3px  0   0 #000) drop-shadow(-3px  0   0 #000)
            drop-shadow( 0    3px 0 #000) drop-shadow( 0   -3px 0 #000)
            drop-shadow( 3px  3px 0 #000) drop-shadow(-3px  3px 0 #000)
            drop-shadow( 0    8px 0 rgba(0,0,0,0.85))`;
        titulo.style.animation = 'anidiaShimmer 4s steps(4, end) infinite, anidiaTituloBob 2.6s ease-in-out infinite';
        
        // Ornatos roxos (combina com outline #5a1f8c)
        const purp = '#5a1f8c';
        ornaTop.style.background = `linear-gradient(90deg, transparent, ${purp} 40%, #c8a8ff 50%, ${purp} 60%, transparent)`;
        ornaTop.style.boxShadow = `0 0 8px rgba(90,31,140,0.7)`;
        ornaBot.style.background = `linear-gradient(90deg, transparent, ${purp} 40%, #c8a8ff 50%, ${purp} 60%, transparent)`;
        ornaBot.style.boxShadow = `0 0 8px rgba(90,31,140,0.7)`;
    } else {
        sub.style.color = '#ffe0a0';
        sub.style.webkitTextStroke = '1.2px #a06020';
        sub.style.textShadow = `
            -1px -1px 0 #a06020, 1px -1px 0 #a06020,
            -1px 1px 0 #a06020, 1px 1px 0 #a06020,
            0 0 12px rgba(255,210,80,0.5)`;
        // Título modo dia — mesmo gradiente "melt" roxo da concept art (igual ao noturno)
        titulo.style.background = `linear-gradient(180deg,
            #ffeb8a 0%,   #ffeb8a 16%,
            #f0a838 16%,  #f0a838 34%,
            #c8682a 34%,  #c8682a 50%,
            #8a2848 50%,  #8a2848 66%,
            #5a1f8c 66%,  #5a1f8c 84%,
            #2a0a48 84%,  #2a0a48 100%)`;
        titulo.style.webkitBackgroundClip = 'text';
        titulo.style.backgroundClip = 'text';
        titulo.style.filter = `
            drop-shadow( 3px  0   0 #000) drop-shadow(-3px  0   0 #000)
            drop-shadow( 0    3px 0 #000) drop-shadow( 0   -3px 0 #000)
            drop-shadow( 3px  3px 0 #000) drop-shadow(-3px  3px 0 #000)
            drop-shadow( 0    8px 0 rgba(0,0,0,0.85))`;
        titulo.style.animation = 'anidiaShimmer 4s steps(4, end) infinite, anidiaTituloBob 2.6s ease-in-out infinite';

        // Ornatos dourados/bronze (combina com outline #a06020)
        const gold = '#a06020';
        ornaTop.style.background = `linear-gradient(90deg, transparent, ${gold} 40%, #ffe0a0 50%, ${gold} 60%, transparent)`;
        ornaTop.style.boxShadow = `0 0 8px rgba(160,96,32,0.7)`;
        ornaBot.style.background = `linear-gradient(90deg, transparent, ${gold} 40%, #ffe0a0 50%, ${gold} 60%, transparent)`;
        ornaBot.style.boxShadow = `0 0 8px rgba(160,96,32,0.7)`;
    }
}

pillDia.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_modoNocturno) {
        _modoNocturno = false;
        setSetting('nightMode', false);
        _refrescarPills();
    }
});
pillNoite.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_modoNocturno) {
        _modoNocturno = true;
        setSetting('nightMode', true);
        _refrescarPills();
    }
});

btnNovoJogo.addEventListener('click', (e) => { e.stopPropagation(); iniciar(); });
btnConfig  .addEventListener('click', (e) => { e.stopPropagation(); abrirConfig(); });
btnCreditos.addEventListener('click', (e) => { e.stopPropagation(); abrirCreditos(); });

// rodapé
const foot = document.createElement('div');
foot.style.cssText = `
    position: absolute; bottom: 22px; left: 0; right: 0;
    text-align: center;
    font-size: 8px; color: #5a4a18;
    letter-spacing: 3px; line-height: 1.8;
    font-family: 'Press Start 2P', monospace;
    text-shadow: 1px 1px 0 #000;
    pointer-events: none;
`;
foot.innerHTML = `DESENVOLVIDO POR ALEXANDRE PEREIRA  ·  FRANCISCO MONTEIRO  ·  JOÃO GUEDES<br>PROJECTO WEBGL  ·  THREE.JS`;
overlay.appendChild(foot);

// indicador de versão (para teste de performance)
const version = document.createElement('div');
version.style.cssText = `
    position: absolute; top: 10px; right: 12px;
    font-size: 14px; color: #5a3d12; opacity: 0.85;
    letter-spacing: 1px;
    font-family: 'VT323', monospace; pointer-events: none; z-index: 300;
`;
version.textContent = 'v1.10-perf-fix';
overlay.appendChild(version);

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
/* bob lento — sobe e desce como o título da concept (Math.sin(t*1.2)) */
@keyframes anidiaTituloBob {
    0%, 100% { transform: translateY(-3px); }
    50%      { transform: translateY( 3px); }
}
/* corrupção pixel — chromatic split + slice shifts ocasionais */
@keyframes anidiaTituloGlitch {
    0%, 6%, 22%, 100% {
        transform: translate(0,0);
        clip-path: none;
    }
    7%  { transform: translate(-4px, 0) skewX(-2deg); }
    9%  { transform: translate( 4px, 1px) skewX( 2deg); clip-path: inset(20% 0 55% 0); }
    11% { transform: translate(-2px,-2px); clip-path: inset(60% 0 10% 0); }
    13% { transform: translate( 0, 0); clip-path: none; }
    52% { transform: translate( 3px, 0); clip-path: inset(40% 0 40% 0); }
    54% { transform: translate(-3px, 0); }
    56% { transform: translate( 0, 0); clip-path: none; }
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
    // Pára o RAF assim que a tela inicial fecha E as últimas partículas
    // desaparecem. Antes o loop corria para sempre — clearRect num canvas
    // fullscreen todos os frames a queimar ~0.5-1ms em GPUs integradas.
    if (!_ativa && particulas.length === 0) return;
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

// Escolha "Teclado vs Comando" com 2 botões grandes (ícone + label),
// estilo igual ao modal inicial. Mais óbvio que um segmented control.
function _inputChoice(selectedIdx, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:flex;gap:8px;`;

    const opts = [
        { icon: '⌨', label: 'Teclado' },
        { icon: '🎮', label: 'Comando' },
    ];

    const btns = [];
    const paint = (i) => {
        btns.forEach((b, j) => {
            const sel = j === i;
            b.style.background  = sel ? 'rgba(212,168,48,0.18)' : 'rgba(40,28,12,0.5)';
            b.style.borderColor = sel ? '#d4a830' : 'rgba(176,120,64,0.5)';
            b.style.color       = sel ? '#ffe9a0' : '#a08060';
            b.style.boxShadow   = sel ? '0 0 14px rgba(212,168,48,0.35), inset 0 0 12px rgba(212,168,48,0.15)' : 'none';
        });
    };

    opts.forEach((opt, i) => {
        const b = document.createElement('button');
        b.style.cssText = `
            flex:1; min-width:0;
            padding: 8px 10px;
            border: 1.5px solid rgba(176,120,64,0.5);
            border-radius: 6px;
            background: rgba(40,28,12,0.5);
            color: #a08060;
            font-family: inherit;
            cursor: pointer;
            display:flex; align-items:center; justify-content:center; gap:8px;
            transition: background .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease;
        `;
        b.innerHTML = `<span style="font-size:18px;">${opt.icon}</span><span style="font-size:11px;letter-spacing:2px;">${opt.label.toUpperCase()}</span>`;
        b.onclick = () => { paint(i); onChange(i); };
        btns.push(b);
        wrap.appendChild(b);
    });
    paint(selectedIdx);
    return wrap;
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
        const rInput = _row('Método de Comando');
        rInput.appendChild(_inputChoice(
            settings.inputMethod === 'gamepad' ? 1 : 0,
            (i) => setSetting('inputMethod', i === 0 ? 'keyboard' : 'gamepad'),
        ));
        body.appendChild(rInput);

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
    // Primeira vez: pergunta método de input ANTES de o jogador interagir
    // com o menu da tela inicial. A escolha fica gravada e pode ser trocada
    // em Ajustes a qualquer momento.
    if (!settings.inputAsked) {
        _inputModalAberto = true;
        // Pequeno delay para o modal aparecer já depois do splash começar a
        // desvanecer-se (melhor estética que sobrepor instantaneamente).
        setTimeout(() => {
            _abrirInputModal(() => { _inputModalAberto = false; });
        }, 400);
    }
});

// --------------------------------------------------------
// API
// --------------------------------------------------------
export function isTelaInicialAberta() { return _ativa; }
export function onTelaInicialFechar(fn) { _onIniciar = fn; }

// O modal de escolha de input é aberto na primeira interacção (splash click),
// antes do menu da tela inicial. Aqui apenas bloqueamos "Nova Jornada"
// enquanto ele estiver visível.
let _inputModalAberto = false;
function iniciar() {
    if (!_ativa) return;
    if (_inputModalAberto) return; // não deixa entrar enquanto o modal está aberto
    _fecharTelaInicial();
}

function _fecharTelaInicial() {
    if (!_ativa) return;
    _ativa = false;
    overlay.style.opacity = '0';
    overlay.style.transform = 'scale(1.04)';
    document.body.classList.remove('title-screen-active');
    setTimeout(() => {
        overlay.style.display = 'none';
        // Liberta o canvas das partículas — o RAF já parou (ver _tickParticulas)
        // quando o array esvaziou, mas garantimos que o canvas não fica a
        // ocupar layer no compositor.
        partCanvas.style.display = 'none';
    }, 900);
    if (_onIniciar) { try { _onIniciar(); } catch (e) { console.error(e); } }
}

// Modal "Teclado vs Comando" — só mostra na primeira vez (controlado por
// settings.inputAsked). Depois pode-se trocar livremente em Ajustes.
function _abrirInputModal(onConfirm) {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed; inset: 0; z-index: 450;
        background: rgba(8,4,16,0.78);
        backdrop-filter: blur(8px);
        display:flex; align-items:center; justify-content:center;
        opacity: 0; transition: opacity .35s ease;
        font-family: 'Press Start 2P', monospace;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
        background: linear-gradient(180deg, #1a1206 0%, #0d0904 100%);
        border: 2px solid #d4a830;
        border-radius: 8px;
        padding: 32px 40px;
        max-width: 540px; width: 86vw;
        box-shadow: 0 0 40px rgba(212,168,48,0.35), inset 0 0 30px rgba(80,40,10,0.4);
        text-align: center;
        transform: translateY(20px); transition: transform .35s ease;
    `;
    panel.innerHTML = `
        <div style="font-size:14px;color:#d4a830;letter-spacing:4px;margin-bottom:18px;">⚔  ESCOLHEI A VOSSA ARMA  ⚔</div>
        <div style="font-size:11px;color:#c8a96e;letter-spacing:1px;line-height:1.7;margin-bottom:28px;font-family:'Courier New',monospace;">
            Como pretendeis comandar o herói nesta jornada?<br>
            (Podereis trocar mais tarde em Ajustes)
        </div>
        <div id="input-modal-btns" style="display:flex;gap:18px;justify-content:center;"></div>
    `;
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    const btns = panel.querySelector('#input-modal-btns');
    const mkBtn = (label, sub, value) => {
        const b = document.createElement('button');
        b.style.cssText = `
            background: rgba(60,40,12,0.7);
            border: 1.5px solid #b07840;
            color: #f0d9a8;
            padding: 18px 26px;
            cursor: pointer;
            font-family: 'Press Start 2P', monospace;
            font-size: 11px;
            letter-spacing: 2px;
            border-radius: 6px;
            transition: transform .15s ease, background .15s ease, border-color .15s ease;
            min-width: 160px;
        `;
        b.innerHTML = `<div style="font-size:24px;margin-bottom:8px;">${sub}</div>${label}`;
        b.onmouseenter = () => { b.style.background = 'rgba(110,70,20,0.85)'; b.style.borderColor = '#d4a830'; b.style.transform = 'translateY(-2px)'; };
        b.onmouseleave = () => { b.style.background = 'rgba(60,40,12,0.7)'; b.style.borderColor = '#b07840'; b.style.transform = ''; };
        b.onclick = () => {
            setSetting('inputMethod', value);
            setSetting('inputAsked', true);
            backdrop.style.opacity = '0';
            panel.style.transform = 'translateY(20px)';
            setTimeout(() => { backdrop.remove(); onConfirm?.(); }, 350);
        };
        return b;
    };
    btns.appendChild(mkBtn('TECLADO',  '⌨',  'keyboard'));
    btns.appendChild(mkBtn('COMANDO',  '🎮', 'gamepad'));

    requestAnimationFrame(() => {
        backdrop.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
    });
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

_refrescarPills(); // Garantir que o estado inicial (dia/noite) é aplicado ao texto do topo

overlay.style.cursor = 'default';
