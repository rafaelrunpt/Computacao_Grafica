// --------------------------------------------------------
// UI DE INVENTÁRIO (mundo / loja / castelo)
// --------------------------------------------------------
// Abre com I, fecha com I ou Escape. Estilo RPG dourado/madeira,
// coerente com o HUD (NÍVEL) e a moldura do minimapa.
// --------------------------------------------------------

import { getItens, usarItem, registarOnChange, CATALOGO } from '../systems/inventario.js';
import { playerStats } from '../systems/player-stats.js';
import { atualizarHUD } from './hud.js';

let _aberto = false;
let _bloqueado = false; // bloqueado externamente (ex: combate, diálogo)

export function isInventarioAberto() { return _aberto; }
export function bloquearInventario(b) {
    _bloqueado = b;
    if (b && _aberto) fecharInventario();
}

// ---- shell ----
const overlay = document.createElement('div');
overlay.id = 'inv-overlay';
overlay.style.cssText = `
    position: fixed; inset: 0;
    background: radial-gradient(ellipse at center, rgba(20,10,0,0.55) 0%, rgba(0,0,0,0.85) 100%);
    display: none;
    align-items: center; justify-content: center;
    z-index: 70;
    pointer-events: auto;
    font-family: 'Georgia', serif;
`;
document.body.appendChild(overlay);

const panel = document.createElement('div');
panel.style.cssText = `
    width: 460px; max-width: 92vw; max-height: 80vh;
    background: linear-gradient(180deg, #2a1a08 0%, #3a2510 50%, #2a1a08 100%);
    border: 3px solid #d4a830;
    border-radius: 12px;
    box-shadow:
        0 0 30px rgba(220,160,60,0.5),
        inset 0 0 20px rgba(0,0,0,0.7),
        0 8px 24px rgba(0,0,0,0.85);
    color: #f0d080;
    padding: 18px 22px;
    display: flex; flex-direction: column; gap: 10px;
    position: relative;
`;
overlay.appendChild(panel);

// canto-superior dourado decorativo
panel.insertAdjacentHTML('afterbegin', `
    <div style="position:absolute;inset:6px;border:1px solid #c8a96e;border-radius:8px;pointer-events:none;"></div>
`);

// título
const titulo = document.createElement('div');
titulo.innerHTML = `⚜ INVENTÁRIO ⚜`;
titulo.style.cssText = `
    text-align: center;
    font-size: 22px; font-weight: bold; letter-spacing: 4px;
    color: #f0d080;
    text-shadow: 0 0 10px #a07000, 2px 2px 0 #000;
    border-bottom: 1px solid #8a6a30;
    padding-bottom: 8px;
    margin-bottom: 4px;
`;
panel.appendChild(titulo);

// instrução
const dica = document.createElement('div');
dica.style.cssText = 'font-size:12px;color:#c8a96e;text-align:center;margin-bottom:4px;font-family:"Courier New",monospace;letter-spacing:1px;';
dica.textContent = 'Clica num item para o usar — I/ESC para fechar';
panel.appendChild(dica);

// lista de itens
const listaEl = document.createElement('div');
listaEl.style.cssText = `
    display: flex; flex-direction: column; gap: 8px;
    overflow-y: auto;
    padding-right: 4px;
    max-height: 50vh;
`;
panel.appendChild(listaEl);

// linha de mensagem (feedback do uso)
const msgEl = document.createElement('div');
msgEl.style.cssText = `
    min-height: 22px;
    text-align: center;
    font-size: 14px; color: #ffe0a0;
    text-shadow: 0 0 6px #a07000, 1px 1px 0 #000;
    border-top: 1px solid #6a5020;
    padding-top: 8px;
`;
panel.appendChild(msgEl);

// rodapé com HP atual
const hpRodape = document.createElement('div');
hpRodape.style.cssText = `
    text-align: center;
    font-size: 13px;
    color: #ffb0b0;
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
`;
panel.appendChild(hpRodape);

