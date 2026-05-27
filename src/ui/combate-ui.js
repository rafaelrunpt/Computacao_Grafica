// --------------------------------------------------------
// UI DE COMBATE — versão pixel / dark fantasy retro
// --------------------------------------------------------
// Mantém EXACTAMENTE a mesma API exportada da versão original:
//   mostrarCombateUI, esconderCombateUI,
//   setHpInimigo, setHpPlayer,
//   setLog, setPresagio, setStatusPlayer,
//   setAtaqueSlots, setBotoesAtivos, preencherItens,
//   setCombateHandlers, mostrarDanoFlutuante,
//   KEY_LABELS_ACCAO, KEY_LABELS_SLOT, KEY_LABELS_ITEM
//
// Mudanças puramente estéticas:
//   • Tipografia "Pixelify Sans" (auto-carregada) + image-rendering pixel
//   • Paleta dark fantasy: roxo corrompido + dourado + sangue
//   • Bordas duplas estilo Final Fantasy com cantos dourados ornamentados
//   • Hit shake & flash quando o inimigo recebe dano
//   • Damage numbers pixel-art chunky com salto + outline grosso
//   • Faíscas pixel quando atacas
//   • Screen shake em críticos (≥ ~25% do HP máx num só golpe)
// --------------------------------------------------------

