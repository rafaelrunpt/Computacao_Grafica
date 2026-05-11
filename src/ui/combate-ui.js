// --------------------------------------------------------
// UI DE COMBATE
// --------------------------------------------------------
// Três áreas de ação: Atacar, Itens, Fugir + barras de HP + log.
// Tema: roxo corrompido (coerente com a arena).
// --------------------------------------------------------

const root = document.createElement('div');
root.id = 'combate-ui';
root.style.cssText = `
    position: fixed; left: 0; right: 0; bottom: 0;
    display: none;
    flex-direction: column;
    pointer-events: none;
    z-index: 80;
    font-family: 'Courier New', monospace;
`;
document.body.appendChild(root);

// ---- nameplates inimigo (topo) e player (canto inferior esq.) ----
const enemyPlate = document.createElement('div');
enemyPlate.style.cssText = `
    position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(180deg, rgba(40,0,60,0.85), rgba(20,0,30,0.92));
    border: 2px solid #aa44dd;
    border-radius: 10px;
    padding: 8px 18px;
    min-width: 280px; max-width: 360px;
    box-shadow: 0 0 18px rgba(160,60,200,0.55), inset 0 0 12px rgba(80,0,120,0.6);
    color: #f0d0ff; text-align: center;
    z-index: 81; pointer-events: none;
    display: none;
`;
enemyPlate.innerHTML = `
    <div style="font-size:18px;font-weight:bold;letter-spacing:2px;text-shadow:0 0 8px #aa44dd,2px 2px 0 #000;">
        SHACO CORROMPIDO
    </div>
    <div style="height:8px;background:rgba(0,0,0,0.6);border:1px solid #aa44dd;border-radius:4px;margin-top:6px;overflow:hidden;">
        <div id="combate-hp-inimigo" style="height:100%;width:100%;background:linear-gradient(90deg,#ff3070,#ff80aa);box-shadow:0 0 6px #ff3070;transition:width 0.4s;"></div>
    </div>
    <div id="combate-hp-inimigo-label" style="font-size:11px;margin-top:3px;color:#ffaadd;">HP 30 / 30</div>
`;
document.body.appendChild(enemyPlate);

const playerPlate = document.createElement('div');
playerPlate.style.cssText = `
    position: fixed; bottom: 220px; left: 30px;
    background: linear-gradient(180deg, rgba(40,0,60,0.85), rgba(20,0,30,0.92));
    border: 2px solid #aa44dd;
    border-radius: 10px;
    padding: 8px 16px;
    min-width: 220px;
    box-shadow: 0 0 18px rgba(160,60,200,0.55), inset 0 0 12px rgba(80,0,120,0.6);
    color: #f0d0ff;
    z-index: 81; pointer-events: none;
    display: none;
`;
playerPlate.innerHTML = `
    <div id="combate-nome-player" style="font-size:16px;font-weight:bold;letter-spacing:1px;text-shadow:0 0 6px #aa44dd,2px 2px 0 #000;">
        HERÓI
    </div>
    <div style="height:8px;background:rgba(0,0,0,0.6);border:1px solid #44dd66;border-radius:4px;margin-top:6px;overflow:hidden;">
        <div id="combate-hp-player" style="height:100%;width:100%;background:linear-gradient(90deg,#22cc44,#88ff99);box-shadow:0 0 6px #22cc44;transition:width 0.4s;"></div>
    </div>
    <div id="combate-hp-player-label" style="font-size:11px;margin-top:3px;color:#aaffbb;">HP 30 / 30</div>
`;
document.body.appendChild(playerPlate);

// ---- caixa de mensagens (log) ----
const logBox = document.createElement('div');
logBox.style.cssText = `
    margin: 0 24px 8px 24px;
    background: linear-gradient(180deg, rgba(20,0,30,0.92), rgba(10,0,20,0.95));
    border: 2px solid #aa44dd;
    border-radius: 10px 10px 0 0;
    padding: 12px 18px;
    min-height: 56px;
    color: #f0d0ff;
    font-size: 16px;
    text-shadow: 0 0 6px #aa44dd, 1px 1px 0 #000;
    box-shadow: 0 -4px 16px rgba(120,40,160,0.4), inset 0 0 14px rgba(60,0,100,0.55);
    pointer-events: none;
`;
logBox.textContent = '';
root.appendChild(logBox);

// ---- painel de ações ----
const actionsBar = document.createElement('div');
actionsBar.style.cssText = `
    margin: 0 24px 24px 24px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    pointer-events: auto;
`;
root.appendChild(actionsBar);

