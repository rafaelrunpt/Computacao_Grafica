// Adapter: mesma API que npc-dialog.js, mas usa a UI ArcanoDialogue.
// Para alternar entre os dois, troca o import em src/core/main.js.
import './arcano-dialogue.js';

const ArcanoDialogue = window.ArcanoDialogue;

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const ABERTURA = {
    fraco: [
        'Alto! Esta ponte não é para qualquer caminhante. Retornai quando o vosso poder for digno de nota.',
        'Sustai o passo! Sinto em vós a inexperiência de um aprendiz. Esta travessia não vos pertence... ainda.',
        'Nenhum homem passa sem provar o seu valor. Vós, estranho, ainda não o fizestes.',
    ],
    posPassagem: [
        'A ponte está aberta para vós, viajante. Em que vos posso ser útil?',
        'Regressastes. Dizei-me — o que vos traz a estas paragens?',
        'A passagem é vossa. Falai, se for do vosso desejo.',
    ],
    cedePassagem: [
        'Sinto em vós um poder que outrora não existia. A ponte é vossa, guerreiro — passai.',
        'O vosso espírito transmutou-se desde a última vez que aqui estivestes. Reconheço a força em vós. Passai.',
        'Esta presença... carregais agora o fardo de verdadeiras batalhas. Não vos detenho mais. Ide.',
    ],
};


const ESCOLHAS = {
    fraco: [
        { id: 'requisito', label: 'O que devo fazer para atravessar?',
          respostas: [
            'Provai o vosso valor em combate. Regressai quando tiverdes colhido sabedoria e poder.',
            'Enfrentai as bestas que assolam estas terras. Quando o vosso espírito for suficientemente temperado, eu o saberei.',
            'Não existem atalhos para a glória. Combatei, aprendei, crescei. Depois voltaremos a parlamentar.',
          ] },
        { id: 'norte_fraco', label: 'Que perigos espreitam no norte?',
          respostas: [
            'Um baluarte sombrio, maculado por uma força ancestral. Criaturas que outrora foram homens.',
            'O mal recrudesce a cada lua cheia nas terras setentrionais. O castelo é a verdadeira danação.',
            'Terras corrompidas, feras sem discernimento. Mas para atravessar, primeiro deveis convencer-me com a vossa bravura.',
          ] },
        { id: 'adeus', label: 'Ficai em paz, guardião.', acao: 'fechar', repetivel: true,
          respostas: [
            'Ide com cautela, jovem. E regressai mais robusto.',
            'Que os ventos vos conduzam ao vosso destino, caminhante.',
            'Retornai quando as vossas cicatrizes forem o vosso testemunho.',
          ] },
    ],
    posPassagem: [
        { id: 'norte_pos', label: 'O que me aguarda no norte?',
          respostas: [
            'Um castelo fustigado por sombras de eras idas. Criaturas que já foram homens. Ide devidamente preparado.',
            'O mal viceja naquelas entranhas há décadas. O que encontrardes no castelo... não será fácil de subjugar.',
            'Terras mártires e, no âmago, um cristal negro que pulsa como um coração enfermo.',
          ] },
        { id: 'identidade_pos', label: 'Quem sois vós, guardião?',
          respostas: [
            'Um soldado que elegeu o dever em detrimento da glória. Trezentos anos cumpro este posto.',
            'O último da Ordem da Ponte. Os meus irmãos tombaram. Eu permaneço até que alguém leve a contenda ao norte.',
            'Apenas um velho arauto com uma missão. E hoje, antevejo em vós o que tanto busquei.',
          ] },
        { id: 'adeus_pos', label: 'Ficai em paz, guardião.', acao: 'fechar', repetivel: true,
          respostas: [
            'Que os vossos passos sejam firmes e o vosso aço incansável.',
            'A ponte permanece aberta para vós. Atravessai quando vos sentirdes pronto.',
            'Boa fortuna, guerreiro. Bem haveis de precisar dela.',
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
