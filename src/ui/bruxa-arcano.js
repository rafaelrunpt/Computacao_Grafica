// Loja da Bruxa — usa a UI ArcanoDialogue.
// Cada poção e o encantamento são escolhas no menu de diálogo; comprar
// volta ao menu com a quantidade/desbloqueio atualizado.
import './arcano-dialogue.js';
import { adicionarItem } from '../systems/inventario.js';
import { getCintilas, gastarCintilas } from '../systems/currency.js';
import { ATAQUES, ataqueState, desbloquearAtaque, equiparAtaque } from '../systems/ataques.js';

const ArcanoDialogue = window.ArcanoDialogue;

const POCOES = [
    { id: 'pocao',  preco: 30,  nome: 'Filtro Menor',  desc: 'Recupera 15 HP.' },
    { id: 'mega',   preco: 70,  nome: 'Filtro Maior',  desc: 'Recupera 30 HP.' },
    { id: 'elixir', preco: 160, nome: 'Elixir Lunar',  desc: 'Restaura todo o HP.' },
];

const ATAQUES_VENDA = [
    { id: 'escudo_mistico', preco: 220 },
];

const ABERTURAS = [
    'Os filtros fervilham, os astros sussurram. Que desejais, alma errante?',
    'Aproximai-vos do caldeirão. Tenho elixires que enganam a morte... e segredos que afastam o dano.',
    'Sinto-vos cansado, viajante. Posso oferecer remédio — por uma pequena oferenda em cintilas, claro.',
];

const RECUSAS = [
    'Cintilas não bastam, viajante. Voltai quando o bolso pesar mais.',
    'Os astros não cedem sem oferenda. Trazei mais cintilas.',
];

const DESPEDIDAS = [
    'Que a Lua proteja os vossos passos.',
    'Ide, e regressai quando a noite vos morder.',
    'O caldeirão fervilha em vossa ausência. Boa caça.',
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let dlg = null;
let dialogoAberto = false;
const NPC_ID = 'bruxa';

function buildMenuChoices() {
    const c = getCintilas();
    const escolhas = [];

    for (const p of POCOES) {
        escolhas.push({
            label: `🧪 ${p.nome} — ✦ ${p.preco}`,
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
                ? `🛡 ${at.nome} — [APRENDIDO]`
                : `🛡 ${at.nome} — ✦ ${a.preco}`,
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
                    text: `Recebei o vosso ${p.nome}. Que vos seja útil na hora certa.`,
                    next: 'menu',
                };
            } else {
                npc.nodes[choice.to] = { text: pick(RECUSAS), next: 'menu' };
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
                    text: `O ${a.at.nome} é agora vosso. Sussurrai o nome e o véu erguer-se-á.`,
                    next: 'menu',
                };
            } else {
                npc.nodes[choice.to] = { text: pick(RECUSAS), next: 'menu' };
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
        title: 'do Covil',
        mono: 'B',
        portraitUrl: 'assets/textures/avatares/bruxa.png',
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
