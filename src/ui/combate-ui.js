// --------------------------------------------------------
// UI DE COMBATE
// --------------------------------------------------------
// Três áreas de ação: Atacar, Itens, Fugir + barras de HP + log.
// Tema: roxo corrompido (coerente com a arena).
// --------------------------------------------------------

// `root` é o nó "ligar/desligar" da UI. Os elementos individuais são
// posicionados absolutamente em relação a `document.body` para a layout
// ficar compacta nos cantos (deixa o centro do ecrã livre para o
// jogador ver os projécteis do boss).
const root = document.createElement('div');
root.id = 'combate-ui';
root.style.cssText = `
    position: fixed; inset: 0;
    display: none;
    pointer-events: none;
    z-index: 100;
    font-family: 'Courier New', monospace;
`;
document.body.appendChild(root);

// ---- nameplate do inimigo (topo, compacto) ----
const enemyPlate = document.createElement('div');
enemyPlate.style.cssText = `
    position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(180deg, rgba(40,0,60,0.85), rgba(20,0,30,0.92));
    border: 2px solid #aa44dd;
    border-radius: 8px;
    padding: 6px 14px;
    min-width: 220px; max-width: 280px;
    box-shadow: 0 0 14px rgba(160,60,200,0.5), inset 0 0 10px rgba(80,0,120,0.55);
    color: #f0d0ff; text-align: center;
    z-index: 81; pointer-events: none;
    display: none;
`;
enemyPlate.innerHTML = `
    <div style="font-size:14px;font-weight:bold;letter-spacing:2px;text-shadow:0 0 6px #aa44dd,1px 1px 0 #000;">
        SHACO CORROMPIDO
    </div>
    <div style="height:6px;background:rgba(0,0,0,0.6);border:1px solid #aa44dd;border-radius:4px;margin-top:4px;overflow:hidden;">
        <div id="combate-hp-inimigo" style="height:100%;width:100%;background:linear-gradient(90deg,#ff3070,#ff80aa);box-shadow:0 0 6px #ff3070;transition:width 0.4s;"></div>
    </div>
    <div id="combate-hp-inimigo-label" style="font-size:10px;margin-top:2px;color:#ffaadd;">HP 30 / 30</div>
`;
document.body.appendChild(enemyPlate);

// ---- nameplate do player (canto inferior esquerdo, compacto) ----
const playerPlate = document.createElement('div');
playerPlate.style.cssText = `
    position: fixed; bottom: 14px; left: 14px;
    background: linear-gradient(180deg, rgba(40,0,60,0.85), rgba(20,0,30,0.92));
    border: 2px solid #aa44dd;
    border-radius: 8px;
    padding: 6px 12px;
    min-width: 170px;
    box-shadow: 0 0 14px rgba(160,60,200,0.5), inset 0 0 10px rgba(80,0,120,0.55);
    color: #f0d0ff;
    z-index: 81; pointer-events: none;
    display: none;
`;
playerPlate.innerHTML = `
    <div id="combate-nome-player" style="font-size:13px;font-weight:bold;letter-spacing:1px;text-shadow:0 0 6px #aa44dd,1px 1px 0 #000;">
        HERÓI
    </div>
    <div style="height:6px;background:rgba(0,0,0,0.6);border:1px solid #44dd66;border-radius:4px;margin-top:4px;overflow:hidden;">
        <div id="combate-hp-player" style="height:100%;width:100%;background:linear-gradient(90deg,#22cc44,#88ff99);box-shadow:0 0 6px #22cc44;transition:width 0.4s;"></div>
    </div>
    <div id="combate-hp-player-label" style="font-size:10px;margin-top:2px;color:#aaffbb;">HP 30 / 30</div>
`;
document.body.appendChild(playerPlate);

// ---- caixa de mensagens (log, no topo por baixo do nameplate) ----
const logBox = document.createElement('div');
logBox.style.cssText = `
    position: fixed; top: 84px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(180deg, rgba(20,0,30,0.88), rgba(10,0,20,0.92));
    border: 1px solid #aa44dd;
    border-radius: 8px;
    padding: 5px 14px;
    min-height: 22px;
    width: min(440px, 70vw);
    text-align: center;
    color: #f0d0ff;
    font-size: 12px;
    text-shadow: 0 0 4px #aa44dd, 1px 1px 0 #000;
    box-shadow: 0 0 10px rgba(120,40,160,0.35), inset 0 0 10px rgba(60,0,100,0.45);
    pointer-events: none;
    z-index: 81;
    display: none;
`;
logBox.textContent = '';
document.body.appendChild(logBox);