// ---------- carrega fonte e regras globais uma única vez ----------
(function carregarRecursosUI() {
    if (document.getElementById('combate-ui-fontes')) return;
    const link = document.createElement('link');
    link.id = 'combate-ui-fontes';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.id = 'combate-ui-style';
    style.textContent = `
        #combate-ui, #combate-ui *,
        .pix-panel, .pix-panel *, .pix-btn, .pix-btn *, .tech-slot, .tech-slot *, .item-row, .item-row *, .item-header, .back-btn, .combate-dmg, .combate-spark
        { image-rendering: pixelated; -webkit-font-smoothing: none; font-smooth: never; }
        .pix-panel{
            background:linear-gradient(180deg, #2a0f4a 0%, #170628 100%);
            color:#f5e8c8;
            border:2px solid #d4a830;
            box-shadow:
                0 0 0 1px #0a0512,
                inset 0 0 0 1px #0a0512,
                inset 0 0 0 2px #c878f0,
                inset 0 0 0 3px #0a0512,
                0 0 22px rgba(170,68,221,0.45);
            position:relative;
            font-family:'Pixelify Sans', 'Courier New', monospace;
        }
        .pix-corner{
            position:absolute;width:10px;height:10px;
            background:
                linear-gradient(45deg, transparent 40%, #ffe080 40% 60%, transparent 60%),
                #d4a830;
            box-shadow:0 0 0 1px #0a0512;
            pointer-events:none;
        }
        .pix-corner.tl{top:-2px;left:-2px;}
        .pix-corner.tr{top:-2px;right:-2px;}
        .pix-corner.bl{bottom:-2px;left:-2px;}
        .pix-corner.br{bottom:-2px;right:-2px;}

        /* ===== CRÓNICA DE BATALHA — moldura pixel dourada chunky ===== */
        .pix-panel.combate-log-gold{
            background: linear-gradient(180deg, #2a1a08 0%, #1a0e05 100%);
            border: 10px solid transparent;
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' shape-rendering='crispEdges'><path fill='%230a0512' d='M2,0h8v1h-8z M1,1h1v1h-1z M10,1h1v1h-1z M0,2h1v8h-1z M11,2h1v8h-1z M1,10h1v1h-1z M10,10h1v1h-1z M2,11h8v1h-8z'/><path fill='%237a4d12' d='M2,1h8v1h-8z M1,2h1v8h-1z M10,2h1v8h-1z M2,10h8v1h-8z'/><path fill='%23c98a22' d='M3,2h6v1h-6z M2,3h1v6h-1z M9,3h1v6h-1z M3,9h6v1h-6z'/><path fill='%23ffd86b' d='M3,3h6v1h-6z M3,3h1v6h-1z M8,3h1v6h-1z M3,8h6v1h-6z M2,2h1v1h-1z M9,2h1v1h-1z M2,9h1v1h-1z M9,9h1v1h-1z'/><path fill='%234a2f08' d='M4,4h4v1h-4z M4,4h1v4h-1z M7,4h1v4h-1z M4,7h4v1h-4z'/></svg>") 4 / 10px / 0 round;
            box-shadow: 0 4px 0 #0a0512, 0 0 0 1px #0a0512;
        }
        .pix-panel.combate-log-gold .pix-corner{
            width:8px; height:8px;
            background: #ffd86b;
            box-shadow: 0 0 0 2px #0a0512, inset -2px -2px 0 #7a4d12;
        }
        .pix-panel.combate-log-gold #log-content{
            font-family: 'Pixelify Sans', 'Press Start 2P', monospace;
        }

        .hp-rail{
            height:14px;background:#0a0512;
            border:2px solid #0a0512;
            box-shadow:inset 0 0 0 1px #5b2d8e;
            position:relative;overflow:hidden;
        }
        .hp-rail .ticks{
            position:absolute;inset:0;
            background:repeating-linear-gradient(90deg, transparent 0 19px, rgba(0,0,0,0.55) 19px 20px);
            pointer-events:none;
        }
        .hp-fill{
            height:100%;
            transition:width 0.35s steps(20);
        }
        .hp-fill.enemy{
            background:linear-gradient(180deg,#ff80a0 0%,#ff4060 40%,#a82040 100%);
            box-shadow:inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.4), 0 0 8px #ff4060;
        }
        .hp-fill.player{
            background:linear-gradient(180deg,#8aff9a 0%,#3ac850 50%,#1a8030 100%);
            box-shadow:inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.4), 0 0 8px #3ac850;
        }

        .pix-btn{
            font-family:'Pixelify Sans', monospace;
            color:#f5e8c8;
            background:linear-gradient(180deg, #3a1560 0%, #1a0524 100%);
            border:2px solid #d4a830;
            box-shadow:
                0 0 0 1px #0a0512,
                inset 0 0 0 1px #0a0512,
                inset 0 0 0 2px #aa44dd,
                inset 0 0 0 3px #0a0512,
                0 4px 0 #0a0512,
                0 0 14px rgba(170,68,221,0.45);
            cursor:pointer;border-radius:0;
            padding:14px 8px 12px;text-align:center;
            transition:transform 0.06s steps(2), filter 0.1s;
            position:relative;
        }
        .pix-btn:hover:not(:disabled){ filter:brightness(1.25); transform:translateY(-2px); }
        .pix-btn:active:not(:disabled){ transform:translateY(2px); }
        .pix-btn:disabled{ opacity:0.45; cursor:default; filter:saturate(0.4); }
        .pix-btn.atk{ background:linear-gradient(180deg,#5a1828 0%,#2a0814 100%); border-color:#ff4060; box-shadow: 0 0 0 1px #0a0512, inset 0 0 0 1px #0a0512, inset 0 0 0 2px #a82040, inset 0 0 0 3px #0a0512, 0 4px 0 #0a0512, 0 0 14px rgba(255,64,96,0.4); }
        .pix-btn.flee{ background:linear-gradient(180deg,#1a2050 0%,#08081e 100%); border-color:#8aa8ff; box-shadow: 0 0 0 1px #0a0512, inset 0 0 0 1px #0a0512, inset 0 0 0 2px #5a7add, inset 0 0 0 3px #0a0512, 0 4px 0 #0a0512, 0 0 14px rgba(120,160,255,0.35); }
        .pix-btn .key{
            position:absolute;top:3px;left:5px;font-size:10px;color:#d4a830;letter-spacing:1px;
            text-shadow:1px 1px 0 #0a0512;
        }
        .pix-btn .label{
            font-size:18px;font-weight:700;letter-spacing:3px;color:#ffe080;
            text-shadow:2px 0 0 #0a0512,-2px 0 0 #0a0512,0 2px 0 #0a0512,0 -2px 0 #0a0512,0 0 6px rgba(240,192,96,0.6);
            display:flex;align-items:center;justify-content:center;gap:6px;
        }
        .pix-btn.atk .label{color:#ff80a0;}
        .pix-btn.flee .label{color:#c0d0ff;}
        .pix-btn .sub{
            font-size:11px;letter-spacing:2px;color:#c8a8e0;opacity:0.75;margin-top:2px;
        }

        .tech-slot{
            font-family:'Pixelify Sans', monospace;color:#f5e8c8;
            background:linear-gradient(180deg, #2a0f4a 0%, #14062a 100%);
            border:2px solid #c878f0;
            box-shadow:0 0 0 1px #0a0512, inset 0 0 0 1px #0a0512, inset 0 0 0 2px #8a6620, inset 0 0 0 3px #0a0512;
            cursor:pointer;position:relative;border-radius:0;
            padding:8px 8px 8px 10px;text-align:left;min-height:74px;
            transition:transform 0.06s steps(2), filter 0.1s;
            box-sizing:border-box;
        }
        .tech-slot:hover:not(:disabled){ filter:brightness(1.25); transform:translate(-1px,-1px); }
        .tech-slot:disabled{ opacity:0.45; cursor:default; }
        .tech-slot .key{
            position:absolute;top:3px;right:6px;font-size:10px;color:#d4a830;letter-spacing:1px;
            text-shadow:1px 1px 0 #0a0512;
        }
        .tech-slot .nm{
            font-size:14px;font-weight:700;letter-spacing:2px;color:#ffe080;
            text-shadow:1px 1px 0 #0a0512;
        }
        .tech-slot .ds{
            font-size:11px;letter-spacing:1px;color:#c8a8e0;margin-top:4px;line-height:1.25;
        }

        .item-row{
            width:100%;padding:6px 8px;
            background:#1a0524;color:#f5e8c8;
            border:2px solid #aa44dd;
            box-shadow:inset 0 0 0 1px #0a0512;
            font-family:'Pixelify Sans', monospace;font-size:12px;letter-spacing:1px;
            cursor:pointer;text-align:left;
            display:flex;justify-content:space-between;align-items:center;gap:6px;
            border-radius:0;
        }
        .item-row:hover{ background:#2a0f4a; filter:brightness(1.15); }
        .item-header{
            font-size:11px;letter-spacing:3px;text-transform:uppercase;
            color:#d4a830;opacity:0.95;margin:8px 0 4px;
            text-shadow:1px 1px 0 #0a0512;
            display:flex;align-items:center;
        }
        .back-btn{
            margin-top:8px;width:100%;
            background:#0a0512;color:#c8a8e0;
            border:2px solid #aa44dd;
            font-family:'Pixelify Sans', monospace;font-size:12px;letter-spacing:3px;padding:6px;
            cursor:pointer;text-transform:uppercase;
            box-shadow:inset 0 0 0 1px #0a0512, inset 0 0 0 2px #4a1880;
            border-radius:0;
        }
        .back-btn:hover{ background:#1a0524; color:#f5e8c8; }

        /* Sprite hit feedback (aplica-se ao body durante .combate-hit) */
        @keyframes combate-screen-shake{
            0%,100%{transform:translate(0,0)}
            10%{transform:translate(-4px,2px)} 20%{transform:translate(4px,-2px)}
            35%{transform:translate(-3px,-2px)} 50%{transform:translate(2px,3px)}
            65%{transform:translate(-2px,1px)} 80%{transform:translate(3px,-1px)}
        }
        .combate-screen-shake{ animation:combate-screen-shake 0.5s steps(6) 1 !important; }

        /* Damage numbers chunky */
        @keyframes combate-dmg-shake{
            0%, 100% { margin-left: 0; }
            25% { margin-left: -6px; }
            50% { margin-left: 6px; }
            75% { margin-left: -3px; }
        }
        @keyframes combate-dmg-jump{
            0%   { transform:translate(-50%,0) scale(0.5); opacity:0; }
            10%  { transform:translate(-50%,-15px) scale(1.15); opacity:1; }
            25%  { transform:translate(-50%,-25px) scale(1); }
            60%  { transform:translate(-50%,-45px) scale(1); opacity:1; }
            100% { transform:translate(-50%,-65px) scale(1); opacity:0; }
        }
        .combate-dmg{
            position:fixed;z-index:120;pointer-events:none;
            font-family:'Pixelify Sans', monospace;font-weight:700;
            letter-spacing:1px;
            animation:combate-dmg-jump 1.2s steps(10) forwards, combate-dmg-shake 0.15s steps(4) infinite;
        }

        /* Faíscas */
        @keyframes combate-spark-fly{
            0%{opacity:1;transform:translate(0,0) scale(1)}
            50%{opacity:1;}
            100%{opacity:0;transform:translate(var(--dx,40px), var(--dy,-40px)) scale(0.3)}
        }
        .combate-spark{
            position:fixed;z-index:115;pointer-events:none;
            box-shadow:0 0 8px currentColor, 0 0 0 1px #0a0512;
            animation:combate-spark-fly 0.7s steps(8) forwards;
        }

        /* Pisca flash */
        @keyframes combate-flash{0%{opacity:0}30%{opacity:0.7}100%{opacity:0}}
        .combate-flash{
            position:fixed;inset:0;pointer-events:none;z-index:200;
            background:rgba(255,255,255,0.4);opacity:0;
            animation:combate-flash 0.18s steps(3) forwards;
        }

        /* Hit shake aplicado a um elemento (placa do inimigo) */
        @keyframes combate-hit-shake{
            0%{transform:translateX(-50%) translate(0,0)}
            20%{transform:translateX(-50%) translate(-6px,-2px)}
            40%{transform:translateX(-50%) translate(6px,2px)}
            60%{transform:translateX(-50%) translate(-4px,0)}
            80%{transform:translateX(-50%) translate(4px,0)}
            100%{transform:translateX(-50%) translate(0,0)}
        }
        .combate-hit-flash{
            filter: brightness(2.2) saturate(0.6) hue-rotate(-15deg) !important;
        }
    `;
    document.head.appendChild(style);
})();

