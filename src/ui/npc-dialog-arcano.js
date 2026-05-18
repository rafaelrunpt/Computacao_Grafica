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
    posPassagem: [
        'A ponte está aberta para ti, viajante. Em que posso ajudar-te?',
        'Voltaste. Diz lá — o que te traz cá?',
        'A passagem é tua. Fala, se quiseres.',
    ],
    cedePassagem: [
        'Sinto em ti um poder que antes não estava. A ponte é tua, guerreiro — passa.',
        'O teu espírito mudou desde a última vez que aqui estiveste. Reconheço a força em ti. Passa.',
        'Esta presença... carregas agora o peso de verdadeiras batalhas. Não te detenho mais. Vai.',
    ],
};

const ESCOLHAS = {
    fraco: [
        { id: 'requisito', label: 'O que tenho de fazer para passar?',
          respostas: [
            'Prova o teu valor em combate. Regressa quando tiveres crescido em experiência e poder.',
            'Enfrenta as criaturas destas terras. Quando o teu espírito for suficientemente forte, eu saberei.',
            'Não há atalho. Combate, aprende, cresce. Depois voltamos a falar.',
          ] },
        { id: 'norte_fraco', label: 'Que perigos há no norte?',
          respostas: [
            'Um castelo sombrio corrompido por uma força ancestral. Criaturas que outrora eram homens.',
            'O mal cresce a cada lua cheia nas terras do norte. O castelo é o verdadeiro perigo.',
            'Terras corrompidas, criaturas sem razão. Mas para atravessar, primeiro tens de me convencer com poder.',
          ] },
        { id: 'adeus', label: 'Adeus, guardião.', acao: 'fechar', repetivel: true,
          respostas: [
            'Vai com cuidado, jovem. E volta mais forte.',
            'Que os ventos te levem ao teu destino, viajante.',
            'Volta quando as tuas cicatrizes me convencerem.',
          ] },
    ],
    posPassagem: [
        { id: 'norte_pos', label: 'O que há no norte?',
          respostas: [
            'Um castelo corrompido por sombras antigas. Criaturas que já foram homens. Vai preparado.',
            'O mal cresce lá dentro há décadas. O que encontrares no castelo... não será simples de derrotar.',
            'Terras corrompidas e, no centro, um cristal negro que pulsa como um coração doente.',
          ] },
        { id: 'identidade_pos', label: 'Quem és tu, guardião?',
          respostas: [
            'Um guerreiro que escolheu o dever sobre a glória. Trezentos anos neste posto.',
            'O último da Ordem da Ponte. Os outros tombaram. Eu fico até que alguém leve a luta ao norte.',
            'Apenas um velho soldado com uma missão. E hoje, vejo em ti o que procurava.',
          ] },
        { id: 'adeus_pos', label: 'Adeus, guardião.', acao: 'fechar', repetivel: true,
          respostas: [
            'Que os teus passos sejam firmes e o teu aço verdadeiro.',
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
    // A passagem é concedida fora do diálogo (em main.js, quando o jogador
    // tem nível 2+ e interage). O diálogo serve apenas para conversar.
    const tier = passagemConcedida ? 'posPassagem' : 'fraco';
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
            setTimeout(() => {
                dlg.close();
                if (onPassar) onPassar();
            }, 0);
            return;
        }

        const meta = choice._meta;
        if (!meta) return;

        if (!meta.repetivel) usedIds.add(meta.id);

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

export function abrirDialogoGuardiao(level, callbackPassar, passouJa = false /*, themeKey */) {
    if (dialogoAberto) return;
    dialogoAberto = true;
    playerLevel = level;
    onPassar = callbackPassar;
    passagemConcedida = !!passouJa;

    const tier = passagemConcedida ? 'posPassagem' : 'fraco';
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

export function abrirDialogoGuardiaoCedePassagem(callbackPassar) {
    if (dialogoAberto) return;
    dialogoAberto = true;
    onPassar = callbackPassar;
    passagemConcedida = true;
    lastTier = 'posPassagem';

    ensureDialogue();

    const fala = pick(ABERTURA.cedePassagem);
    const npc = {
        name: 'Guardião',
        title: 'da Ponte',
        mono: 'G',
        portraitUrl: 'assets/textures/avatares/guardiao_avatar.png',
        portrait: { hue: 268, secondHue: 220 },
        start: 'cede',
        nodes: {
            cede: {
                text: fala,
                choices: [{ label: '⚔  Atravessar a ponte', to: '__passar_agora__' }],
            },
        },
    };
    dlg.registerNPC(NPC_ID, npc);
    dlg.open(NPC_ID);

    // intercept handler: this dialog has a single special choice
    // (já existe o listener de 'choice' geral; precisamos de reconhecer __passar_agora__)
}

export function fecharDialogo() {
    if (!dialogoAberto) return;
    if (dlg) dlg.close();
    dialogoAberto = false;
}

export function isDialogoAberto() {
    return dialogoAberto;
}