// ---- painel de ações (canto inferior direito) ----
const actionsBar = document.createElement('div');
actionsBar.style.cssText = `
    position: fixed; bottom: 14px; right: 14px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    width: 320px;
    pointer-events: auto;
    z-index: 100;
    display: none;
`;
document.body.appendChild(actionsBar);

function makeActionBtn(label, sub, color, keyHint) {
    const btn = document.createElement('button');
    btn.style.cssText = `
        font-family: 'Courier New', monospace;
        color: #fff;
        background: linear-gradient(180deg, rgba(${color},0.85), rgba(20,0,30,0.95));
        border: 2px solid #aa44dd;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(160,60,200,0.4), inset 0 0 8px rgba(80,0,120,0.5);
        transition: transform 0.1s, box-shadow 0.2s, background 0.2s;
        box-sizing: border-box;
        position: relative;
        min-height: 56px;
        padding: 0;
        overflow: hidden;
    `;
    // O conteúdo ocupa todo o botão e não bloqueia cliques —
    // assim qualquer ponto do rectângulo dispara o onclick.
    // O badge da tecla fica no canto superior esquerdo.
    btn.innerHTML = `
        <div style="
            position: absolute; top: 2px; left: 4px;
            font-size: 9px; font-weight: bold; letter-spacing: 1px;
            color: #f0d0ff; opacity: 0.7;
            pointer-events: none;
            text-shadow: 0 0 3px #000;
        ">[${keyHint}]</div>
        <div style="
            position: absolute; inset: 0;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            pointer-events: none;
            text-shadow: 0 0 6px #aa44dd, 1px 1px 0 #000;
        ">
            <span style="font-size:14px;font-weight:bold;letter-spacing:1px;">${label}</span>
            <span style="font-size:9px;font-weight:normal;opacity:0.7;margin-top:2px;letter-spacing:1px;">${sub}</span>
        </div>
    `;
    btn.onmouseenter = () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 0 22px rgba(220,120,255,0.85), inset 0 0 18px rgba(120,40,180,0.65)';
    };
    btn.onmouseleave = () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 0 14px rgba(160,60,200,0.4), inset 0 0 12px rgba(80,0,120,0.5)';
    };
    return btn;
}

const btnAtacar = makeActionBtn('⚔ ATAQUE', 'escolhe um golpe', '120,30,60', 'J');
const btnItens  = makeActionBtn('🧪 ITENS', 'usa um objecto',   '60,30,120', 'K');
const btnFugir  = makeActionBtn('💨 FUGIR', 'tenta escapar',    '40,40,80', 'L');
actionsBar.append(btnAtacar, btnItens, btnFugir);

// ---- sub-painel de ataques (2x2, estilo Pokémon) ----
const ataquesPanel = document.createElement('div');
ataquesPanel.style.cssText = `
    position: fixed; right: 14px; bottom: 84px;
    background: linear-gradient(180deg, rgba(30,0,50,0.94), rgba(10,0,20,0.96));
    border: 2px solid #aa44dd;
    border-radius: 8px;
    padding: 8px 10px 8px;
    width: 320px;
    color: #f0d0ff;
    z-index: 102;
    display: none;
    box-shadow: 0 0 18px rgba(160,60,200,0.55), inset 0 0 10px rgba(80,0,120,0.5);
    pointer-events: auto;
`;
ataquesPanel.innerHTML = `
    <div style="font-size:11px;font-weight:bold;letter-spacing:2px;margin-bottom:6px;text-align:center;text-shadow:0 0 4px #aa44dd,1px 1px 0 #000;">
        ⟡ ATAQUES ⟡
    </div>
    <div id="combate-ataques-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>
    <button id="combate-ataques-fechar" style="margin-top:6px;width:100%;padding:4px;background:rgba(60,0,100,0.7);color:#f0d0ff;border:1px solid #aa44dd;border-radius:6px;font-family:'Courier New',monospace;font-size:11px;cursor:pointer;">FECHAR</button>
`;
document.body.appendChild(ataquesPanel);

