// Quest da Alice (mercadora): ela estuda os mistérios do espaço e crê que
// toda a magia teve origem nas estrelas. Pede ao jogador que recolha quatro
// AMOSTRAS ESTELARES — fragmentos de céu que tombam do firmamento (ver a
// cinemática em world/space-quest-cutscene.js). Os ids mantêm-se (são usados
// pelo save/colecta); só a apresentação passou a ser de tema espacial.

export const ITENS_PERDIDOS = [
    { id: 'saco_moedas',  nome: 'Centelha Estelar',     icone: '✨', cor: 0xffd24a, pos: { x:  22, z:  18 } },
    { id: 'pergaminho',   nome: 'Pó de Nebulosa',       icone: '🌫️', cor: 0xeae0c8, pos: { x: -33, z:  24 } },
    { id: 'anel',         nome: 'Esquírola de Meteoro', icone: '☄️', cor: 0xff9aa0, pos: { x:  48, z: -22 } },
    { id: 'pendente',     nome: 'Cristal de Cometa',    icone: '🔷', cor: 0x88aaff, pos: { x: -54, z: -48 } },
];

const META = ITENS_PERDIDOS.length;

const state = {
    fase: 'none',                    // 'none' | 'ativa' | 'completa' | 'entregue'
    coletados: new Set(),
    cutsceneVista: false,            // a cinemática da chuva de amostras já tocou?
    itensRevelados: false,           // os itens já existem no mundo? (só após a cutscene)
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

// --- cinemática da chuva de amostras ---
// Deve tocar uma única vez: na primeira saída da loja depois de a quest
// ter sido aceite.
export function precisaCutsceneEspaco() {
    return state.fase !== 'none' && !state.cutsceneVista;
}
export function marcarCutsceneVista() { state.cutsceneVista = true; }

// --- revelação dos itens ---
// Os itens só passam a existir no mundo (mesh + waypoint) depois de a
// cinemática terminar: vê-se primeiro a chuva de amostras, e só então
// ficam disponíveis para recolha.
export function revelarItensEstelares() {
    if (state.itensRevelados) return;
    state.itensRevelados = true;
    notify();
}
export function itensEstelaresRevelados() { return state.itensRevelados; }

export function onFetchQuestChange(fn) { listeners.add(fn); }