function makeActionBtn(label, sub, color) {
    const btn = document.createElement('button');
    btn.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 22px; font-weight: bold; letter-spacing: 2px;
        color: #fff;
        background: linear-gradient(180deg, rgba(${color},0.85), rgba(20,0,30,0.95));
        border: 2px solid #aa44dd;
        border-radius: 10px;
        padding: 18px 12px;
        cursor: pointer;
        text-shadow: 0 0 8px #aa44dd, 2px 2px 0 #000;
        box-shadow: 0 0 14px rgba(160,60,200,0.4), inset 0 0 12px rgba(80,0,120,0.5);
        transition: transform 0.1s, box-shadow 0.2s, background 0.2s;
    `;
    btn.innerHTML = `${label}<div style="font-size:11px;font-weight:normal;opacity:0.75;margin-top:4px;letter-spacing:1px;">${sub}</div>`;
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

const btnAtacar = makeActionBtn('⚔ ATACAR', 'desfere um golpe', '120,30,60');
const btnItens  = makeActionBtn('🧪 ITENS',  'usa um objecto',   '60,30,120');
const btnFugir  = makeActionBtn('💨 FUGIR',  'tenta escapar',    '40,40,80');
actionsBar.append(btnAtacar, btnItens, btnFugir);

// ---- painel de itens (sobreposição) ----
const itemsPanel = document.createElement('div');
itemsPanel.style.cssText = `
    position: fixed; left: 50%; bottom: 130px; transform: translateX(-50%);
    background: linear-gradient(180deg, rgba(30,0,50,0.95), rgba(10,0,20,0.97));
    border: 2px solid #aa44dd;
    border-radius: 10px;
    padding: 14px 18px;
    min-width: 320px;
    color: #f0d0ff;
    z-index: 82;
    display: none;
    box-shadow: 0 0 22px rgba(160,60,200,0.6), inset 0 0 14px rgba(80,0,120,0.5);
    pointer-events: auto;
`;
itemsPanel.innerHTML = `
    <div style="font-size:14px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;text-align:center;text-shadow:0 0 6px #aa44dd,1px 1px 0 #000;">
        ⟡ INVENTÁRIO ⟡
    </div>
    <div id="combate-itens-lista" style="display:flex;flex-direction:column;gap:6px;"></div>
    <button id="combate-itens-fechar" style="margin-top:10px;width:100%;padding:6px;background:rgba(60,0,100,0.7);color:#f0d0ff;border:1px solid #aa44dd;border-radius:6px;font-family:'Courier New',monospace;cursor:pointer;">FECHAR</button>
`;
document.body.appendChild(itemsPanel);

// ---- API exposta ----
let _handlers = { onAtacar: null, onItem: null, onFugir: null };

btnAtacar.onclick = () => { if (_handlers.onAtacar) _handlers.onAtacar(); };
btnItens.onclick  = () => { itemsPanel.style.display = 'block'; };
btnFugir.onclick  = () => { if (_handlers.onFugir) _handlers.onFugir(); };

document.getElementById('combate-itens-fechar').onclick = () => { itemsPanel.style.display = 'none'; };

export function setCombateHandlers({ onAtacar, onItem, onFugir }) {
    _handlers.onAtacar = onAtacar;
    _handlers.onItem   = onItem;
    _handlers.onFugir  = onFugir;
}

export function mostrarCombateUI(nomeInimigo = 'INIMIGO CORROMPIDO') {
    enemyPlate.querySelector('div').textContent = nomeInimigo;
    root.style.display = 'flex';
    enemyPlate.style.display = 'block';
    playerPlate.style.display = 'block';
    setBotoesAtivos(true);
}

export function esconderCombateUI() {
    root.style.display = 'none';
    enemyPlate.style.display = 'none';
    playerPlate.style.display = 'none';
    itemsPanel.style.display = 'none';
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
}

export function preencherItens(lista, onUse) {
    const cont = document.getElementById('combate-itens-lista');
    cont.innerHTML = '';
    if (lista.length === 0) {
        cont.innerHTML = '<div style="opacity:0.7;text-align:center;font-size:12px;">— sem itens —</div>';
        return;
    }
    for (const item of lista) {
        const row = document.createElement('button');
        row.style.cssText = `
            width:100%;padding:8px 10px;
            background:rgba(40,0,70,0.7);color:#f0d0ff;
            border:1px solid #aa44dd;border-radius:6px;
            font-family:'Courier New',monospace;font-size:13px;
            cursor:pointer;text-align:left;
            display:flex;justify-content:space-between;align-items:center;gap:8px;
        `;
        row.innerHTML = `<span>${item.nome}</span><span style="opacity:0.7;font-size:11px;">x${item.quantidade}</span>`;
        row.onclick = () => {
            itemsPanel.style.display = 'none';
            onUse(item);
        };
        cont.appendChild(row);
    }
}
