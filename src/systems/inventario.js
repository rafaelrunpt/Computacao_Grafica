import { playerStats, curar } from './player-stats.js';

// ----------------------------------------------------------------------
// CATÁLOGO DE ITENS — definição estática (id → metadados + efeito)
// ----------------------------------------------------------------------
export const CATALOGO = {
    pocao:    { id: 'pocao',  nome: 'Poção de Cura',    descricao: 'Recupera 15 HP.',  efeito: { tipo: 'curar', valor: 15 }, icone: '🧪' },
    mega:     { id: 'mega',   nome: 'Poção Maior',      descricao: 'Recupera 30 HP.',  efeito: { tipo: 'curar', valor: 30 }, icone: '🧴' },
    elixir:   { id: 'elixir', nome: 'Elixir Corrompido', descricao: 'Recupera totalmente o HP.', efeito: { tipo: 'curarTotal' },    icone: '⚗' },
    coroa_magica: {
        id: 'coroa_magica',
        nome: 'Coroa da Pedra Mágica',
        descricao: 'Equipável (cabeça). +10% de ataque.',
        efeito: { tipo: 'equipar', slot: 'cabeca' },
        icone: '👑',
    },
};

// listeners para mudanças de equipamento (jogador 3D, HUD, etc.)
const _equipListeners = new Set();
export function registarOnEquipChange(fn) { _equipListeners.add(fn); }
function notificarEquip() { _equipListeners.forEach(fn => { try { fn(); } catch {} }); }

// ----------------------------------------------------------------------
// ESTADO DO INVENTÁRIO — { id → quantidade }
// ----------------------------------------------------------------------
const _stock = { pocao: 3, mega: 1, elixir: 0, coroa_magica: 0 };

let _onChange = null;
export function registarOnChange(cb) { _onChange = cb; }
function notificar() { if (_onChange) _onChange(); }

// ---- consultas ----
export function getItens() {
    // devolve apenas os que existem no stock (mesmo qtd 0 — UI decide)
    return Object.keys(CATALOGO).map(id => ({
        ...CATALOGO[id],
        quantidade: _stock[id] || 0,
    }));
}

export function temItem(id) { return (_stock[id] || 0) > 0; }
export function quantidade(id) { return _stock[id] || 0; }

// ---- mutação ----
export function adicionarItem(id, qtd = 1) {
    if (!CATALOGO[id]) return false;
    _stock[id] = (_stock[id] || 0) + qtd;
    notificar();
    return true;
}

export function removerItem(id, qtd = 1) {
    if (!_stock[id] || _stock[id] < qtd) return false;
    _stock[id] -= qtd;
    notificar();
    return true;
}

// ----------------------------------------------------------------------
// USAR UM ITEM — aplica o efeito e decrementa quantidade.
// Devolve { ok, motivo, mensagem } para a UI mostrar feedback.
// ----------------------------------------------------------------------
export function usarItem(id) {
    const item = CATALOGO[id];
    if (!item) return { ok: false, motivo: 'desconhecido', mensagem: 'Item desconhecido.' };
    if (!temItem(id)) return { ok: false, motivo: 'sem-stock', mensagem: 'Não tens nenhum.' };

    const ef = item.efeito;
    if (ef.tipo === 'curar') {
        if (playerStats.hp >= playerStats.maxHp) {
            return { ok: false, motivo: 'hp-cheio', mensagem: 'HP já está no máximo.' };
        }
        const antes = playerStats.hp;
        curar(ef.valor);
        const recuperado = playerStats.hp - antes;
        removerItem(id, 1);
        return { ok: true, mensagem: `Usaste ${item.nome}. +${recuperado} HP.` };
    }

    if (ef.tipo === 'equipar') {
        const slot = ef.slot;
        const atual = playerStats.equipped[slot] || null;
        if (atual === id) {
            // já equipado → desequipar
            playerStats.equipped[slot] = null;
            notificarEquip();
            return { ok: true, mensagem: `Removeste a ${item.nome}.` };
        }
        playerStats.equipped[slot] = id;
        notificarEquip();
        return { ok: true, mensagem: `Equipaste a ${item.nome}. +10% ATK!` };
    }

    if (ef.tipo === 'curarTotal') {
        if (playerStats.hp >= playerStats.maxHp) {
            return { ok: false, motivo: 'hp-cheio', mensagem: 'HP já está no máximo.' };
        }
        const antes = playerStats.hp;
        curar(playerStats.maxHp);
        const recuperado = playerStats.hp - antes;
        removerItem(id, 1);
        return { ok: true, mensagem: `Usaste ${item.nome}. +${recuperado} HP.` };
    }

    return { ok: false, motivo: 'sem-efeito', mensagem: 'Este item ainda não faz nada.' };
}