// --------------------------------------------------------
// CONSTRUÇÃO DA UI
// --------------------------------------------------------

const root = document.createElement('div');
root.id = 'combate-ui';
root.style.cssText = `
    position: fixed; inset: 0;
    display: none;
    pointer-events: none;
    z-index: 100;
    font-family: 'Pixelify Sans', 'Courier New', monospace;
`;
document.body.appendChild(root);

function pixCorners() {
    return `
        <div class="pix-corner tl"></div><div class="pix-corner tr"></div>
        <div class="pix-corner bl"></div><div class="pix-corner br"></div>
    `;
}

// ---- placa inimigo (topo centro) ----
const enemyPlate = document.createElement('div');
enemyPlate.className = 'pix-panel';
enemyPlate.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    padding: 10px 20px;
    width: 280px; text-align: center;
    z-index: 80; pointer-events: none;
    display: none;
`;
enemyPlate.innerHTML = `
    ${pixCorners()}
    <div style="color:#ff4060;font-size:10px;letter-spacing:5px;margin:-1px 0 3px;opacity:0.85;">☠ ⚔ ☠</div>
    <div id="combate-nome-inimigo" style="font-size:16px;font-weight:700;letter-spacing:3px;color:#ffe080;text-shadow:2px 0 0 #0a0512,-2px 0 0 #0a0512,0 2px 0 #0a0512,0 -2px 0 #0a0512;">INIMIGO</div>
    <div class="hp-rail" style="margin-top:6px;">
        <div id="combate-hp-inimigo" class="hp-fill enemy" style="width:100%;"></div>
        <div class="ticks"></div>
    </div>
    <div id="combate-hp-inimigo-label" style="font-size:11px;margin-top:3px;color:#ff80a0;letter-spacing:2px;text-shadow:1px 1px 0 #0a0512;">HP 30 / 30</div>
    <div id="combate-presagio" style="display:none;font-size:11px;margin-top:3px;color:#ffe080;text-shadow:1px 1px 0 #0a0512;"></div>
`;
document.body.appendChild(enemyPlate);

// ---- placa herói (baixo esquerda) ----
const playerPlate = document.createElement('div');
playerPlate.className = 'pix-panel';
playerPlate.style.cssText = `
    position: fixed; bottom: 120px; left: 20px;
    padding: 10px 18px;
    width: 220px;
    z-index: 81; pointer-events: none;
    display: none;
`;
playerPlate.innerHTML = `
    ${pixCorners()}
    <div id="combate-nome-player" style="font-size:14px;font-weight:700;letter-spacing:2px;color:#d4a830;
        text-shadow:2px 0 0 #0a0512,-2px 0 0 #0a0512,0 2px 0 #0a0512,0 -2px 0 #0a0512;">
        HERÓI
    </div>
    <div class="hp-rail" style="margin-top:4px;">
        <div id="combate-hp-player" class="hp-fill player" style="width:100%;"></div>
        <div class="ticks"></div>
    </div>
    <div id="combate-hp-player-label" style="font-size:11px;margin-top:3px;color:#8aff9a;letter-spacing:2px;text-shadow:1px 1px 0 #0a0512;">HP 30 / 30</div>
    <div id="combate-status-player" style="display:none;font-size:11px;margin-top:3px;color:#ffe080;text-shadow:1px 1px 0 #0a0512, 0 0 6px #cc8822;letter-spacing:1px;"></div>
`;
document.body.appendChild(playerPlate);

// ---- caixa de mensagens (log) ----
const logBox = document.createElement('div');
logBox.id = 'combate-log';
logBox.className = 'pix-panel combate-log-gold';
logBox.style.cssText = `
    position: fixed; top: 18px; right: 18px;
    padding: 10px 14px;
    width: 300px;
    max-height: 40px;
    overflow: hidden;
    color: #f5e8c8;
    font-size: 14px;
    line-height: 20px;
    pointer-events: auto;
    cursor: pointer;
    z-index: 110;
    display: none;
    transition: max-height 0.3s ease-out;
