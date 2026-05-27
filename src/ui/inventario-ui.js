// --------------------------------------------------------
// UI DE ALFORGE — versão pixel art (Press Start 2P + VT323)
// --------------------------------------------------------
// Abre com I, fecha com I ou Escape. Mantém a API anterior:
//   isInventarioAberto, bloquearInventario,
//   abrirInventario, fecharInventario
// --------------------------------------------------------

import { getItens, usarItem, registarOnChange, CATALOGO } from '../systems/inventario.js';
import { playerStats } from '../systems/player-stats.js';
import { atualizarHUD } from './hud.js';

let _aberto = false;
let _bloqueado = false;

export function isInventarioAberto() { return _aberto; }
export function bloquearInventario(b) {
    _bloqueado = b;
    if (b && _aberto) fecharInventario();
}

// ---- fontes e estilos globais (uma só vez) ----
(function carregarRecursos() {
    if (!document.getElementById('alforge-pixel-fonts')) {
        const link = document.createElement('link');
        link.id = 'alforge-pixel-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
        document.head.appendChild(link);
    }
    if (document.getElementById('alforge-pixel-styles')) return;
    const style = document.createElement('style');
    style.id = 'alforge-pixel-styles';
    style.textContent = `
        #alforge-overlay {
            --bg-0:#0b0906; --panel-1:#3a2614; --panel-2:#2a1c0e; --panel-3:#1f150a;
            --card-1:#3f2a17; --card-2:#2a1a0c;
            --gold-hi:#ffd86b; --gold-0:#f0b73a; --gold-1:#c98a22; --gold-2:#7a4d12; --gold-3:#4a2f08;
            --text:#fff0c4; --text-dim:#caa463; --text-faint:#8a6b34;
            --green:#7ad28a; --green-glow:rgba(122,210,138,.35);
            --rust:#a83a26; --shadow:#0a0704;
            position: fixed; inset: 0;
            display: none; align-items: center; justify-content: center;
            background: radial-gradient(ellipse at center, rgba(20,16,10,.55) 0%, rgba(0,0,0,.85) 100%);
            z-index: 70; padding: 30px;
            font-family: 'VT323', monospace; color: var(--text);
        }
        #alforge-overlay, #alforge-overlay * {
            image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;
            box-sizing: border-box;
        }
        #alforge-overlay .alforge {
            position: relative; width: 760px; max-width: 100%; max-height: 92vh;
            display: flex; flex-direction: column;
            background: linear-gradient(180deg, var(--panel-1) 0%, var(--panel-2) 50%, var(--panel-3) 100%);
            border: 28px solid transparent;
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' shape-rendering='crispEdges'><path fill='%23020405' d='M3,0h10v1h-10z M2,1h1v1h-1z M13,1h1v1h-1z M1,2h1v1h-1z M14,2h1v1h-1z M0,3h1v10h-1z M15,3h1v10h-1z M1,13h1v1h-1z M14,13h1v1h-1z M2,14h1v1h-1z M13,14h1v1h-1z M3,15h10v1h-10z'/><path fill='%230a2a2a' d='M3,1h10v1h-10z M2,2h12v1h-12z M1,3h1v10h-1z M14,3h1v10h-1z M2,13h12v1h-12z M3,14h10v1h-10z M4,4h8v1h-8z M4,5h1v6h-1z M11,5h1v6h-1z M4,11h8v1h-8z'/><path fill='%23154848' d='M3,2h10v1h-10z M2,3h1v10h-1z M13,3h1v10h-1z M3,13h10v1h-10z M5,4h6v1h-6z M5,5h1v6h-1z M10,5h1v6h-1z M5,11h6v1h-6z'/><path fill='%23266a68' d='M3,3h1v1h-1z M12,3h1v1h-1z M3,12h1v1h-1z M12,12h1v1h-1z M5,4h1v1h-1z M10,4h1v1h-1z M5,11h1v1h-1z M10,11h1v1h-1z'/></svg>") 5 / 28px / 0 round;
            box-shadow: 0 0 0 4px #020405, 0 0 50px 14px rgba(21,72,72,.25);
            padding: 24px 22px 18px;
        }
        #alforge-overlay .header {
            display: flex; align-items: center; justify-content: center; gap: 18px; padding: 6px 0 10px;
        }
        #alforge-overlay .title {
            font-family: 'Press Start 2P', monospace; font-size: 28px; letter-spacing: 6px;
            color: #266a68;
            text-shadow: 0 3px 0 #0a2a2a, 0 4px 0 #020405, 0 0 12px rgba(38,106,104,.5);
            margin: 0;
        }
        #alforge-overlay .divider {
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--gold-1) 18%, var(--gold-hi) 50%, var(--gold-1) 82%, transparent);
            margin: 6px 4px 12px;
        }
        #alforge-overlay .subtitle {
            text-align: center; font-family: 'Press Start 2P', monospace; font-size: 10px;
            letter-spacing: 2px; color: var(--text-dim); margin: 0 0 14px;
        }
        #alforge-overlay .subtitle kbd {
            background: none; color: var(--gold-hi); padding: 0 2px; font: inherit;
        }
        #alforge-overlay .list-wrap { position: relative; flex: 1; min-height: 0; display: flex; }
        #alforge-overlay .list {
            flex: 1; overflow-y: scroll; overflow-x: hidden;
            padding: 4px 14px 4px 2px;
            display: flex; flex-direction: column; gap: 10px;
            scrollbar-width: thin; scrollbar-color: var(--gold-1) var(--panel-3);
        }
        #alforge-overlay .list::-webkit-scrollbar { width: 14px; }
        #alforge-overlay .list::-webkit-scrollbar-track {
            background: linear-gradient(90deg, #0a0704 0 2px, #1f150a 2px 12px, #0a0704 12px 14px);
        }
        #alforge-overlay .list::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, var(--gold-hi) 0 3px, var(--gold-0) 3px 50%, var(--gold-1) 50% 90%, var(--gold-2) 90% 100%);
            border: 2px solid #0a0704;
            box-shadow: inset 0 0 0 1px var(--gold-3);
            background-clip: padding-box;
        }
        #alforge-overlay .list::-webkit-scrollbar-thumb:hover { filter: brightness(1.15); }
        #alforge-overlay .list::-webkit-scrollbar-button { display: none; }
        #alforge-overlay .item {
            position: relative; display: grid;
            grid-template-columns: 72px 1fr auto;
            align-items: center; gap: 18px; padding: 16px 18px;
            background:
                /* dithered checker overlay for pixel texture */
                repeating-conic-gradient(rgba(255,216,107,.04) 0% 25%, transparent 0% 50%) 0 0 / 4px 4px,
                linear-gradient(180deg, var(--card-1) 0%, var(--card-2) 100%);
            /* chunky stepped pixel frame: outer black notch + gold ring + dark inner */
            border: 14px solid transparent;
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' shape-rendering='crispEdges'><path fill='%230a0704' d='M2,0h10v1h-10z M1,1h1v1h-1z M12,1h1v1h-1z M0,2h1v10h-1z M13,2h1v10h-1z M1,12h1v1h-1z M12,12h1v1h-1z M2,13h10v1h-10z'/><path fill='%237a4d12' d='M2,1h10v1h-10z M1,2h1v10h-1z M12,2h1v10h-1z M2,12h10v1h-10z'/><path fill='%23c98a22' d='M3,2h8v1h-8z M2,3h1v8h-1z M11,3h1v8h-1z M3,11h8v1h-8z'/><path fill='%23ffd86b' d='M3,3h8v1h-8z M3,3h1v8h-1z M10,3h1v8h-1z M3,10h8v1h-8z M2,2h1v1h-1z M11,2h1v1h-1z M2,11h1v1h-1z M11,11h1v1h-1z'/><path fill='%234a2f08' d='M4,4h6v1h-6z M4,4h1v6h-1z M9,4h1v6h-1z M4,9h6v1h-6z'/></svg>") 4 / 14px / 0 round;
            box-shadow: 0 4px 0 #0a0704, inset 0 0 0 2px rgba(10,7,4,.4);
            transition: filter .1s steps(2), transform .1s steps(2);
            cursor: pointer; text-align: left; color: inherit; font: inherit;
            image-rendering: pixelated;
        }
        #alforge-overlay .item::before,
        #alforge-overlay .item::after {
            content: ""; position: absolute; width: 6px; height: 6px;
            background: var(--gold-hi);
            box-shadow:
                0 0 0 2px #0a0704,
                inset -2px -2px 0 var(--gold-2);
            pointer-events: none; z-index: 2;
        }
        #alforge-overlay .item::before { top: -3px; left: -3px; }
        #alforge-overlay .item::after  { top: -3px; right: -3px; }
        #alforge-overlay .item .stud-bl,
        #alforge-overlay .item .stud-br {
            position: absolute; width: 6px; height: 6px;
            background: var(--gold-hi);
            box-shadow: 0 0 0 2px #0a0704, inset -2px -2px 0 var(--gold-2);
            pointer-events: none; z-index: 2;
        }
        #alforge-overlay .item .stud-bl { bottom: -3px; left: -3px; }
        #alforge-overlay .item .stud-br { bottom: -3px; right: -3px; }
        #alforge-overlay .item:hover { filter: brightness(1.12); }
        #alforge-overlay .item:active { transform: translateY(2px); box-shadow: 0 0 0 #0a0704, inset 0 0 0 2px rgba(10,7,4,.4); }
        #alforge-overlay .icon {
            width: 64px; height: 64px;
            background:
                repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 2px),
                #1a0e06;
            border: 8px solid transparent;
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' shape-rendering='crispEdges'><path fill='%230a0704' d='M1,0h8v1h-8z M0,1h1v1h-1z M9,1h1v1h-1z M0,8h1v1h-1z M9,8h1v1h-1z M1,9h8v1h-8z M0,2h1v6h-1z M9,2h1v6h-1z'/><path fill='%237a4d12' d='M1,1h8v1h-8z M1,8h8v1h-8z M1,2h1v6h-1z M8,2h1v6h-1z'/><path fill='%23c98a22' d='M2,2h6v1h-6z M2,7h6v1h-6z M2,2h1v6h-1z M7,2h1v6h-1z'/><path fill='%23ffd86b' d='M2,2h1v1h-1z M7,2h1v1h-1z M2,7h1v1h-1z M7,7h1v1h-1z'/></svg>") 3 / 8px / 0 round;
            display: grid; place-items: center;
            box-shadow: inset 0 0 0 1px #000, inset 0 0 8px rgba(0,0,0,.8);
        }
        #alforge-overlay .icon img, #alforge-overlay .icon svg {
            width: 42px; height: 42px; object-fit: contain;
        }
        #alforge-overlay .icon .icon-fallback {
            font-family: 'Press Start 2P', monospace; font-size: 24px; color: var(--gold-hi);
            text-shadow: 0 2px 0 var(--shadow);
        }
        #alforge-overlay .text { min-width: 0; }
        #alforge-overlay .name {
            font-family: 'Press Start 2P', monospace; font-size: 14px;
            color: var(--gold-hi);
            text-shadow: 0 2px 0 var(--gold-3), 0 3px 0 var(--shadow);
            margin: 0 0 4px; letter-spacing: 1px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        #alforge-overlay .desc {
            font-family: 'VT323', monospace; font-size: 17px;
            color: var(--text-dim); font-style: italic;
            margin: 0; line-height: 1.15;
        }
        #alforge-overlay .qty {
            font-family: 'Press Start 2P', monospace; font-size: 13px;
            color: var(--gold-hi); padding: 10px 14px;
            background:
                repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 2px),
                var(--panel-3);
            border: 8px solid transparent;
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' shape-rendering='crispEdges'><path fill='%230a0704' d='M1,0h8v1h-8z M0,1h1v1h-1z M9,1h1v1h-1z M0,8h1v1h-1z M9,8h1v1h-1z M1,9h8v1h-8z M0,2h1v6h-1z M9,2h1v6h-1z'/><path fill='%237a4d12' d='M1,1h8v1h-8z M1,8h8v1h-8z M1,2h1v6h-1z M8,2h1v6h-1z'/><path fill='%23c98a22' d='M2,2h6v1h-6z M2,7h6v1h-6z M2,2h1v6h-1z M7,2h1v6h-1z'/></svg>") 3 / 8px / 0 round;
            text-shadow: 0 2px 0 var(--shadow);
            box-shadow: 0 3px 0 #0a0704, inset 0 0 0 1px #000;
        }
        #alforge-overlay .btn-equip {
            font-family: 'Press Start 2P', monospace; font-size: 12px;
            color: var(--gold-hi); padding: 12px 18px;
            background:
                repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 2px),
                linear-gradient(180deg, #5a3a18 0%, #3a2410 100%);
            border: 10px solid transparent;
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' shape-rendering='crispEdges'><path fill='%230a0704' d='M2,0h8v1h-8z M1,1h1v1h-1z M10,1h1v1h-1z M0,2h1v8h-1z M11,2h1v8h-1z M1,10h1v1h-1z M10,10h1v1h-1z M2,11h8v1h-8z'/><path fill='%237a4d12' d='M2,1h8v1h-8z M1,2h1v8h-1z M10,2h1v8h-1z M2,10h8v1h-8z'/><path fill='%23c98a22' d='M3,2h6v1h-6z M2,3h1v6h-1z M9,3h1v6h-1z M3,9h6v1h-6z'/><path fill='%23ffd86b' d='M3,3h6v1h-6z M3,3h1v6h-1z M8,3h1v6h-1z M3,8h6v1h-6z M2,2h1v1h-1z M9,2h1v1h-1z M2,9h1v1h-1z M9,9h1v1h-1z'/></svg>") 4 / 10px / 0 round;
            cursor: pointer; text-shadow: 0 2px 0 var(--shadow);
            letter-spacing: 2px;
            box-shadow: 0 4px 0 #0a0704;
            transition: transform .08s steps(2), filter .08s steps(2), box-shadow .08s steps(2);
        }
        #alforge-overlay .btn-equip:active { transform: translateY(3px); box-shadow: 0 1px 0 #0a0704; }
        #alforge-overlay .btn-equip:hover { filter: brightness(1.18); transform: scale(1.04); }
        #alforge-overlay .btn-equip:active { transform: scale(.9); filter: brightness(.8); }
        #alforge-overlay .btn-equip.equipado {
            color: var(--green);
            background: linear-gradient(180deg, #1f3a20 0%, #122810 100%);
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' shape-rendering='crispEdges'><path fill='%230a0704' d='M0,0h8v1h-8z M0,7h8v1h-8z M0,1h1v6h-1z M7,1h1v6h-1z'/><path fill='%237ad28a' d='M1,1h6v1h-6z M1,2h1v4h-1z M6,2h1v4h-1z M1,6h6v1h-6z'/></svg>") 2 / 6px / 0 round;
            text-shadow: 0 0 8px var(--green-glow), 0 2px 0 var(--shadow);
        }
        #alforge-overlay .footer {
            margin-top: 14px; padding-top: 12px;
            border-top: 3px double var(--gold-2); text-align: center;
        }
        #alforge-overlay .flash {
            font-family: 'VT323', monospace; font-size: 22px;
            color: var(--green); text-shadow: 0 0 8px var(--green-glow);
            margin: 0 0 6px; min-height: 26px;
        }
        #alforge-overlay .flash.erro { color: #ff8a7a; text-shadow: 0 0 8px rgba(255,80,60,.4); }
        #alforge-overlay .hp {
            font-family: 'Press Start 2P', monospace; font-size: 13px;
            color: var(--rust); letter-spacing: 3px;
            text-shadow: 0 2px 0 #2a0d08; margin: 6px 0 0;
        }
        #alforge-overlay .vazio {
            text-align: center; color: var(--text-faint); font-style: italic;
            padding: 30px 10px; font-size: 22px;
        }
    `;
    document.head.appendChild(style);
})();

