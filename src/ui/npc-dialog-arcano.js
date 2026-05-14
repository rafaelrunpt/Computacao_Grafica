// Adapter: mesma API que npc-dialog.js, mas usa a UI ArcanoDialogue.
// Para alternar entre os dois, troca o import em src/core/main.js.
import './arcano-dialogue.js';

const ArcanoDialogue = window.ArcanoDialogue;

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const ABERTURA = {
    fraco: [
        'Alto! Esta ponte não é para qualquer viajante. Retorna quando o teu poder for digno de nota.',
        'Para! Sinto em ti a inexperiência de um novato. Esta travessia não te pertence... ainda.',
        'Nenhum passa sem provar o seu valor. Tu, estranho, ainda não o fizeste.',
    ],
    forte: [
        'Aproximas-te com o peso de muitas batalhas nos teus passos. Talvez sejas digno desta travessia.',
        'Reconheço a chama de um guerreiro experiente. Esta ponte pode ser tua... se assim o desejares.',
        'Paro-te por tradição, não por dúvida. Vejo em ti um espírito forjado em combate.',
    ],
};

const ESCOLHAS = {
    fraco: [
        { id: 'urgente', label: 'Preciso de passar — é urgente.',
          respostas: [
            'A urgência não substitui o valor, jovem. Volta quando as tuas cicatrizes contarem histórias.',
            'Muitos disseram o mesmo. Muitos regressaram sem passar. Cresce em poder, depois fala comigo.',
            'A pressa é fraqueza disfarçada. Nenhuma urgência abre esta passagem antes do tempo.',
          ] },
        { id: 'requisito', label: 'O que tenho de fazer para passar?',
          respostas: [
            'Prova o teu valor em combate. Regressa quando tiveres crescido em experiência e poder.',
            'Enfrenta as criaturas destas terras. Quando o teu espírito for suficientemente forte, eu saberei.',
            'Não há atalho. Combate, aprende, cresce. Depois voltamos a falar.',
          ] },
        { id: 'identidade_fraco', label: 'Quem és tu, guardião?',
          respostas: [
            'Sou o Guardião desta ponte há trezentos e quarenta anos. Nenhum indigno passou enquanto eu respirei.',
            'Um guerreiro ancião cuja armadura enferrujou mas cujo propósito nunca vacilou. Guardo esta travessia desde antes da tua avó nascer.',
            'O último de uma ordem esquecida. Os meus irmãos caíram. Eu fico. Esta ponte é o meu juramento.',
          ] },
        { id: 'norte_fraco', label: 'Que perigos há no norte?',
          respostas: [
            'Um castelo sombrio corrompido por uma força ancestral. Criaturas que outrora eram homens. Não és forte o suficiente... ainda.',
            'O mal cresce a cada lua cheia nas terras do norte. As zonas do sul onde vieste estão infestadas, mas o castelo é o verdadeiro perigo.',
            'O sábio da aldeia sabe mais do que diz sobre o que há no norte. Mas para atravessar, primeiro tens de me convencer com poder.',
          ] },
        { id: 'adeus', label: 'Adeus, guardião.', acao: 'fechar', repetivel: true,
          respostas: [
            'Vai com cuidado, jovem. E volta mais forte.',
            'Que os ventos te levem ao teu destino, viajante.',
            'Volta quando as tuas cicatrizes me convencerem.',
          ] },
    ],
    forte: [
        { id: 'passar', label: 'Quero atravessar a ponte.', acao: 'passar', repetivel: true,
          respostas: [
            'O teu valor está à vista. Passa, guerreiro — e que a tua lâmina seja afiada no que te espera.',
            'Reconheço a tua força. Esta ponte é tua. Vai, e não olhes para trás sem razão.',
            'Trezentos anos de guarda... e finalmente um digno passa. Vai. A tua missão aguarda-te.',
          ] },
        { id: 'norte_forte', label: 'O que há no norte?',
          respostas: [
            'Um castelo corrompido por sombras antigas. Criaturas que já foram homens. Vai preparado.',
            'O mal cresce lá dentro há décadas. O que encontrares no castelo... não será simples de derrotar.',
            'Terras corrompidas, criaturas sem razão, e no centro — um cristal negro que pulsa como um coração doente.',
          ] },
        { id: 'identidade_forte', label: 'Quem és tu, guardião?',
          respostas: [
            'Um guerreiro que escolheu o dever sobre a glória. Trezentos anos neste posto. Tu és dos poucos dignos que vi passar.',
            'O último da Ordem da Ponte. Os outros tombaram. Eu fico até que alguém suficientemente forte leve a luta ao norte.',
            'Apenas um velho soldado com uma missão. Mas hoje, vejo em ti o que procurava. Vai em frente.',
          ] },
        { id: 'adeus', label: 'Adeus, guardião.', acao: 'fechar', repetivel: true,
          respostas: [
            'Que os teus passos sejam firmes e o teu aço verdadeiro. Vai.',
            'A ponte está aberta para ti. Passa quando estiveres pronto.',
            'Boa sorte, guerreiro. Vais precisar dela.',
          ] },
    ],
};