`;
logBox.innerHTML = `${pixCorners()}<div id="log-content" style="overflow:hidden;"></div>`;
document.body.appendChild(logBox);

let _logExpandido = false;
logBox.onclick = () => {
    _logExpandido = !_logExpandido;
    logBox.style.maxHeight = _logExpandido ? '300px' : '36px';
    logBox.style.overflowY = _logExpandido ? 'auto' : 'hidden';
    logBox.scrollTop = 0;
};

// ---- painel de acções ----
const actionsBar = document.createElement('div');
actionsBar.style.cssText = `
    position: fixed; bottom: 18px; right: 18px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    width: 360px;
    pointer-events: auto;
    z-index: 100;
    display: none;
`;
document.body.appendChild(actionsBar);

function makeActionBtn(label, sub, kind, keyHint) {
    const btn = document.createElement('button');
    btn.className = 'pix-btn ' + kind;
    btn.style.minHeight = '60px';
    btn.innerHTML = `
        <span class="key">[${keyHint}]</span>
        <div class="label">${label}</div>
        <div class="sub">${sub}</div>
    `;
    return btn;
}

const btnAtacar = makeActionBtn('⚔ ATAQUE', 'escolhei um golpe', 'atk', 'J/U');
const btnItens  = makeActionBtn('<img src="assets/icones/big_potion.png" style="width:18px;height:18px;vertical-align:middle;margin-right:2px;image-rendering:pixelated;"> ITENS', 'usai um objecto', 'itm', 'K/I');
const btnFugir  = makeActionBtn('💨 FUGIR', 'tentai escapar', 'flee', 'L/O');
actionsBar.append(btnAtacar, btnItens, btnFugir);

// ---- sub-painel de golpes (2x2) ----
const ataquesPanel = document.createElement('div');
ataquesPanel.className = 'pix-panel';
ataquesPanel.style.cssText = `
    position: fixed; right: 18px; bottom: 140px;
    padding: 10px 12px 12px;
    width: 360px;
    color: #f5e8c8;
    z-index: 102;
    display: none;
    pointer-events: auto;
`;
ataquesPanel.innerHTML = `
    ${pixCorners()}
    <div style="font-size:12px;font-weight:700;letter-spacing:5px;margin-bottom:6px;text-align:center;color:#d4a830;text-shadow:1px 1px 0 #0a0512, 0 0 6px rgba(240,192,96,0.4);">
        ◆ TÉCNICAS ◆
    </div>
    <div id="combate-ataques-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>
    <button id="combate-ataques-fechar" class="back-btn">↺ Retroceder</button>
`;
document.body.appendChild(ataquesPanel);

const ataquesGrid = ataquesPanel.querySelector('#combate-ataques-grid');
const btnSlots = [];
for (let i = 0; i < 4; i++) {
    const btn = document.createElement('button');
    btn.className = 'tech-slot';
    btn.dataset.slot = String(i);
    btn.onclick = () => {
        if (btn.disabled) return;
        const idx = parseInt(btn.dataset.slot, 10);
        ataquesPanel.style.display = 'none';
        if (_handlers.onAtacarSlot) _handlers.onAtacarSlot(idx);
    };
    btnSlots.push(btn);
    ataquesGrid.appendChild(btn);
}
ataquesPanel.querySelector('#combate-ataques-fechar').onclick = () => { ataquesPanel.style.display = 'none'; };

// ---- painel de itens ----
const itemsPanel = document.createElement('div');
itemsPanel.className = 'pix-panel';
itemsPanel.style.cssText = `
    position: fixed; right: 18px; bottom: 140px;
    padding: 10px 14px;
    width: 320px;
    max-height: 55vh;
    overflow-y: auto;
    color: #f5e8c8;
    z-index: 102;
    display: none;
    pointer-events: auto;
`;
itemsPanel.innerHTML = `
    ${pixCorners()}
    <div style="font-size:12px;font-weight:700;letter-spacing:5px;margin-bottom:6px;text-align:center;color:#d4a830;text-shadow:1px 1px 0 #0a0512, 0 0 6px rgba(240,192,96,0.4);">
        ◆ ALFORGE ◆
    </div>
    <div id="combate-itens-lista" style="display:flex;flex-direction:column;gap:4px;"></div>
    <button id="combate-itens-fechar" class="back-btn">↺ Retornar</button>
