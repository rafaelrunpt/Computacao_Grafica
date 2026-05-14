// Quest simples do mercador: derrotar N inimigos e voltar para receber recompensa.

const META = 3;

const state = {
    fase: 'none',   // 'none' | 'ativa' | 'completa' | 'entregue'
    abates: 0,
};

const listeners = new Set();
function notify() { listeners.forEach(fn => { try { fn(); } catch {} }); }

export function getQuestState() { return { ...state, meta: META }; }
export function getQuestMeta() { return META; }
export function getQuestFase() { return state.fase; }

export function aceitarQuest() {
    if (state.fase !== 'none') return false;
    state.fase = 'ativa';
    state.abates = 0;
    notify();
    return true;
}

export function entregarQuest() {
    if (state.fase !== 'completa') return false;
    state.fase = 'entregue';
    notify();
    return true;
}

// Chamado pelo sistema de combate sempre que o jogador vence.
export function notificarVitoria() {
    if (state.fase !== 'ativa') return;
    state.abates++;
    if (state.abates >= META) state.fase = 'completa';
    notify();
}

export function onQuestChange(fn) { listeners.add(fn); }
