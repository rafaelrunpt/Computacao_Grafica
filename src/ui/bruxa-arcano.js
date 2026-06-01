// Loja da Bruxa — usa a UI ArcanoDialogue.
// Cada poção e o encantamento são escolhas no menu de diálogo; comprar
// volta ao menu com a quantidade/desbloqueio atualizado.
import './arcano-dialogue.js';
import { adicionarItem } from '../systems/inventario.js';
import { getCintilas, gastarCintilas } from '../systems/currency.js';
import { ATAQUES, ataqueState, desbloquearAtaque, equiparAtaque } from '../systems/ataques.js';

const ArcanoDialogue = window.ArcanoDialogue;

const POCOES = [
    { id: 'pocao',  preco: 25,  nome: 'Poção de Cura',    desc: 'Recupera 15 HP.', icone: 'assets/icones/small_potion.png' },
    { id: 'mega',   preco: 60,  nome: 'Poção Maior',      desc: 'Recupera 30 HP.', icone: 'assets/icones/big_potion.png' },
    { id: 'elixir', preco: 140, nome: 'Elixir',           desc: 'Restaura todo o HP.', icone: 'assets/icones/elixir_corrupto.png' },
];

const ATAQUES_VENDA = [
    { id: 'veu', preco: 180 },
];

const ABERTURAS = [
    'As poções fervem, os astros sussurram. O que desejas, alma errante?',
    'Aproxima-te do caldeirão. Tenho elixires que enganam a morte... e segredos que afastam o perigo.',
    'Pareces cansado, viajante. Posso oferecer-te um remédio — por algumas cintilas, claro.',
];

const RECUSAS = [
    'Não tens cintilas suficientes, viajante. Volta quando tiveres mais.',
    'Os astros não cedem sem oferta. Traz mais cintilas.',
];

const DESPEDIDAS = [
    'Que a Lua proteja os teus passos. (Pressione Enter)',
    'Vai, e volta quando a noite te morder. (Pressione Enter)',
    'O caldeirão ferve na tua ausência. Boa caça. (Pressione Enter)',
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let dlg = null;
let dialogoAberto = false;
const NPC_ID = 'bruxa';

// Renderiza o ícone: PNG → <img>
// emoji em string.
function _iconHtml(ic, size = 16) {
    if (ic && (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.includes('/'))) {
        return `<img src="${ic}" style="width:${size}px;height:${size}px;object-fit:contain;vertical-align:middle;margin-right:4px;image-rendering:pixelated;">`;
    }
    return ic || '';
}

function buildMenuChoices() {
    const c = getCintilas();
    const escolhas = [];

    for (const p of POCOES) {
        escolhas.push({
            label: `${_iconHtml(p.icone)} ${p.nome} — ✦ ${p.preco}`,
            to: 'comprar_' + p.id,
            _kind: 'pocao',
            _data: p,
            _disabled: c < p.preco,
        });
    }

    for (const a of ATAQUES_VENDA) {
        const at = ATAQUES[a.id];
        if (!at) continue;
        const jaTem = ataqueState.desbloqueados.has(a.id);
        escolhas.push({
            label: jaTem
                ? `${_iconHtml(at.icone)} ${at.nome} — [APRENDIDO]`
                : `${_iconHtml(at.icone)} ${at.nome} — ✦ ${a.preco}`,
            to: 'comprar_' + a.id,
            _kind: 'ataque',
            _data: { ...a, at },
            _disabled: jaTem || c < a.preco,
            _jaTem: jaTem,
        });
    }

    escolhas.push({
        label: '✦ Partir',
        to: '__fechar__',
        _kind: 'fechar',
    });

    return escolhas;
}

function rebuildMenu(npc, texto) {
    const c = getCintilas();
    npc.nodes.menu = {
        text: (texto || pick(ABERTURAS)) + `\n\n   ✦ Cintilas: ${c}`,
        choices: buildMenuChoices().map(ch => ({
            label: ch._disabled ? `(✦ insuficiente) ${ch.label}` : ch.label,
            to: ch._disabled ? 'menu' : ch.to,
            _meta: ch,
        })),
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
        const meta = choice._meta;
        if (!meta) return;

        if (meta._kind === 'fechar') {
            const fala = pick(DESPEDIDAS);
            npc.nodes['__fechar__'] = { text: fala };
            return;
        }

        if (meta._disabled) {
            rebuildMenu(npc, pick(RECUSAS));
            return;
        }

        if (meta._kind === 'pocao') {
            const p = meta._data;
            if (gastarCintilas(p.preco)) {
                adicionarItem(p.id, 1);
                npc.nodes[choice.to] = {
                    text: `Recebei o vosso ${p.nome}. Que vos seja útil na hora certa. (Pressione Enter)`,
                    next: 'menu',
                };
            } else {
                npc.nodes[choice.to] = { text: pick(RECUSAS) + ' (Pressione Enter)', next: 'menu' };
            }
            rebuildMenu(npc, '');
            return;
        }

        if (meta._kind === 'ataque') {
            const a = meta._data;
            if (gastarCintilas(a.preco)) {
                desbloquearAtaque(a.id);
                const slotLivre = ataqueState.slots.indexOf(null);
                if (slotLivre !== -1) equiparAtaque(slotLivre, a.id);
                npc.nodes[choice.to] = {
                    text: `O ${a.at.nome} é agora teu. Diz o nome e o véu erguer-se-á. (Pressione Enter)`,
                    next: 'menu',
                };
            } else {
                npc.nodes[choice.to] = { text: pick(RECUSAS) + ' (Pressione Enter)', next: 'menu' };
            }
            rebuildMenu(npc, '');
            return;
        }
    });
    return dlg;
}

export function abrirBruxaArcano() {
    if (dialogoAberto) return;
    dialogoAberto = true;

    ensureDialogue();

    const npc = {
        name: 'Bruxa',
        title: 'do Vazio',
        mono: 'B',
        portraitUrl: 'assets/icones/avatares/bruxa_simpatica.png',
        portrait: { hue: 285, secondHue: 200 },
        start: 'menu',
        nodes: {},
    };
    dlg.registerNPC(NPC_ID, npc);
    rebuildMenu(npc, pick(ABERTURAS));
    dlg.open(NPC_ID);
}

export function isBruxaArcanoAberto() {
    return dialogoAberto;
}

