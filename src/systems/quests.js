// Sistema simples de encargos para o Códice (tecla B).
// Cada quest tem: id, title (curto), summary (descrição), discovered (true
// quando o jogador descobriu a pista), completed (true quando concluiu a
// tarefa). O painel só mostra quests com discovered === true.

import {
    getFase as getFetchFase, getProgresso as getFetchProgresso,
    onFetchQuestChange,
} from './merchant-fetch-quest.js';

export const QUESTS = {
    fetch_mercador: {
        id: 'fetch_mercador',
        title: 'Os Haveres da Mercadora',
        summary: 'A mercadora foi emboscada nas sendas e extraviou quatro artefactos de valia — saco, pergaminho, anel e pendente. Recuperai-os por estas terras e devolvei-lhos.',
        getProgresso: () => getFetchProgresso(),
    },
    coroa_magica: {
        id: 'coroa_magica',
        title: 'A Coroa da Pedra Mágica',
        summary: 'Demandai o baú selado a nordeste, além dos campos. Forçai a fechadura para libertar a Coroa e restituí-a à runa do castelo.',
    },
    brincos_vida: {
        id: 'brincos_vida',
        title: 'Os Brincos da Aurora',
        summary: 'Vencei cinco contendas para que os Brincos da Aurora se revelem. Depois, levai-os à runa correspondente no castelo.',
    },
    oculos_carga: {
        id: 'oculos_carga',
        title: 'Os Óculos do Vidente',
        summary: 'Visitai o mercador e adquiri os Óculos do Vidente por 20 ✦. Colocai-os depois sobre a runa do castelo.',
    },
    aureola_caidos: {
        id: 'aureola_caidos',
        title: 'A Auréola dos Caídos',
        summary: 'O estalajadeiro entregar-vos-á a Auréola dos Caídos quando todas as zonas corrompidas destas terras forem purificadas. Trazei-a à runa do castelo.',
    },
    mascara_eclipse: {
        id: 'mascara_eclipse',
        title: 'A Máscara do Eclipse',
        summary: 'No recanto mais recôndito a sudoeste, longe das sendas batidas, um baú esquecido guarda a Máscara do Eclipse. Forçai a fechadura e levai-a ao castelo.',
    },
};

// estado por quest
const _state = {};
for (const id of Object.keys(QUESTS)) {
    _state[id] = { discovered: false, completed: false };
}

const _listeners = new Set();
function _emit(evt) { for (const fn of _listeners) fn(evt); }

export function onQuestChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }

export function getQuest(id) {
    const q = QUESTS[id];
    if (!q) return null;
    const progresso = typeof q.getProgresso === 'function' ? q.getProgresso() : null;
    return { ...q, ...(_state[id] || {}), progresso };
}

export function getQuestsVisiveis() {
    return Object.keys(QUESTS)
        .filter(id => _state[id]?.discovered)
        .map(id => getQuest(id));
}

export function descobrirQuest(id) {
    const s = _state[id];
    if (!s || s.discovered) return false;
    s.discovered = true;
    _emit({ type: 'discovered', id });
    return true;
}

export function completarQuest(id) {
    const s = _state[id];
    if (!s || s.completed) return false;
    s.discovered = true;
    s.completed = true;
    _emit({ type: 'completed', id });
    return true;
}

export function isQuestDescoberta(id) { return !!_state[id]?.discovered; }
export function isQuestCompleta(id)   { return !!_state[id]?.completed; }

// Sincroniza a quest do mercador com o estado do sistema fetch-quest.
onFetchQuestChange(() => {
    const fase = getFetchFase();
    if (fase === 'none') return;
    descobrirQuest('fetch_mercador');
    if (fase === 'entregue') completarQuest('fetch_mercador');
    else _emit({ type: 'progress', id: 'fetch_mercador' });
});