const ataquesGrid = ataquesPanel.querySelector('#combate-ataques-grid');
const btnSlots = [];
for (let i = 0; i < 4; i++) {
    const btn = document.createElement('button');
    btn.dataset.slot = String(i);
    btn.style.cssText = `
        font-family: 'Courier New', monospace;
        color: #fff;
        background: linear-gradient(180deg, rgba(120,30,60,0.85), rgba(20,0,30,0.95));
        border: 1px solid #aa44dd;
        border-radius: 6px;
        cursor: pointer;
        box-shadow: 0 0 8px rgba(160,60,200,0.3), inset 0 0 8px rgba(80,0,120,0.45);
        transition: transform 0.1s, box-shadow 0.2s;
        box-sizing: border-box;
        position: relative;
        min-height: 52px;
        padding: 0;
        overflow: hidden;
    `;
    btn.onmouseenter = () => {
        if (btn.disabled) return;
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 0 18px rgba(220,120,255,0.8), inset 0 0 16px rgba(120,40,180,0.65)';
    };
    btn.onmouseleave = () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 0 10px rgba(160,60,200,0.35), inset 0 0 10px rgba(80,0,120,0.5)';
    };
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

// ---- painel de itens (sobreposição) ----
const itemsPanel = document.createElement('div');
itemsPanel.style.cssText = `
    position: fixed; right: 14px; bottom: 84px;
    background: linear-gradient(180deg, rgba(30,0,50,0.94), rgba(10,0,20,0.96));
    border: 2px solid #aa44dd;
    border-radius: 8px;
    padding: 8px 12px;
    width: 280px;
    max-height: 50vh;
    overflow-y: auto;
    color: #f0d0ff;
    z-index: 102;
    display: none;
    box-shadow: 0 0 18px rgba(160,60,200,0.55), inset 0 0 10px rgba(80,0,120,0.5);
    pointer-events: auto;
`;
itemsPanel.innerHTML = `
    <div style="font-size:11px;font-weight:bold;letter-spacing:2px;margin-bottom:6px;text-align:center;text-shadow:0 0 4px #aa44dd,1px 1px 0 #000;">
        ⟡ INVENTÁRIO ⟡
    </div>
    <div id="combate-itens-lista" style="display:flex;flex-direction:column;gap:4px;"></div>
    <button id="combate-itens-fechar" style="margin-top:6px;width:100%;padding:4px;background:rgba(60,0,100,0.7);color:#f0d0ff;border:1px solid #aa44dd;border-radius:6px;font-family:'Courier New',monospace;font-size:11px;cursor:pointer;">FECHAR</button>
`;
document.body.appendChild(itemsPanel);

// ---- API exposta ----
let _handlers = { onAtacarSlot: null, onItem: null, onFugir: null };
// estado mais recente dos 4 slots, para podermos rebuildar respeitando cooldowns
let _slotState = [null, null, null, null]; // cada entrada: { ataque, cooldown } ou null

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

// Click fora dos painéis fecha-os — assim o jogador pode ver os
// ataques do boss e desviar-se sem ter de clicar em "FECHAR".
// Cliques dentro do actionsBar (botões principais) ou dos painéis
// abertos não disparam o close — apenas cliques no resto do ecrã.
window.addEventListener('mousedown', (e) => {
    if (root.style.display === 'none') return;
    if (actionsBar.contains(e.target)) return;
    if (ataquesPanel.contains(e.target)) return;
    if (itemsPanel.contains(e.target))   return;
    ataquesPanel.style.display = 'none';
    itemsPanel.style.display   = 'none';
});