// ---- estrutura base ----
const overlay = document.createElement('div');
overlay.id = 'alforge-overlay';
overlay.innerHTML = `
    <div class="alforge">
        <div class="header"><h1 class="title">ALFORGE</h1></div>
        <div class="divider"></div>
        <p class="subtitle">Tocai num objecto para o usar &mdash; <kbd>I</kbd>/<kbd>ESC</kbd> para fechar</p>
        <div class="list-wrap"><div class="list" id="alforge-list"></div></div>
        <div class="footer">
            <p class="flash" id="alforge-flash"></p>
            <p class="hp" id="alforge-hp"></p>
        </div>
    </div>
`;
document.body.appendChild(overlay);

const listaEl = overlay.querySelector('#alforge-list');
const flashEl = overlay.querySelector('#alforge-flash');
const hpEl    = overlay.querySelector('#alforge-hp');

function iconHtml(item) {
    const ic = item.icone;
    if (!ic) return `<span class="icon-fallback">◆</span>`;
    if (typeof ic === 'string' && (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.includes('/'))) {
        return `<img src="${ic}" alt="">`;
    }
    return `<span class="icon-fallback">${ic}</span>`;
}

function renderItens() {
    listaEl.innerHTML = '';
    const usaveis = getItens().filter(i => i.quantidade > 0);

    if (usaveis.length === 0) {
        const v = document.createElement('div');
        v.className = 'vazio';
        v.textContent = '— o vosso alforge encontra-se vazio —';
        listaEl.appendChild(v);
        return;
    }

    for (const item of usaveis) {
        const equipavel = item.efeito && item.efeito.tipo === 'equipar';
        const equipado  = equipavel && playerStats.equipped[item.efeito.slot] === item.id;

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'item';
        row.innerHTML = `
            <span class="stud-bl"></span><span class="stud-br"></span>
            <div class="icon">${iconHtml(item)}</div>
            <div class="text">
                <h2 class="name">${item.nome}</h2>
                <p class="desc">${item.descricao || ''}</p>
            </div>
            ${equipavel
                ? `<button type="button" class="btn-equip${equipado ? ' equipado' : ''}">${equipado ? 'EQUIPADO' : 'EQUIPAR'}</button>`
                : `<div class="qty">x${item.quantidade}</div>`}
        `;

        const handleUse = (e) => {
            if (e) e.stopPropagation();
            const r = usarItem(item.id);
            flashEl.textContent = r.mensagem || '';
            flashEl.classList.toggle('erro', !r.ok);
            renderItens();
            atualizarHUD();
            renderHp();

            const btn = row.querySelector('.btn-equip');
            if (btn) {
                btn.animate(
                    [
                        { transform: 'scale(1)',    filter: 'brightness(1)' },
                        { transform: 'scale(0.85)', filter: 'brightness(.78)', offset: .45 },
                        { transform: 'scale(1.05)', filter: 'brightness(1.2)', offset: .75 },
                        { transform: 'scale(1)',    filter: 'brightness(1)' }
                    ],
                    { duration: 260, easing: 'cubic-bezier(.2,.7,.3,1)' }
                );
            }
        };

        row.addEventListener('click', handleUse);
        const equipBtn = row.querySelector('.btn-equip');
        if (equipBtn) equipBtn.addEventListener('click', handleUse);

        listaEl.appendChild(row);
    }
}

function renderHp() {
    hpEl.textContent = `HP ${playerStats.hp} / ${playerStats.maxHp}` +
        (playerStats.derrotado ? '  ⟡ A RECUPERAR ⟡' : '');
}

registarOnChange(() => { if (_aberto) renderItens(); });

export function abrirInventario() {
    if (_bloqueado || _aberto) return;
    _aberto = true;
    flashEl.textContent = '';
    flashEl.classList.remove('erro');
    renderItens();
    renderHp();
    overlay.style.display = 'flex';
}

export function fecharInventario() {
    _aberto = false;
    overlay.style.display = 'none';
}

overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fecharInventario();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _aberto) {
        e.stopPropagation();
        fecharInventario();
    }
});
