import { playerStats, curar, recalcularMaxHp } from './player-stats.js';

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
        descricao: 'Acessório. +10% de ataque.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '👑',
        equipMsg: 'Equipaste a Coroa. +10% ATK!',
    },
    brincos_vida: {
        id: 'brincos_vida',
        nome: 'Brincos da Aurora',
        descricao: 'Acessório. +10 HP máximo.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '💎',
        equipMsg: 'Equipaste os Brincos. +10 HP máx.',
    },
    oculos_carga: {
        id: 'oculos_carga',
        nome: 'Óculos do Vidente',
        descricao: 'Acessório. Revelam o próximo ataque do inimigo em combate.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '🕶',
        equipMsg: 'Equipaste os Óculos. Vês o que aí vem.',
    },
    aureola_caidos: {
        id: 'aureola_caidos',
        nome: 'Auréola dos Caídos',
        descricao: 'Acessório. Recupera 5 HP no fim de cada combate vencido.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '😇',
        equipMsg: 'Equipaste a Auréola. +5 HP após cada vitória.',
    },
    mascara_eclipse: {
        id: 'mascara_eclipse',
        nome: 'Máscara do Eclipse',
        descricao: 'Acessório. 25% de chance de evitar o dano de um ataque.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '🌑',
        equipMsg: 'Equipaste a Máscara. 25% de esquiva.',
    },
};

// listeners para mudanças de equipamento (jogador 3D, HUD, etc.)
const _equipListeners = new Set();
export function registarOnEquipChange(fn) { _equipListeners.add(fn); }
function notificarEquip() { _equipListeners.forEach(fn => { try { fn(); } catch {} }); }

// ----------------------------------------------------------------------
// ESTADO DO INVENTÁRIO — { id → quantidade }
// ----------------------------------------------------------------------
// O jogador arranca sem itens. As poções iniciais vêm do baú do quarto.
const _stock = { pocao: 0, mega: 0, elixir: 0, coroa_magica: 0, brincos_vida: 0, oculos_carga: 0, aureola_caidos: 0, mascara_eclipse: 0 };

let _onChange = null;
export function registarOnChange(cb) { _onChange = cb; }
function notificar() { if (_onChange) _onChange(); }

// ---- consultas ----
export function getItens() {
    // devolve apenas os que existem no stock (mesmo qtd 0 — UI decide)
    return Object.keys(CATALOGO).map(id => {
        const item = CATALOGO[id];
        const equipavel = item.efeito && item.efeito.tipo === 'equipar';
        return {
            ...item,
            quantidade: _stock[id] || 0,
            equipado: equipavel && playerStats.equipped[item.efeito.slot] === id,
        };
    });
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
            recalcularMaxHp();
            notificarEquip();
            return { ok: true, mensagem: `Removeste ${item.nome}.` };
        }
        // Apenas 1 acessório por vez: substitui o que estiver no slot.
        playerStats.equipped[slot] = id;
        recalcularMaxHp();
        notificarEquip();
        return { ok: true, mensagem: item.equipMsg || `Equipaste ${item.nome}.` };
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
