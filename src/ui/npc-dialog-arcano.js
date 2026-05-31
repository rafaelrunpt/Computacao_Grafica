// Adapter: mesma API que npc-dialog.js, mas usa a UI ArcanoDialogue.
// Para alternar entre os dois, troca o import em src/core/main.js.
import './arcano-dialogue.js';
import { limparTutoriais } from './tutorial.js';

const ArcanoDialogue = window.ArcanoDialogue;

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const ABERTURA = {
    fraco: [
        'Alto! Esta ponte não é para qualquer um. Volta quando fores mais forte.',
        'Para o passo! Sinto que ainda és um principiante. Esta travessia não é para ti... ainda.',
        'Ninguém passa sem provar o seu valor. Tu ainda não o fizeste.',
    ],
    posPassagem: [
        'A ponte está aberta para ti, viajante. Como posso ajudar?',
        'Voltaste. Diz-me — o que te traz por aqui?',
        'A passagem é tua. Fala, se quiseres.',
    ],
    cedePassagem: [
        'Sinto em ti um poder que antes não tinhas. A ponte é tua, guerreiro — podes passar.',
        'O teu espírito mudou desde a última vez. Reconheço a tua força. Passa.',
        'Esta presença... carregas agora o fardo de verdadeiras lutas. Não te prendo mais. Podes ir.',
    ],
};


const ESCOLHAS = {
    fraco: [
        { id: 'requisito', label: 'O que tenho de fazer para passar?',
          respostas: [
            'Prova o teu valor em combate. Volta quando tiveres mais sabedoria e poder.',
            'Enfrenta as criaturas que andam por estas terras. Quando fores suficientemente forte, eu saberei.',
            'Não há atalhos para a glória. Luta, aprende e cresce. Depois voltamos a falar.',
          ] },
        { id: 'norte_fraco', label: 'Que perigos existem no norte?',
          respostas: [
            'Um forte sombrio, dominado por uma força antiga. Criaturas que antes eram homens.',
            'O mal cresce a cada lua cheia nas terras do norte. O castelo é a verdadeira maldição.',
            'Terras corrompidas e feras perigosas. Mas para passar, primeiro tens de me convencer com a tua coragem.',
          ] },
        { id: 'adeus', label: 'Fica bem, guardião.', acao: 'fechar', repetivel: true,
          respostas: [
            'Vai com cuidado. E volta mais forte.',
            'Que os ventos te levem ao teu destino.',
            'Volta quando as tuas cicatrizes forem a tua prova.',
          ] },
    ],
    posPassagem: [
        { id: 'norte_pos', label: 'O que me espera no norte?',
          respostas: [
            'Um castelo assombrado por sombras do passado. Criaturas que já foram homens. Vai bem preparado.',
            'O mal vive ali há décadas. O que encontrares no castelo... não será fácil de derrotar.',
            'Terras sofridas e, no centro, um cristal negro que pulsa como um coração doente.',
          ] },
        { id: 'identidade_pos', label: 'Quem és tu, guardião?',
          respostas: [
            'Um soldado que escolheu o dever em vez da glória. Cumpro este posto há trezentos anos.',
            'O último da Ordem da Ponte. Os meus irmãos morreram. Eu fico aqui até que alguém leve a luta ao norte.',
            'Apenas um velho com uma missão. E hoje, vejo em ti o que tanto procurei.',
          ] },
        { id: 'adeus_pos', label: 'Fica bem, guardião.', acao: 'fechar', repetivel: true,
          respostas: [
            'Que os teus passos sejam firmes e a tua espada incansável.',
            'A ponte continua aberta para ti. Passa quando te sentires pronto.',
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
    limparTutoriais();
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
        title: 'da Passagem',
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
    limparTutoriais();
    if (dialogoAberto) return;
    dialogoAberto = true;
    onPassar = callbackPassar;
    passagemConcedida = true;
    lastTier = 'posPassagem';

    ensureDialogue();

    const fala = pick(ABERTURA.cedePassagem);
    const npc = {
        name: 'Guardião',
        title: 'da Passagem',
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