let dialogoAberto = false;
let onPassar = null;
let playerLevel = 1;
let passagemConcedida = false;
let lastTier = null;
const usedIds = new Set();

let dlg = null;
const NPC_ID = 'guardiao';

function buildMenuChoices() {
    const tier = playerLevel >= 2 ? 'forte' : 'fraco';
    if (passagemConcedida) {
        return [{ label: '⚔  Atravessar a ponte', to: '__passar_agora__' }];
    }
    return ESCOLHAS[tier]
        .filter(e => e.repetivel || !usedIds.has(e.id))
        .map(e => ({
            label: e.label,
            to: 'resp_' + e.id,
            _meta: e,
        }));
}

function rebuildMenuNode(npc, openingText) {
    npc.nodes.menu = {
        text: openingText || '',
        choices: buildMenuChoices(),
    };
}

function ensureDialogue() {
    if (dlg) return dlg;
    dlg = new ArcanoDialogue({
        onClose: () => { dialogoAberto = false; },
    });
    dlg.on('choice', ({ choice }) => {
        const npc = dlg.npcs[NPC_ID];
        if (!npc) return;

        if (choice.to === '__passar_agora__') {
            // fecha e chama callback (a fechadura corre via dlg.close() já no framework)
            // mas o framework não fecha para to !== 'END'; forçamos.
            setTimeout(() => {
                dlg.close();
                if (onPassar) onPassar();
            }, 0);
            return;
        }

        const meta = choice._meta;
        if (!meta) return;

        if (!meta.repetivel) usedIds.add(meta.id);
        if (meta.acao === 'passar') passagemConcedida = true;

        const resposta = pick(meta.respostas);
        const isFechar = meta.acao === 'fechar';

        npc.nodes['resp_' + meta.id] = {
            text: resposta,
            // se fechar: terminal (advance fecha). Senão volta ao menu.
            ...(isFechar ? {} : { next: 'menu' }),
        };

        // Reconstruir menu já com novo estado (escolhas atualizadas)
        rebuildMenuNode(npc, '');
    });
    return dlg;
}

export function abrirDialogoGuardiao(level, callbackPassar /*, themeKey */) {
    if (dialogoAberto) return;
    dialogoAberto = true;
    playerLevel = level;
    onPassar = callbackPassar;
    passagemConcedida = false;

    const tier = level >= 2 ? 'forte' : 'fraco';
    if (tier !== lastTier) { usedIds.clear(); lastTier = tier; }

    ensureDialogue();

    const abertura = pick(ABERTURA[tier]);
    const npc = {
        name: 'Guardião',
        title: 'da Ponte',
        mono: 'G',
        portraitUrl: 'assets/textures/avatares/guardiao_avatar.png',
        portrait: { hue: 268, secondHue: 220 },
        start: 'menu',
        nodes: {},
    };
    dlg.registerNPC(NPC_ID, npc);
    rebuildMenuNode(npc, abertura);

    dlg.open(NPC_ID);
}

export function fecharDialogo() {
    if (!dialogoAberto) return;
    if (dlg) dlg.close();
    dialogoAberto = false;
}

export function isDialogoAberto() {
    return dialogoAberto;
}