`;
document.body.appendChild(itemsPanel);

// ---- API ----
let _handlers = { onAtacarSlot: null, onItem: null, onFugir: null };
let _slotState = [null, null, null, null];

btnAtacar.onclick = () => {
    itemsPanel.style.display = 'none';
    ataquesPanel.style.display = 'block';
};
btnItens.onclick = () => {
    ataquesPanel.style.display = 'none';
    itemsPanel.style.display = 'block';
};
btnFugir.onclick = () => { if (_handlers.onFugir) _handlers.onFugir(); };

document.getElementById('combate-itens-fechar').onclick = () => { itemsPanel.style.display = 'none'; };

window.addEventListener('keydown', (e) => {
    if (root.style.display === 'none') return;

    const CODE_ACCAO = ['KeyJ', 'KeyK', 'KeyL'];
    const CODE_ACCAO_ALT = ['KeyU', 'KeyI', 'KeyO'];
    const CODE_SLOT = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
    const CODE_ITEM = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'];

    const _accaoPrincipal = (idx) => {
        if (idx === 0) btnAtacar.click();
        else if (idx === 1) btnItens.click();
        else if (idx === 2) btnFugir.click();
    };
    const _picarSlot = (idx) => { if (btnSlots[idx]) btnSlots[idx].click(); };
    const _picarItem = (idx) => {
        const rows = itemsPanel.querySelectorAll('.item-row');
        if (rows[idx]) rows[idx].click();
    };

    if (e.code === 'Escape' || e.code === 'Backspace') {
        if (ataquesPanel.style.display !== 'none' || itemsPanel.style.display !== 'none') {
            ataquesPanel.style.display = 'none';
            itemsPanel.style.display   = 'none';
            e.preventDefault();
        }
        return;
    }
    if (ataquesPanel.style.display !== 'none') {
        const idx = CODE_SLOT.indexOf(e.code);
        if (idx >= 0) { _picarSlot(idx); e.preventDefault(); }
        return;
    }
    if (itemsPanel.style.display !== 'none') {
        const idx = CODE_ITEM.indexOf(e.code);
        if (idx >= 0) { _picarItem(idx); e.preventDefault(); }
        return;
    }
    let idx = CODE_ACCAO.indexOf(e.code);
    if (idx < 0) idx = CODE_ACCAO_ALT.indexOf(e.code);
    if (idx >= 0) { _accaoPrincipal(idx); e.preventDefault(); }
});

export function setCombateHandlers({ onAtacarSlot, onItem, onFugir }) {
    _handlers.onAtacarSlot = onAtacarSlot;
    _handlers.onItem  = onItem;
    _handlers.onFugir = onFugir;
}

// --------------------------------------------------------
// SLOTS DE TÉCNICA
// --------------------------------------------------------
function _slotContent(slotIdx, titulo, sub) {
    const keyLabel = KEY_LABELS_SLOT[slotIdx] || `${slotIdx + 1}`;
    return `
        <span class="key">[${keyLabel}]</span>
        <div class="nm">${titulo}</div>
        <div class="ds">${sub}</div>
    `;
}
function renderSlotBtn(btn, info, podeMexer, idx) {
    if (!info || !info.ataque) {
        btn.innerHTML = _slotContent(idx, '🔒 BLOQUEADO', 'espaço vazio');
        btn.disabled = true;
        btn.style.opacity = '0.4';
        return;
    }
    const a = info.ataque;
    const cd = info.cooldown | 0;
    const emCD = cd > 0;
    const sub = emCD ? `⌛ repouso: ${cd}` : a.desc;

    const isImage = a.icone && (a.icone.endsWith('.png') || a.icone.endsWith('.jpg') || a.icone.includes('/'));
    const iconHtml = isImage
        ? `<img src="${a.icone}" style="width:14px;height:14px;object-fit:contain;vertical-align:middle;margin-right:4px;image-rendering:pixelated;">`
        : (a.icone || '⚔');

    btn.innerHTML = _slotContent(idx, `${iconHtml} ${a.nome.toUpperCase()}`, sub);
    const ativo = podeMexer && !emCD;
    btn.disabled = !ativo;
    btn.style.opacity = ativo ? '1' : (emCD ? '0.6' : '0.45');
}

function refreshSlots(podeMexer) {
    btnSlots.forEach((btn, i) => renderSlotBtn(btn, _slotState[i], podeMexer, i));
}

export function setAtaqueSlots(...slots) {
    for (let i = 0; i < _slotState.length; i++) {
        _slotState[i] = slots[i] || null;
    }
    refreshSlots(!btnItens.disabled);
}

// --------------------------------------------------------
// MOSTRAR / ESCONDER
// --------------------------------------------------------
export function mostrarCombateUI(nomeInimigo = 'INIMIGO CORROMPIDO') {
    document.getElementById('combate-nome-inimigo').textContent = nomeInimigo;
    setPresagio(null);
    setStatusPlayer(null);
    _logHist.length = 0;
    root.style.display = 'block';
    enemyPlate.style.display = 'block';
    playerPlate.style.display = 'block';
    logBox.style.display = 'block';
    actionsBar.style.display = 'grid';
    document.body.style.transform = '';
    setBotoesAtivos(true);
    // Em modo comando, regista contexto de navegação UI para que D-pad/A/B
    // movam o foco e activem botões em vez de cair no mundo.
    if (settings.inputMethod === 'gamepad') _entrarNavCombate();
    _refrescarModoCombate();
}
export function esconderCombateUI() {
    root.style.display = 'none';
    enemyPlate.style.display = 'none';
    playerPlate.style.display = 'none';
    logBox.style.display = 'none';
    actionsBar.style.display = 'none';
    _sairNavCombate();
    _refrescarModoCombate();
}

// --------------------------------------------------------
// TECLAS HINT
// --------------------------------------------------------
export const KEY_LABELS_ACCAO = ['J', 'K', 'L'];
export const KEY_LABELS_SLOT  = ['1', '2', '3', '4'];

// --------------------------------------------------------
// GAMEPAD — navegação por D-pad/stick + A/B
// --------------------------------------------------------
import { pushNavContext, popNavContext } from '../core/gamepad.js';
import { settings, onSettingChange } from '../systems/settings.js';
import { keyGlyph as _keyGlyph, psGlyph as _psGlyph } from './glyphs.js';

let _navCtx = null;          // contexto registado em pushNavContext
let _focusedAction = 0;      // 0..2 → btnAtacar/Itens/Fugir
let _focusedSlot   = 0;      // 0..3 → ataques (2×2)
let _focusedItem   = 0;      // 0..N → linhas do alforge

// Estado actual: 'actions' | 'attacks' | 'items'
function _currentPanel() {
    if (ataquesPanel.style.display !== 'none') return 'attacks';
    if (itemsPanel.style.display   !== 'none') return 'items';
    return 'actions';
}

function _actionBtns() { return [btnAtacar, btnItens, btnFugir]; }
function _itemBtns()   { return Array.from(itemsPanel.querySelectorAll('.item-row')); }

function _applyFocusCss() {
    if (settings.inputMethod !== 'gamepad') {
        // Limpa todos os focos visuais quando o gamepad não está activo.
        for (const el of document.querySelectorAll('.gp-focus')) el.classList.remove('gp-focus');
        return;
    }
    const panel = _currentPanel();
    const all = [..._actionBtns(), ...btnSlots, ..._itemBtns()];
    for (const el of all) el.classList.remove('gp-focus');
    let target = null;
    if (panel === 'actions') target = _actionBtns()[_focusedAction];
    else if (panel === 'attacks') target = btnSlots[_focusedSlot];
    else if (panel === 'items') target = _itemBtns()[_focusedItem];
    if (target) target.classList.add('gp-focus');
}

function _moveFocus(dir) {
    const panel = _currentPanel();
    if (panel === 'actions') {
        // 3 botões horizontais
        if (dir === 'left')  _focusedAction = (_focusedAction + 2) % 3;
        if (dir === 'right') _focusedAction = (_focusedAction + 1) % 3;
        // up/down: ignorado
    } else if (panel === 'attacks') {
        // 2×2 grid: 0 1 / 2 3
        const row = Math.floor(_focusedSlot / 2);
        const col = _focusedSlot % 2;
        if (dir === 'left')  _focusedSlot = row * 2 + ((col + 1) % 2);
        if (dir === 'right') _focusedSlot = row * 2 + ((col + 1) % 2);
        if (dir === 'up' || dir === 'down') _focusedSlot = (_focusedSlot + 2) % 4;
    } else if (panel === 'items') {
        const n = _itemBtns().length;
        if (n === 0) return;
        if (dir === 'up')   _focusedItem = (_focusedItem - 1 + n) % n;
        if (dir === 'down') _focusedItem = (_focusedItem + 1) % n;
    }
    _applyFocusCss();
}

function _confirm() {
    const panel = _currentPanel();
    if (panel === 'actions') {
        const b = _actionBtns()[_focusedAction];
        if (b) b.click();
        // Após abrir ataques/itens, fixa o foco no primeiro elemento.
        if (_currentPanel() === 'attacks') _focusedSlot = _firstEnabled(btnSlots);
        if (_currentPanel() === 'items')   _focusedItem = 0;
    } else if (panel === 'attacks') {
        const b = btnSlots[_focusedSlot];
        if (b && !b.disabled) b.click();
        // O slot fecha o painel ao executar — refrescamos no fim.
    } else if (panel === 'items') {
        const rows = _itemBtns();
        const r = rows[_focusedItem];
        if (r) r.click();
    }
    _applyFocusCss();
}

function _cancel() {
    const panel = _currentPanel();
    if (panel === 'attacks') { ataquesPanel.style.display = 'none'; _applyFocusCss(); return; }
    if (panel === 'items')   { itemsPanel.style.display = 'none';   _applyFocusCss(); return; }
    // Em 'actions' não há para onde fechar; ignora.
}

function _firstEnabled(btns) {
    for (let i = 0; i < btns.length; i++) if (!btns[i].disabled) return i;
    return 0;
}

// Hook: quando o painel actions volta a abrir (por exemplo após esconder
// ataques/itens), garantir que o foco visual está actualizado.
const _origMostrarCombate = mostrarCombateUI;
// (sem alteração; registamos o nav context dentro de mostrarCombateUI)

// Em modo comando, esconde os hints de teclado [J/U] [1] etc. e dá-lhes
// um sinal visual mais subtil. O .gp-focus em si vem do glyphs.js.
(function _injectCombateGamepadCss() {
    if (document.getElementById('combate-gp-css')) return;
    const s = document.createElement('style');
    s.id = 'combate-gp-css';
    s.textContent = `
        body.input-gamepad .pix-btn .key,
        body.input-gamepad .tech-slot .key,
        body.input-gamepad .item-row .key { display: none !important; }
    `;
    document.head.appendChild(s);
})();

// Legenda flutuante: "✕ Confirmar  ○ Voltar  D-pad/Stick navegar".
// Aparece sempre que estamos em modo comando e a UI de combate está visível.
const _gpHintBar = document.createElement('div');
_gpHintBar.id = 'combate-gp-hint';
_gpHintBar.style.cssText = `
    position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%);
    z-index: 110; pointer-events: none;
    background: rgba(10,5,18,0.85);
    border: 1px solid rgba(212,168,48,0.5);
    border-radius: 8px;
    padding: 6px 14px;
    color: #ffe9a0;
    font-family: 'Pixelify Sans', monospace;
    font-size: 12px; letter-spacing: 1px;
    display: none; gap: 14px;
    align-items: center;
    box-shadow: 0 4px 14px rgba(0,0,0,0.5);
