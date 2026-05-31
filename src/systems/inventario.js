import { playerStats, curar, recalcularMaxHp } from './player-stats.js';

// ----------------------------------------------------------------------
// CATÁLOGO DE OBJECTOS — definição estática (id → metadados + efeito)
// ----------------------------------------------------------------------
export const CATALOGO = {
    pocao:    { id: 'pocao',  nome: 'Poção de Cura',    descricao: 'Restaura 15 pontos de vida.',  efeito: { tipo: 'curar', valor: 15 }, icone: 'assets/icones/small_potion.png' },
    mega:     { id: 'mega',   nome: 'Poção Lunar',          descricao: 'Restaura 30 pontos de vida.',  efeito: { tipo: 'curar', valor: 30 }, icone: 'assets/icones/big_potion.png' },
    elixir:   { id: 'elixir', nome: 'Elixir do Abismo',  descricao: 'Restaura a tua vida por completo.', efeito: { tipo: 'curarTotal' },    icone: 'assets/icones/elixir_corrupto.png' },
    coroa_magica: {
        id: 'coroa_magica',
        nome: 'Coroa da Pedra Mágica',
        descricao: 'Artefacto. Aumenta a tua força de ataque em 10%.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: 'assets/icones/magic_stone_crown.png',
        equipMsg: 'Equipaste a Coroa. O teu ataque tem agora mais 10% de força!',
    },
    brincos_vida: {
        id: 'brincos_vida',
        nome: 'Brincos da Aurora',
        descricao: 'Artefacto. Dá-te mais 10 pontos de vida máxima.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: 'assets/icones/aurora_earrings.png',
        equipMsg: 'Estás a usar os Brincos. A tua vida máxima aumentou!',
    },
    oculos_carga: {
        id: 'oculos_carga',
        nome: 'Óculos do Vidente',
        descricao: 'Artefacto. Permitem prever o próximo golpe do adversário.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: 'assets/icones/oculos.png',
        equipMsg: 'Colocaste os Óculos. Agora consegues ver o futuro dos teus inimigos.',
    },
    aureola_caidos: {
        id: 'aureola_caidos',
        nome: 'Auréola dos Caídos',
        descricao: 'Artefacto. Restaura 5 pontos de vida depois de cada vitória em batalha.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: 'assets/icones/halo_of_the_fallen.png',
        equipMsg: 'A Auréola brilha sobre ti. Vais recuperar vida depois de cada vitória.',
    },
    mascara_eclipse: {
        id: 'mascara_eclipse',
        nome: 'Máscara do Eclipse',
        descricao: 'Artefacto. Dá 25% de probabilidade de desviar de ataques inimigos.',
        efeito: { tipo: 'equipar', slot: 'acessorio' },
        icone: 'assets/icones/mascara_eclipse.png',
        equipMsg: 'Equipaste a Máscara. Agora moves-te como uma sombra, com 25% de esquiva.',
    },
    tocha: {
        id: 'tocha',
        nome: 'Tocha do Viajante',
        descricao: 'Usa-a para iluminar o caminho no escuro da noite.',
        efeito: { tipo: 'equipar', slot: 'mao' },
        icone: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' shape-rendering='crispEdges'><path fill='%234a2f1a' d='M14,18h4v14h-4z'/><path fill='%232b2b2b' d='M12,14h8v4h-8z'/><path fill='%23ff5a18' d='M11,10h2v4h6v-4h2v-2h-2v-2h-2v-2h-6v2h-2v2h-2z'/><path fill='%23ffaa00' d='M13,8h6v4h-6z M14,6h4v2h-4z M15,4h2v2h-2z'/><path fill='%23ffffcc' d='M15,8h2v2h-2z' opacity='0.6'/></svg>",
        equipMsg: 'Equipaste a Tocha. A sua chama afasta a escuridão da noite.',
    },
};

// ouvintes para mudanças de equipamento (herói 3D, HUD, etc.)
const _equipListeners = new Set();
export function registarOnEquipChange(fn) { _equipListeners.add(fn); }
function notificarEquip() { _equipListeners.forEach(fn => { try { fn(); } catch {} }); }

// ----------------------------------------------------------------------
// ESTADO DO INVENTÁRIO — { id → quantidade }
// ----------------------------------------------------------------------
// O herói parte sem haveres — excepto a Tocha do Viajante, que leva consigo.
// As poções iniciais encontram-se no baú do aposento.
const _stock = { pocao: 0, mega: 0, elixir: 0, coroa_magica: 0, brincos_vida: 0, oculos_carga: 0, aureola_caidos: 0, mascara_eclipse: 0, tocha: 1 };

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
    if (!temItem(id)) return { ok: false, motivo: 'sem-stock', mensagem: 'Não tens esse item.' };

    const ef = item.efeito;
    if (ef.tipo === 'curar') {
        if (playerStats.hp >= playerStats.maxHp) {
            return { ok: false, motivo: 'hp-cheio', mensagem: 'A tua vida já está no máximo.' };
        }
        const antes = playerStats.hp;
        curar(ef.valor);
        const recuperado = playerStats.hp - antes;
        removerItem(id, 1);
        return { ok: true, mensagem: `Usaste ${item.nome}. Recuperaste ${recuperado} pontos de vida.` };
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
        // Apenas 1 artefacto por vez: substitui o que estiver no slot.
        playerStats.equipped[slot] = id;
        recalcularMaxHp();
        notificarEquip();
        return { ok: true, mensagem: item.equipMsg || `Equipaste ${item.nome}.` };
    }

    if (ef.tipo === 'curarTotal') {
        if (playerStats.hp >= playerStats.maxHp) {
            return { ok: false, motivo: 'hp-cheio', mensagem: 'A tua vida já está no máximo.' };
        }
        const antes = playerStats.hp;
        curar(playerStats.maxHp);
        const recuperado = playerStats.hp - antes;
        removerItem(id, 1);
        return { ok: true, mensagem: `Usaste ${item.nome}. A tua vida foi totalmente restaurada.` };
    }

    return { ok: false, motivo: 'sem-efeito', mensagem: 'Este item ainda não tem utilidade.' };
}
