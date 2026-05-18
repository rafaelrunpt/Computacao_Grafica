import { playerStats, curar, recalcularMaxHp } from './player-stats.js';

// ----------------------------------------------------------------------
// CATÁLOGO DE OBJECTOS — definição estática (id → metadados + efeito)
// ----------------------------------------------------------------------
export const CATALOGO = {
    pocao:    { id: 'pocao',  nome: 'Poção de Cura',    descricao: 'Restaura 15 pontos de vida.',  efeito: { tipo: 'curar', valor: 15 }, icone: '🧪' },
    mega:     { id: 'mega',   nome: 'Poção de Grande Vigor', descricao: 'Restaura 30 pontos de vida.',  efeito: { tipo: 'curar', valor: 30 }, icone: '🧴' },
    elixir:   { id: 'elixir', nome: 'Elixir do Abismo',  descricao: 'Restaura a vossa vitalidade por completo.', efeito: { tipo: 'curarTotal' },    icone: '⚗' },
    coroa_magica: {
        id: 'coroa_magica',
        nome: 'Coroa da Pedra Mágica',
        descricao: 'Artefacto. Aumenta a vossa força de ataque em 10%.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '👑',
        equipMsg: 'Cingistes a Coroa. O vosso ataque flui com mais 10% de vigor!',
    },
    brincos_vida: {
        id: 'brincos_vida',
        nome: 'Brincos da Aurora',
        descricao: 'Artefacto. Concede-vos mais 10 pontos de vida máxima.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '💎',
        equipMsg: 'Usais agora os Brincos. A vossa vitalidade máxima aumentou!',
    },
    oculos_carga: {
        id: 'oculos_carga',
        nome: 'Óculos do Vidente',
        descricao: 'Artefacto. Permitem-vos prever o próximo golpe do adversário.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '🕶',
        equipMsg: 'Colocastes os Óculos. O futuro dos vossos inimigos é-vos agora revelado.',
    },
    aureola_caidos: {
        id: 'aureola_caidos',
        nome: 'Auréola dos Caídos',
        descricao: 'Artefacto. Restaura 5 pontos de vida após cada triunfo em batalha.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '😇',
        equipMsg: 'A Auréola brilha sobre vós. Recuperareis fôlego após cada vitória.',
    },
    mascara_eclipse: {
        id: 'mascara_eclipse',
        nome: 'Máscara do Eclipse',
        descricao: 'Artefacto. Concede 25% de probabilidade de evitar golpes inimigos.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: '🌑',
        equipMsg: 'Envergastes a Máscara. Moveis-vos agora como uma sombra, com 25% de esquiva.',
    },
};

// ouvintes para mudanças de equipamento (herói 3D, HUD, etc.)
const _equipListeners = new Set();
export function registarOnEquipChange(fn) { _equipListeners.add(fn); }
function notificarEquip() { _equipListeners.forEach(fn => { try { fn(); } catch {} }); }

// ----------------------------------------------------------------------
// ESTADO DO INVENTÁRIO — { id → quantidade }
// ----------------------------------------------------------------------
// O herói parte sem haveres. As poções iniciais encontram-se no baú do aposento.
const _stock = { pocao: 0, mega: 0, elixir: 0, coroa_magica: 0, brincos_vida: 0, oculos_carga: 0, aureola_caidos: 0, mascara_eclipse: 0 };

let _onChange = null;
export function registarOnChange(cb) { _onChange = cb; }
function notificar() { if (_onChange) _onChange(); }

// ---- consultas ----
export function getItens() {
    // devolve apenas os que existem no haver (mesmo qtd 0 — UI decide)
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
// USAR UM OBJECTO — aplica o efeito e subtrai à quantidade.
// Devolve { ok, motivo, mensagem } para a UI apresentar resposta.
// ----------------------------------------------------------------------
export function usarItem(id) {
    const item = CATALOGO[id];
    if (!item) return { ok: false, motivo: 'desconhecido', mensagem: 'Objecto desconhecido.' };
    if (!temItem(id)) return { ok: false, motivo: 'sem-stock', mensagem: 'Não possuís tal objecto.' };

    const ef = item.efeito;
    if (ef.tipo === 'curar') {
        if (playerStats.hp >= playerStats.maxHp) {
            return { ok: false, motivo: 'hp-cheio', mensagem: 'O vosso vigor já se encontra no máximo.' };
        }
        const antes = playerStats.hp;
        curar(ef.valor);
        const recuperado = playerStats.hp - antes;
        removerItem(id, 1);
        return { ok: true, mensagem: `Consumistes ${item.nome}. Recuperastes ${recuperado} pontos de vida.` };
    }

    if (ef.tipo === 'equipar') {
        const slot = ef.slot;
        const atual = playerStats.equipped[slot] || null;
        if (atual === id) {
            // já equipado → desequipar
            playerStats.equipped[slot] = null;
            recalcularMaxHp();
            notificarEquip();
            return { ok: true, mensagem: `Removestes ${item.nome}.` };
        }
        // Apenas 1 artefacto por vez: substitui o que estiver no slot.
        playerStats.equipped[slot] = id;
        recalcularMaxHp();
        notificarEquip();
        return { ok: true, mensagem: item.equipMsg || `Equipastes ${item.nome}.` };
    }

    if (ef.tipo === 'curarTotal') {
        if (playerStats.hp >= playerStats.maxHp) {
            return { ok: false, motivo: 'hp-cheio', mensagem: 'O vosso vigor já se encontra no máximo.' };
        }
        const antes = playerStats.hp;
        curar(playerStats.maxHp);
        const recuperado = playerStats.hp - antes;
        removerItem(id, 1);
        return { ok: true, mensagem: `Consumistes ${item.nome}. O vosso fôlego foi totalmente restaurado.` };
    }

    return { ok: false, motivo: 'sem-efeito', mensagem: 'Este objecto ainda não possui serventia.' };
}