// ---- desenhar ----
function renderItens() {
    listaEl.innerHTML = '';
    const itens = getItens();
    const usaveis = itens.filter(i => i.quantidade > 0);

    if (usaveis.length === 0) {
        const vazio = document.createElement('div');
        vazio.style.cssText = 'text-align:center;color:#a08050;font-style:italic;padding:18px;';
        vazio.textContent = '— a tua mochila está vazia —';
        listaEl.appendChild(vazio);
        return;
    }

    for (const item of usaveis) {
        const equipavel = item.efeito && item.efeito.tipo === 'equipar';
        const equipado  = equipavel && playerStats.equipped[item.efeito.slot] === item.id;
        const row = document.createElement('button');
        row.style.cssText = `
            display: flex; align-items: center; gap: 12px;
            background: linear-gradient(180deg, rgba(80,50,20,0.8), rgba(40,25,10,0.95));
            border: 1px solid #c8a96e;
            border-radius: 8px;
            padding: 10px 14px;
            color: #f0d080;
            font-family: 'Georgia', serif;
            font-size: 16px;
            cursor: pointer;
            text-align: left;
            transition: transform 0.08s, box-shadow 0.2s, background 0.2s;
            box-shadow: inset 0 0 6px rgba(0,0,0,0.6);
        `;
        row.innerHTML = `
            <span style="font-size:24px;line-height:1;">${item.icone || '◆'}</span>
            <span style="flex:1;">
                <div style="font-weight:bold;letter-spacing:1px;">${item.nome}</div>
                <div style="font-size:11px;color:#c8a96e;font-style:italic;">${item.descricao || ''}</div>
            </span>
            ${equipavel
                ? `<span style="background:${equipado ? 'rgba(60,200,120,0.25)' : 'rgba(0,0,0,0.5)'};border:1px solid ${equipado ? '#aaffbb' : '#8a6a30'};color:${equipado ? '#aaffbb' : '#f0d080'};border-radius:4px;padding:2px 8px;font-size:12px;letter-spacing:1px;">${equipado ? 'EQUIPADO' : 'EQUIPAR'}</span>`
                : `<span style="background:rgba(0,0,0,0.5);border:1px solid #8a6a30;border-radius:4px;padding:2px 8px;font-size:13px;">x${item.quantidade}</span>`}
        `;
        row.onmouseenter = () => {
            row.style.transform = 'translateX(2px)';
            row.style.boxShadow = '0 0 14px rgba(220,160,60,0.55), inset 0 0 8px rgba(80,50,20,0.6)';
        };
        row.onmouseleave = () => {
            row.style.transform = 'translateX(0)';
            row.style.boxShadow = 'inset 0 0 6px rgba(0,0,0,0.6)';
        };
        row.onclick = () => {
            const r = usarItem(item.id);
            msgEl.textContent = r.mensagem;
            msgEl.style.color = r.ok ? '#aaffbb' : '#ff9090';
            renderItens();   // atualiza quantidades
            atualizarHUD();  // mostra HP novo
            renderHpRodape();
        };
        listaEl.appendChild(row);
    }
}

function renderHpRodape() {
    hpRodape.textContent = `HP ${playerStats.hp} / ${playerStats.maxHp}` + (playerStats.derrotado ? ' ⟡ em recuperação ⟡' : '');
}

// re-render se o stock mudar fora da UI (ex: vitória dropa item)
registarOnChange(() => { if (_aberto) renderItens(); });

// ---- abrir / fechar ----
export function abrirInventario() {
    if (_bloqueado || _aberto) return;
    _aberto = true;
    msgEl.textContent = '';
    renderItens();
    renderHpRodape();
    overlay.style.display = 'flex';
}

export function fecharInventario() {
    _aberto = false;
    overlay.style.display = 'none';
}

// fecha com clique fora do painel
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fecharInventario();
});

// ESC fecha
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _aberto) {
        e.stopPropagation();
        fecharInventario();
    }
});