`;
_gpHintBar.innerHTML = `
    <span>${_psGlyph('cross')} <span style="margin-left:4px;">Confirmar</span></span>
    <span>${_psGlyph('circle')} <span style="margin-left:4px;">Voltar</span></span>
    <span>${_psGlyph('dpad')} <span style="margin-left:4px;">Navegar</span></span>
`;
document.body.appendChild(_gpHintBar);

function _refrescarModoCombate() {
    const gp = settings.inputMethod === 'gamepad';
    document.body.classList.toggle('input-gamepad', gp);
    const visivel = root.style.display !== 'none';
    _gpHintBar.style.display = (gp && visivel) ? 'flex' : 'none';
}

function _entrarNavCombate() {
    if (_navCtx) return; // já activo
    _focusedAction = 0;
    _focusedSlot   = _firstEnabled(btnSlots);
    _focusedItem   = 0;
    _navCtx = {
        onNav: _moveFocus,
        onConfirm: _confirm,
        onCancel: _cancel,
    };
    pushNavContext(_navCtx);
    _applyFocusCss();
}
function _sairNavCombate() {
    if (!_navCtx) return;
    popNavContext(_navCtx);
    _navCtx = null;
    // limpa o foco visual
    for (const el of document.querySelectorAll('.gp-focus')) el.classList.remove('gp-focus');
}

// Re-aplica/limpa o foco quando o jogador troca de input em runtime.
onSettingChange('inputMethod', (v) => {
    _refrescarModoCombate();
    if (root.style.display === 'none') return;
    if (v === 'gamepad') _entrarNavCombate();
    else                  _sairNavCombate();
});

// Sincroniza a classe `input-gamepad` no body assim que o módulo carrega.
_refrescarModoCombate();
export const KEY_LABELS_ITEM  = ['Q', 'W', 'E', 'R'];

// --------------------------------------------------------
// LOG
// --------------------------------------------------------
const _logHist = [];
export function setLog(texto) {
    _logHist.unshift(texto);
    if (_logHist.length > 15) _logHist.pop();

    const content = document.getElementById('log-content');
    if (!content) return;

    content.innerHTML = _logHist.map((t, i) => {
        // Opacidade: as linhas antigas continuam legíveis (não caem para 0.35).
        const op = i === 0 ? 1 : (i < 3 ? 0.8 : 0.6);
        const fw = i === 0 ? 700 : 400;
        const fs = i === 0 ? '14px' : '12px';

        let displayT = t;
        const lowT = t.toLowerCase();

        // Cores do dano nas crónicas:
        //   • dano do jogador no inimigo  → AMARELO (#ffe080)
        //   • dano do inimigo no jogador  → AZUL    (#8ab8ff)
        // Heurística pelas mensagens reais do combate.js:
        //   • Jogador ataca: "Lâmina Veloz! 7 de dano." (sem palavras-chave)
        //   • Inimigo ataca: "<Nome> usa <ataque>! Sofreste X de dano."
        // → detectamos dano sofrido por "sofreste"/"sofreu"; o resto é dano causado.
        const danoSofrido = lowT.includes('sofreste') || lowT.includes('sofreu') || lowT.includes('drenou');
        if (danoSofrido) {
            displayT = displayT.replace(/(\d+\s*(?:de\s+)?dano)/gi, '<span style="color:#ff5060;font-weight:700;text-shadow:0 0 4px rgba(255,80,80,0.5);">$1</span>');
        } else {
            displayT = displayT.replace(/(\d+\s*(?:de\s+)?dano)/gi, '<span style="color:#ffe080;font-weight:700;">$1</span>');
        }

        // Cura do jogador → VERDE (não tinge a cura do inimigo)
        const isEnemyHealing = lowT.includes('drenou') || (lowT.includes('recuperou') && !lowT.includes('auréola'));
        if (!isEnemyHealing && (lowT.includes('recuperaste') || lowT.includes('recuperou') || lowT.includes('recuperastes') || lowT.includes('restaurado') || lowT.includes('curou'))) {
            displayT = displayT.replace(/(\d+)/g, '<span style="color:#88ff99;font-weight:900;">$1</span>');
            displayT = displayT.replace(/(pontos de vida)/gi, '<span style="color:#88ff99;font-weight:700;">$1</span>');
        }

        const color = i === 0 ? '#f5e8c8' : '#e8d8b0';
        const border = i === 0 ? 'border-bottom:1px solid rgba(212,168,48,0.4);padding-bottom:4px;margin-bottom:4px;' : '';
        return `<div style="opacity:${op};font-weight:${fw};font-size:${fs};color:${color};letter-spacing:1px;text-align:left;text-shadow:1px 1px 0 #0a0512;${border}"><span style="color:#d4a830;margin-right:4px;">▸</span>${displayT}</div>`;
    }).join('');

    if (!_logExpandido) logBox.scrollTop = 0;
}

// --------------------------------------------------------
// PRESÁGIO / STATUS
// --------------------------------------------------------
export function setPresagio(at) {
    const el = document.getElementById('combate-presagio');
    if (!el) return;
    if (at) {
        const n = Math.max(1, Math.min(3, at.perigo || 1));
        const cor = n >= 3 ? '#ff7088' : (n === 2 ? '#ffcc66' : '#a8d8ff');
        el.innerHTML = `🕶 ${at.nome} <span style="color:${cor}">${'⚔'.repeat(n)}</span>`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

export function setStatusPlayer(texto) {
    const el = document.getElementById('combate-status-player');
    if (!el) return;
    if (texto) { 
        el.textContent = texto; 
        el.style.display = 'block'; 
        // Se for "DANO!", pintar de vermelho sangue
        if (texto.toUpperCase().includes('DANO')) {
            el.style.color = '#ff4060';
            el.style.textShadow = '0 0 8px #a82040, 1px 1px 0 #0a0512';
        } else {
            el.style.color = '#ffe080';
            el.style.textShadow = '1px 1px 0 #0a0512, 0 0 6px #cc8822';
        }
    }
    else { el.style.display = 'none'; }
}

// --------------------------------------------------------
// DANO FLUTUANTE + FAÍSCAS + SHAKES
// --------------------------------------------------------
function _spawnSparks(xPx, yPx, count, color) {
    for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'combate-spark';
        const ang = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 70;
        s.style.cssText = `
            left:${xPx}px; top:${yPx}px;
            width:${2+Math.random()*3}px; height:${2+Math.random()*3}px;
            background:${color};color:${color};
            --dx:${Math.cos(ang)*dist}px;
            --dy:${Math.sin(ang)*dist - 20}px;
        `;
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 800);
    }
}

function _flash() {
    const f = document.createElement('div');
    f.className = 'combate-flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 200);
}

function _hitEnemyPlate() {
    enemyPlate.style.animation = 'combate-hit-shake 0.45s steps(6) 1';
    enemyPlate.classList.add('combate-hit-flash');
    setTimeout(() => enemyPlate.classList.remove('combate-hit-flash'), 90);
    setTimeout(() => { enemyPlate.style.animation = ''; }, 460);
}

// Recebe x,y em percentagem do ecrã (mantém compatibilidade com a tua chamada original).
// Cor sugerida: vermelho para dano forte, dourado para dano normal, verde para cura.
export function mostrarDanoFlutuante(x, y, texto, cor) {
    const xPx = (x / 100) * window.innerWidth;
    const yPx = (y / 100) * window.innerHeight;

    // Detecta tipo pelo conteúdo/cor para escolher faíscas e shakes apropriados
    const txt = String(texto);
    const isMiss = /falh|miss|errou/i.test(txt);
    const isHeal = /^\+/.test(txt) || (cor && /#8|#a|#3a|#22|verde|green/i.test(cor));
    const numero = parseInt(txt.replace(/[^\d]/g, ''), 10) || 0;
    const isCrit = !isHeal && !isMiss && numero >= 25;

    // Elemento de numbero
    const el = document.createElement('div');
    el.className = 'combate-dmg';
    const jx = xPx + (Math.random()-0.5) * 30;
    const jy = yPx + (Math.random()-0.5) * 20;
    el.style.left = jx + 'px';
    el.style.top  = jy + 'px';
    el.textContent = txt;

    const fontSize = isCrit ? 54 : (isMiss ? 28 : 40);
    const corNumero = cor || (isHeal ? '#8aff9a' : (isCrit ? '#ffffff' : '#ffe080'));
    const outline = isCrit ? '#5a0e22' : '#0a0512';

    el.style.fontSize = fontSize + 'px';
    el.style.color = corNumero;
    el.style.textShadow = `
        3px 0 0 ${outline}, -3px 0 0 ${outline},
        0 3px 0 ${outline}, 0 -3px 0 ${outline},
        3px 3px 0 #0a0512, -3px -3px 0 #0a0512,
        3px -3px 0 #0a0512, -3px 3px 0 #0a0512,
        0 0 14px ${corNumero}
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1050);

    // Faíscas + shakes
    if (isHeal) {
        _spawnSparks(xPx, yPx, 10, '#8aff9a');
        _spawnSparks(xPx, yPx, 4, '#c878f0');
    } else if (!isMiss) {
        // Determinar se acertou no inimigo (topo do ecrã) ou no herói (esquerda inferior)
        const noInimigo = yPx < window.innerHeight * 0.55;
        if (noInimigo) _hitEnemyPlate();
        
        _spawnSparks(xPx, yPx, isCrit ? 22 : 14, '#ffe080');
        _spawnSparks(xPx, yPx, isCrit ? 10 : 5, '#ff4060');
        if (isCrit) {
            document.body.classList.add('combate-screen-shake');
            setTimeout(() => document.body.classList.remove('combate-screen-shake'), 500);
            _flash();
        }
    }
}

