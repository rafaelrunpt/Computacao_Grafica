// Loja do bartender — poções + ataques desbloqueáveis.
// Pago em Cintilas. Reaproveita as APIs: adicionarItem, gastarCintilas,
// temCintilas, desbloquearAtaque, ataqueState.
import { adicionarItem, CATALOGO } from '../systems/inventario.js';
import { getCintilas, gastarCintilas, onCintilasChange } from '../systems/currency.js';
import { ATAQUES, ataqueState, desbloquearAtaque, equiparAtaque } from '../systems/ataques.js';

const POCOES = [
    { id: 'pocao',  preco: 25, nome: 'Poção de Cura', desc: 'Recupera 15 HP.',           icone: '🧪' },
    { id: 'mega',   preco: 60, nome: 'Poção Maior',   desc: 'Recupera 30 HP.',           icone: '🧴' },
    { id: 'elixir', preco: 140, nome: 'Elixir',       desc: 'Recupera totalmente o HP.', icone: '⚗' },
];

const ATAQUES_VENDA = [
    { id: 'investida',       preco: 120 },
    { id: 'combo_duplo',     preco: 100 },
    { id: 'golpe_giratorio', preco: 160 }, // ataque normal (físico)
];

let _root = null;
let _aberto = false;
let _onClose = null;

function build() {
    if (_root) return _root;
    _root = document.createElement('div');
    _root.id = 'bartender-shop-root';
    _root.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.65);
        display: none; align-items: center; justify-content: center;
        z-index: 550;
        font-family: 'Courier New', monospace;
    `;
    _root.innerHTML = `
        <div id="bs-panel" style="
            width: min(820px, 94vw);
            max-height: 86vh; overflow-y: auto;
            background: linear-gradient(180deg, #1a120a, #0d0805);
            border: 2px solid #b07840; border-radius: 16px;
            padding: 22px 26px;
            color: #f0d9a8;
            box-shadow: 0 0 30px rgba(180,100,40,0.6);
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div style="font-size:22px;font-weight:bold;letter-spacing:2px;">⚜ TABERNA DO GOBLIN ⚜</div>
                <div style="font-size:16px;color:#cde2ff;"><span style="color:#a0c8ff">✦</span> <span id="bs-cintilas">0</span></div>
            </div>
            <div style="font-size:13px;color:#a08060;margin-bottom:18px;">"Bebe, lê e fica forte. Aqui não há almoços grátis."</div>

            <div style="font-size:16px;color:#e8c870;margin:6px 0 8px;border-bottom:1px solid #5a3a20;padding-bottom:4px;">Poções</div>
            <div id="bs-pocoes" style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;"></div>

            <div style="font-size:16px;color:#e8c870;margin:6px 0 8px;border-bottom:1px solid #5a3a20;padding-bottom:4px;">Ataques</div>
            <div id="bs-ataques" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;"></div>

            <div style="display:flex;justify-content:flex-end;margin-top:8px;">
                <button id="bs-close" style="
                    background:#3a2010; color:#f0d9a8; border:1px solid #b07840;
                    padding: 8px 18px; cursor:pointer; border-radius:8px;
                    font-family:'Courier New',monospace; font-size:14px; letter-spacing:1px;
                ">FECHAR (ESC)</button>
            </div>
        </div>
    `;
    document.body.appendChild(_root);
    _root.querySelector('#bs-close').addEventListener('click', fechar);
    _root.addEventListener('click', (e) => { if (e.target === _root) fechar(); });
    onCintilasChange((v) => {
        const el = document.getElementById('bs-cintilas');
        if (el) el.textContent = String(v);
    });
    return _root;
}

function rowItem({ icone, nome, desc, precoLabel, btnLabel, btnDisabled, onBuy, badge }) {
    const row = document.createElement('div');
    row.style.cssText = `
        display:flex; align-items:center; gap:12px;
        background: rgba(40,24,12,0.6);
        border: 1px solid #5a3a20; border-radius: 10px;
        padding: 10px 14px;
    `;
    row.innerHTML = `
        <div style="font-size:26px;width:34px;text-align:center;">${icone}</div>
        <div style="flex:1;">
            <div style="font-size:15px;color:#f0d9a8;">${nome} ${badge || ''}</div>
            <div style="font-size:12px;color:#a08060;">${desc}</div>
        </div>
        <div style="color:#cde2ff;font-size:14px;min-width:80px;text-align:right;">${precoLabel}</div>
        <button style="
            background:${btnDisabled ? '#2a1a10' : '#5a3818'};
            color:${btnDisabled ? '#604030' : '#f0d9a8'};
            border:1px solid ${btnDisabled ? '#4a2a18' : '#b07840'};
            padding:7px 14px; border-radius:6px;
            cursor:${btnDisabled ? 'not-allowed' : 'pointer'};
            font-family:'Courier New',monospace; font-size:13px; letter-spacing:1px;
            min-width: 100px;
        " ${btnDisabled ? 'disabled' : ''}>${btnLabel}</button>
    `;
    if (!btnDisabled) row.querySelector('button').addEventListener('click', onBuy);
    return row;
}

function renderListas() {
    const pocoesEl = _root.querySelector('#bs-pocoes');
    const ataquesEl = _root.querySelector('#bs-ataques');
    pocoesEl.innerHTML = '';
    ataquesEl.innerHTML = '';

    const c = getCintilas();
    document.getElementById('bs-cintilas').textContent = String(c);

    for (const p of POCOES) {
        const podeComprar = c >= p.preco;
        pocoesEl.appendChild(rowItem({
            icone: p.icone, nome: p.nome, desc: p.desc,
            precoLabel: `✦ ${p.preco}`,
            btnLabel: 'COMPRAR',
            btnDisabled: !podeComprar,
            onBuy: () => {
                if (!gastarCintilas(p.preco)) return;
                adicionarItem(p.id, 1);
                renderListas();
            },
        }));
    }

    for (const a of ATAQUES_VENDA) {
        const at = ATAQUES[a.id];
        if (!at) continue;
        const jaTem = ataqueState.desbloqueados.has(a.id);
        const podeComprar = !jaTem && c >= a.preco;
        ataquesEl.appendChild(rowItem({
            icone: at.icone,
            nome: at.nome,
            desc: at.desc,
            badge: jaTem ? '<span style="color:#88dd88;font-size:11px;margin-left:6px;">[DESBLOQUEADO]</span>' : '',
            precoLabel: jaTem ? '—' : `✦ ${a.preco}`,
            btnLabel: jaTem ? 'OBTIDO' : 'APRENDER',
            btnDisabled: jaTem || !podeComprar,
            onBuy: () => {
                if (!gastarCintilas(a.preco)) return;
                desbloquearAtaque(a.id);
                // se houver slot livre, equipa automaticamente
                const slotLivre = ataqueState.slots.indexOf(null);
                if (slotLivre !== -1) equiparAtaque(slotLivre, a.id);
                renderListas();
            },
        }));
    }
}

let _onKey = null;
export function abrirBartenderShop(onClose) {
    build();
    _onClose = onClose || null;
    _aberto = true;
    _root.style.display = 'flex';
    renderListas();
    _onKey = (e) => {
        if (e.code === 'Escape') { e.preventDefault(); fechar(); }
    };
    window.addEventListener('keydown', _onKey);
}

function fechar() {
    if (!_aberto) return;
    _aberto = false;
    _root.style.display = 'none';
    if (_onKey) { window.removeEventListener('keydown', _onKey); _onKey = null; }
    if (_onClose) _onClose();
}

export function isBartenderShopAberta() { return _aberto; }
