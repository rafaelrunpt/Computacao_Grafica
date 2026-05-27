// Glyphs de input — devolve HTML inline para representar uma tecla
// (modo teclado) ou um botão de comando (modo PlayStation). O resto da
// UI chama estes helpers para que prompts e legendas se adaptem
// automaticamente conforme `settings.inputMethod`.

import { settings } from '../systems/settings.js';

// ---- CSS injectado uma vez ----
const STYLE_ID = 'input-glyphs-css';
function _ensureCss() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
        .ig-key {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 1.4em; padding: 1px 6px; height: 1.5em;
            border: 1.5px solid rgba(212,168,48,0.85);
            border-bottom-width: 3px;
            border-radius: 4px;
            background: rgba(40,28,12,0.85);
            color: #ffe9a0;
            font-family: 'Courier New', monospace;
            font-size: 0.85em; font-weight: bold;
            letter-spacing: 1px; line-height: 1;
            box-shadow: 0 2px 0 rgba(0,0,0,0.4);
            vertical-align: middle;
        }
        .ig-ps {
            display: inline-flex; align-items: center; justify-content: center;
            width: 1.7em; height: 1.7em;
            border-radius: 50%;
            background: #1a1a26;
            color: #fff;
            font-size: 0.95em; font-weight: bold;
            box-shadow: 0 0 0 1.5px #2a2a3a, 0 2px 4px rgba(0,0,0,0.5);
            vertical-align: middle;
            line-height: 1;
        }
        .ig-ps-cross    { color: #4f9cff; }   /* azul */
        .ig-ps-circle   { color: #ff5757; }   /* vermelho */
        .ig-ps-square   { color: #f06bc0; }   /* rosa */
        .ig-ps-triangle { color: #4fe3a2; }   /* verde */
        .ig-ps-shoulder, .ig-ps-meta {
            border-radius: 6px;
            min-width: 2em; width: auto;
            padding: 0 6px;
            font-size: 0.72em; letter-spacing: 1px;
            color: #ffe9a0;
            background: #1a1a26;
        }
        .ig-ps-dpad {
            border-radius: 4px;
            min-width: 2em;
            font-size: 0.85em;
            background: #1a1a26;
            color: #cfd8e6;
        }
        .ig-stick { font-style: italic; }

        /* Foco do gamepad — partilhado por combate, diálogos e lojas */
        .gp-focus {
            outline: 2.5px solid #ffe9a0 !important;
            outline-offset: 2px;
            box-shadow:
                0 0 0 2px rgba(212,168,48,0.4),
                0 0 18px rgba(240,192,96,0.6),
                inset 0 0 14px rgba(240,192,96,0.25) !important;
            position: relative;
            z-index: 2;
            animation: gp-focus-pulse 1.1s ease-in-out infinite;
        }
        @keyframes gp-focus-pulse {
            0%, 100% { filter: brightness(1); }
            50%      { filter: brightness(1.15); }
        }
    `;
    document.head.appendChild(s);
}
_ensureCss();

export function isGamepadMode() {
    return settings.inputMethod === 'gamepad';
}

// Glyph teclado (uma tecla específica)
export function kbGlyph(label) {
    return `<span class="ig-key">${label.toUpperCase()}</span>`;
}

// Glyph PS para um botão Standard Gamepad
// Aceita: 'cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'options',
//         'share', 'dpad', 'lstick', 'rstick'
export function psGlyph(button) {
    switch (button) {
        case 'cross':    return `<span class="ig-ps ig-ps-cross">✕</span>`;
        case 'circle':   return `<span class="ig-ps ig-ps-circle">○</span>`;
        case 'square':   return `<span class="ig-ps ig-ps-square">▢</span>`;
        case 'triangle': return `<span class="ig-ps ig-ps-triangle">△</span>`;
        case 'l1':       return `<span class="ig-ps ig-ps-shoulder">L1</span>`;
        case 'r1':       return `<span class="ig-ps ig-ps-shoulder">R1</span>`;
        case 'l2':       return `<span class="ig-ps ig-ps-shoulder">L2</span>`;
        case 'r2':       return `<span class="ig-ps ig-ps-shoulder">R2</span>`;
        case 'options':  return `<span class="ig-ps ig-ps-meta">OPTIONS</span>`;
        case 'share':    return `<span class="ig-ps ig-ps-meta">SHARE</span>`;
        case 'dpad':     return `<span class="ig-ps ig-ps-dpad">✛</span>`;
        case 'lstick':   return `<span class="ig-ps ig-ps-meta ig-stick">L STICK</span>`;
        case 'rstick':   return `<span class="ig-ps ig-ps-meta ig-stick">R STICK</span>`;
        default:         return `<span class="ig-ps">?</span>`;
    }
}

// Mapeamento da tecla lógica do jogo → botão PS correspondente.
// Tem de bater certo com o que o gamepad.js faz no _edge().
const _PS_FOR_KEY = {
    e: 'cross',
    esc: 'circle',
    escape: 'circle',
    i: 'triangle',
    b: 'square',
    v: 'l1',
    m: 'r1',
    n: 'share',
    p: 'options',
    wasd: 'lstick',
    w: 'lstick',
    a: 'lstick',
    s: 'lstick',
    d: 'lstick',
};

// Glyph contextual: devolve HTML do botão atual conforme inputMethod.
// `key` pode ser 'e', 'esc', 'i', etc., ou um label arbitrário (que devolve
// o glyph de teclado tal-qual).
export function keyGlyph(key) {
    const k = String(key).toLowerCase();
    if (isGamepadMode()) {
        const ps = _PS_FOR_KEY[k];
        if (ps) return psGlyph(ps);
    }
    return kbGlyph(key);
}

// Devolve glyph para teclado E gamepad lado a lado (usado no menu de
// Controlos, onde queremos mostrar ambos simultaneamente).
export function dualGlyph(key) {
    const k = String(key).toLowerCase();
    const ps = _PS_FOR_KEY[k];
    return `${kbGlyph(key)} ${ps ? psGlyph(ps) : ''}`.trim();
}

// Substitui o prefixo "K — " ou "[K] — " no início de uma mensagem
// (ex.: "E — Adentrar a Loja") por um glyph contextual. Se não houver
// padrão reconhecível, devolve a string original sem alterações.
const _PROMPT_RE = /^(?:\[)?([A-Za-zÀ-ÿ]{1,4})(?:\])?\s*[—–\-]\s*/;
export function formatPrompt(msg) {
    if (typeof msg !== 'string') return msg;
    const m = msg.match(_PROMPT_RE);
    if (!m) return msg;
    const key = m[1];
    const rest = msg.slice(m[0].length);
    return `${keyGlyph(key)} <span style="margin-left:6px;">${rest}</span>`;
}