// ----------------------------------------------------------------------
// KEYBINDS — lado direito do teclado para a mão direita do jogador
// (a esquerda fica em WASD para esquivar). Usa `e.code` (posição física)
// para funcionar em layouts não-US. Estruturado para um gamepad
// substituir só o input — os helpers `_accaoPrincipal/_picarSlot/_picarItem`
// não dependem das teclas.
//
//   PRINCIPAL (sem painel aberto):
//     [J] ATAQUE   [K] ITENS   [L] FUGIR
//   PAINEL DE ATAQUES aberto:
//     [J] [K] [L] [;] escolhem slot   [Esc] fecha
//   PAINEL DE ITENS aberto:
//     [J] [K] [L] [;] [U] [I] [O] [P] escolhem item   [Esc] fecha
// ----------------------------------------------------------------------
export const KEY_LABELS_ACCAO = ['J', 'K', 'L'];
export const KEY_LABELS_SLOT  = ['J', 'K', 'L', ';'];
export const KEY_LABELS_ITEM  = ['J', 'K', 'L', ';', 'U', 'I', 'O', 'P'];
const CODE_ACCAO = ['KeyJ', 'KeyK', 'KeyL'];
const CODE_SLOT  = ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
const CODE_ITEM  = ['KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];

function _accaoPrincipal(idx) {
    const alvo = [btnAtacar, btnItens, btnFugir][idx];
    if (alvo && !alvo.disabled) alvo.click();
}

function _picarSlot(idx) {
    const b = btnSlots[idx];
    if (b && !b.disabled) b.click();
}

function _picarItem(idx) {
    const rows = itemsPanel.querySelectorAll('#combate-itens-lista > button');
    const b = rows[idx];
    if (b && !b.disabled) b.click();
}

window.addEventListener('keydown', (e) => {
    if (root.style.display === 'none') return;

    if (e.key === 'Escape') {
        if (ataquesPanel.style.display !== 'none' || itemsPanel.style.display !== 'none') {
            ataquesPanel.style.display = 'none';
            itemsPanel.style.display   = 'none';
            e.preventDefault();
        }
        return;
    }

    // Painel de ataques aberto → J/K/L/; escolhem slot
    if (ataquesPanel.style.display !== 'none') {
        const idx = CODE_SLOT.indexOf(e.code);
        if (idx >= 0) {
            _picarSlot(idx);
            e.preventDefault();
        }
        return;
    }

    // Painel de itens aberto → J/K/L/; U/I/O/P escolhem linha
    if (itemsPanel.style.display !== 'none') {
        const idx = CODE_ITEM.indexOf(e.code);
        if (idx >= 0) {
            _picarItem(idx);
            e.preventDefault();
        }
        return;
    }

    // Sem painel aberto → J/K/L são as acções principais
    const idx = CODE_ACCAO.indexOf(e.code);
    if (idx >= 0) {
        _accaoPrincipal(idx);
        e.preventDefault();
    }
});

export function setCombateHandlers({ onAtacarSlot, onItem, onFugir }) {
    _handlers.onAtacarSlot = onAtacarSlot;
    _handlers.onItem  = onItem;
    _handlers.onFugir = onFugir;
}

function _slotContent(slotIdx, titulo, sub, subOpacity = 0.75) {
    const keyLabel = KEY_LABELS_SLOT[slotIdx] || `${slotIdx + 1}`;
    return `
        <div style="
            position: absolute; top: 2px; left: 4px;
            font-size: 9px; font-weight: bold; letter-spacing: 1px;
            color: #f0d0ff; opacity: 0.7;
            pointer-events: none;
            text-shadow: 0 0 3px #000;
        ">[${keyLabel}]</div>
        <div style="
            position: absolute; inset: 0;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            text-align: center;
            pointer-events: none;
            padding: 4px 6px;
            box-sizing: border-box;
            text-shadow: 0 0 4px #aa44dd, 1px 1px 0 #000;
        ">
            <span style="font-size:12px;font-weight:bold;letter-spacing:1px;line-height:1.1;">${titulo}</span>
            <span style="font-size:9px;font-weight:normal;opacity:${subOpacity};margin-top:2px;letter-spacing:1px;line-height:1.1;">${sub}</span>
        </div>
    `;
}

function renderSlotBtn(btn, info, podeMexer, idx) {
    if (!info || !info.ataque) {
        btn.innerHTML = _slotContent(idx, '🔒 BLOQUEADO', 'slot vazio', 0.55);
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'default';
        return;
    }
    const a = info.ataque;
    const cd = info.cooldown | 0;
    const emCD = cd > 0;
    const sub = emCD ? `recarga: ${cd}` : a.desc;
    btn.innerHTML = _slotContent(idx, `${a.icone || '⚔'} ${a.nome.toUpperCase()}`, sub);
    const ativo = podeMexer && !emCD;
    btn.disabled = !ativo;
    btn.style.opacity = ativo ? '1' : (emCD ? '0.55' : '0.45');
    btn.style.cursor  = ativo ? 'pointer' : 'default';
}

function refreshSlots(podeMexer) {
    for (let i = 0; i < btnSlots.length; i++) {
        renderSlotBtn(btnSlots[i], _slotState[i], podeMexer, i);
    }
}

// Atualiza nome/cooldown dos 4 slots — chamado pelo sistema de combate.
export function setAtaqueSlots(...slots) {
    for (let i = 0; i < _slotState.length; i++) {
        _slotState[i] = slots[i] || null;
    }
    refreshSlots(!btnItens.disabled);
}

export function mostrarCombateUI(nomeInimigo = 'INIMIGO CORROMPIDO') {
    enemyPlate.querySelector('div').textContent = nomeInimigo;
    root.style.display = 'block';
    enemyPlate.style.display = 'block';
    playerPlate.style.display = 'block';
    logBox.style.display = 'block';
    actionsBar.style.display = 'grid';
    // Garante que o body não tem offset residual de shakes anteriores —
    // se ficasse desalinhado, os clicks aterravam fora dos botões.
    document.body.style.transform = '';
    setBotoesAtivos(true);
}

export function esconderCombateUI() {
    root.style.display = 'none';
    enemyPlate.style.display = 'none';
    playerPlate.style.display = 'none';
    logBox.style.display = 'none';
    actionsBar.style.display = 'none';
    itemsPanel.style.display = 'none';
    ataquesPanel.style.display = 'none';
}

export function setLog(texto) { logBox.textContent = texto; }

export function setHpInimigo(atual, max) {
    document.getElementById('combate-hp-inimigo').style.width = Math.max(0, (atual / max) * 100) + '%';
    document.getElementById('combate-hp-inimigo-label').textContent = `HP ${Math.max(0, atual)} / ${max}`;
}

export function setHpPlayer(atual, max) {
    document.getElementById('combate-hp-player').style.width = Math.max(0, (atual / max) * 100) + '%';
    document.getElementById('combate-hp-player-label').textContent = `HP ${Math.max(0, atual)} / ${max}`;
}

export function setBotoesAtivos(ativo) {
    [btnAtacar, btnItens, btnFugir].forEach(b => {
        b.disabled = !ativo;
        b.style.opacity = ativo ? '1' : '0.45';
        b.style.cursor  = ativo ? 'pointer' : 'default';
    });
    if (!ativo) {
        ataquesPanel.style.display = 'none';
        itemsPanel.style.display   = 'none';
    }
    // botões internos respeitam cooldown além do "podeMexer"
    refreshSlots(ativo);
}

export function preencherItens(lista, onUse) {
    const cont = document.getElementById('combate-itens-lista');
    cont.innerHTML = '';
    if (lista.length === 0) {
        cont.innerHTML = '<div style="opacity:0.7;text-align:center;font-size:12px;">— sem itens —</div>';
        return;
    }

    const pocoes     = lista.filter(it => it.efeito && (it.efeito.tipo === 'curar' || it.efeito.tipo === 'curarTotal'));
    const acessorios = lista.filter(it => it.efeito && it.efeito.tipo === 'equipar');
    const outros     = lista.filter(it => !it.efeito || (it.efeito.tipo !== 'curar' && it.efeito.tipo !== 'curarTotal' && it.efeito.tipo !== 'equipar'));

    function header(texto) {
        const h = document.createElement('div');
        h.style.cssText = `
            font-size:11px;letter-spacing:3px;text-transform:uppercase;
            color:#c8a8ff;opacity:0.85;margin:6px 0 2px;
            text-shadow:0 0 4px rgba(170,68,221,0.6);
        `;
        h.textContent = texto;
        cont.appendChild(h);
    }
    // Índice contínuo na lista renderizada (para o keybind 1-9
    // bater certo com o que o jogador vê no painel).
    let _idxRender = 0;
    function linha(item, equipavel) {
        const idx = _idxRender++;
        const row = document.createElement('button');
        row.style.cssText = `
            width:100%;padding:5px 8px;
            background:rgba(40,0,70,0.7);color:#f0d0ff;
            border:1px solid #aa44dd;border-radius:4px;
            font-family:'Courier New',monospace;font-size:11px;
            cursor:pointer;text-align:left;
            display:flex;justify-content:space-between;align-items:center;gap:6px;
        `;
        const sufixo = equipavel
            ? `<span style="pointer-events:none;opacity:0.7;font-size:9px;">${item.equipado ? 'EQUIPADO' : 'equipar'}</span>`
            : `<span style="pointer-events:none;opacity:0.7;font-size:9px;">x${item.quantidade}</span>`;
        const keyLabel = KEY_LABELS_ITEM[idx];
        const keyHint = keyLabel
            ? `<span style="pointer-events:none;opacity:0.55;font-size:9px;color:#c8a8ff;margin-right:4px;">[${keyLabel}]</span>`
            : '';
        row.innerHTML = `<span style="pointer-events:none;display:flex;align-items:center;">${keyHint}${item.icone || ''} ${item.nome}</span>${sufixo}`;
        row.onclick = () => {
            itemsPanel.style.display = 'none';
            onUse(item);
        };
        cont.appendChild(row);
    }

    if (pocoes.length > 0) {
        header('🧪 Poções');
        for (const it of pocoes) linha(it, false);
    }
    if (acessorios.length > 0) {
        header('⚜ Acessórios');
        for (const it of acessorios) linha(it, true);
    }
    if (outros.length > 0) {
        header('◇ Outros');
        for (const it of outros) linha(it, false);
    }
}