// --------------------------------------------------------
// ACTIVO / INACTIVO
// --------------------------------------------------------
export function setBotoesAtivos(ativo) {
    [btnAtacar, btnItens, btnFugir].forEach(b => { b.disabled = !ativo; });
    if (!ativo) {
        ataquesPanel.style.display = 'none';
        itemsPanel.style.display   = 'none';
    }
    refreshSlots(ativo);
}

// --------------------------------------------------------
// ITENS
// --------------------------------------------------------
export function preencherItens(lista, onUse) {
    const cont = document.getElementById('combate-itens-lista');
    cont.innerHTML = '';
    if (lista.length === 0) {
        cont.innerHTML = '<div style="opacity:0.7;text-align:center;font-size:12px;color:#c8a8e0;letter-spacing:2px;padding:6px 0;">— sem objectos —</div>';
        return;
    }

    const pocoes     = lista.filter(it => it.efeito && (it.efeito.tipo === 'curar' || it.efeito.tipo === 'curarTotal'));
    const acessorios = lista.filter(it => it.efeito && it.efeito.tipo === 'equipar');
    const outros     = lista.filter(it => !it.efeito || (it.efeito.tipo !== 'curar' && it.efeito.tipo !== 'curarTotal' && it.efeito.tipo !== 'equipar'));

    function header(texto) {
        const h = document.createElement('div');
        h.className = 'item-header';
        h.innerHTML = texto;
        cont.appendChild(h);
    }
    let _idxRender = 0;
    function linha(item, equipavel) {
        const idx = _idxRender++;
        const row = document.createElement('button');
        row.className = 'item-row';
        
        const cd = item.cooldown || 0;
        const emCD = cd > 0;

        const sufixo = equipavel
            ? `<span style="pointer-events:none;opacity:0.85;font-size:10px;color:${item.equipado?'#ffe080':'#c8a8e0'};letter-spacing:1px;">${item.equipado ? 'TRAJADO' : 'cingir'}</span>`
            : (emCD 
                ? `<span style="pointer-events:none;opacity:0.85;font-size:10px;color:#ff4060;letter-spacing:1px;">⌛ repouso: ${cd}</span>`
                : `<span style="pointer-events:none;opacity:0.85;font-size:10px;color:#d4a830;letter-spacing:1px;">×${item.quantidade}</span>`
              );
        
        const keyLabel = KEY_LABELS_ITEM[idx];
        const keyHint = keyLabel
            ? `<span style="pointer-events:none;opacity:0.7;font-size:10px;color:#d4a830;margin-right:4px;letter-spacing:1px;">[${keyLabel}]</span>`
            : '';
        const isImage = item.icone && (item.icone.endsWith('.png') || item.icone.endsWith('.jpg') || item.icone.includes('/'));
        const iconHtml = isImage
            ? `<img src="${item.icone}" style="width:14px;height:14px;object-fit:contain;vertical-align:middle;margin-right:4px;image-rendering:pixelated;">`
            : (item.icone || '');

        row.innerHTML = `<span style="pointer-events:none;display:flex;align-items:center;">${keyHint}${iconHtml} ${item.nome}</span>${sufixo}`;
        
        row.disabled = emCD || (item.quantidade <= 0 && !equipavel);
        row.style.opacity = emCD ? '0.6' : '1';
        
        row.onclick = () => {
            if (emCD) return;
            itemsPanel.style.display = 'none';
            onUse(item);
        };
        cont.appendChild(row);
    }

    if (pocoes.length > 0) {
        header('<img src="assets/icones/big_potion.png" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;image-rendering:pixelated;"> Elixires');
        for (const it of pocoes) linha(it, false);
    }
    if (acessorios.length > 0) {
        header('◆ Acessórios');
        for (const it of acessorios) linha(it, true);
    }
    if (outros.length > 0) {
        header('◇ Diversos');
        for (const it of outros) linha(it, false);
    }
}

// --------------------------------------------------------
// BARRAS DE VIDA
// --------------------------------------------------------
export function setHpInimigo(atual, max) {
    const fill = document.getElementById('combate-hp-inimigo');
    const label = document.getElementById('combate-hp-inimigo-label');
    if (fill) fill.style.width = Math.max(0, (atual / max) * 100) + '%';
    if (label) label.textContent = `HP ${Math.max(0, atual)} / ${max}`;
}

export function setHpPlayer(atual, max) {
    const fill = document.getElementById('combate-hp-player');
    const label = document.getElementById('combate-hp-player-label');
    if (fill) fill.style.width = Math.max(0, (atual / max) * 100) + '%';
    if (label) label.textContent = `HP ${Math.max(0, atual)} / ${max}`;
}
