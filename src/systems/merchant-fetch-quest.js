// Quest do mercador (Alice): encontrar os 4 itens perdidos numa emboscada.

export const ITENS_PERDIDOS = [
    { id: 'saco_moedas',  nome: 'Saco de Cintilas',   icone: '💰', cor: 0xffd24a, pos: { x:  22, z:  18 } },
    { id: 'pergaminho',   nome: 'Pergaminho de Alquimia', icone: '📜', cor: 0xeae0c8, pos: { x: -33, z:  24 } },
    { id: 'anel',         nome: 'Anel de Família',    icone: '💍', cor: 0xff9aa0, pos: { x:  48, z: -22 } },
    { id: 'pendente',     nome: 'Pendente Rúnico',    icone: '🔷', cor: 0x88aaff, pos: { x: -54, z: -48 } },
];

const META = ITENS_PERDIDOS.length;

const state = {
    fase: 'none',                    // 'none' | 'ativa' | 'completa' | 'entregue'
    coletados: new Set(),
};

const listeners = new Set();
function notify() { listeners.forEach(fn => { try { fn(state); } catch {} }); }

export function getFase()      { return state.fase; }
export function isAtiva()      { return state.fase === 'ativa' || state.fase === 'completa'; }
export function isCompleta()   { return state.fase === 'completa'; }
export function isEntregue()   { return state.fase === 'entregue'; }
export function getProgresso() { return { coletados: state.coletados.size, meta: META }; }
export function jaColetado(id) { return state.coletados.has(id); }

export function aceitarFetchQuest() {
    if (state.fase !== 'none') return false;
    state.fase = 'ativa';
    state.coletados.clear();
    notify();
    return true;
}

export function coletarItemPerdido(itemId) {
    if (state.fase !== 'ativa') return false;
    if (!ITENS_PERDIDOS.find(i => i.id === itemId)) return false;
    if (state.coletados.has(itemId)) return false;
    state.coletados.add(itemId);
    if (state.coletados.size >= META) state.fase = 'completa';
    notify();
    return true;
}

export function entregarFetchQuest() {
    if (state.fase !== 'completa') return false;
    state.fase = 'entregue';
    notify();
    return true;
}

export function onFetchQuestChange(fn) { listeners.add(fn); }
