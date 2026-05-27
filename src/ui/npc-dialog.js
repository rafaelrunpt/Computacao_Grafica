import { THEMES } from './dialogue-themes.js';
import { getCintilas, gastarCintilas, ganharCintilas } from '../systems/currency.js';
import { adicionarItem, CATALOGO, quantidade } from '../systems/inventario.js';
import { ATAQUES, ataqueState, desbloquearAtaque, equiparAtaque } from '../systems/ataques.js';
import {
    getFase as getFetchFase, getProgresso as getFetchProgresso,
    aceitarFetchQuest, entregarFetchQuest,
} from '../systems/merchant-fetch-quest.js';

// ==========================================
//  Dados do diálogo (Guardião)
// ==========================================
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const ABERTURA = {
    fraco: [
        'Alto! Esta ponte não é para qualquer caminhante. Retornai quando o vosso poder for digno de nota.',
        'Parai! Sinto em vós a inexperiência de um aprendiz. Esta travessia não vos pertence... ainda.',
        'Ninguém passa sem provar o seu valor. Vós, estranho, ainda não o fizestes.',
    ],
    forte: [
        'Aproximai-vos com o peso de muitas batalhas nos vossos passos. Talvez sejais digno desta travessia.',
        'Reconheço a têmpera de um guerreiro provado. Esta ponte pode ser vossa... se assim o desejardes.',
        'Detenho-vos por tradição, não por dúvida. Vejo em vós um espírito forjado em combate.',
    ],
    posPassagem: [
        'A ponte está aberta para vós, viajante. Em que vos posso ser útil?',
        'Retornastes. Dizei-me — o que vos traz por estas bandas?',
        'A passagem é vossa. Falai, se for do vosso desejo.',
    ],
    cedePassagem: [
        'Sinto em vós um poder que antes não existia. A ponte é vossa, guerreiro — passai.',
        'O vosso espírito mudou desde a última vez que aqui estivestes. Reconheço a força em vós. Passai.',
        'Esta presença... carregais agora o fardo de verdadeiras pelejas. Não vos detenho mais. Ide.',
    ],
};

const ESCOLHAS = {
    fraco: [
        {
            id: 'requisito',
            label: 'O que devo fazer para atravessar?',
            respostas: [
                'Provai o vosso valor em combate. Regressai quando tiverdes colhido sabedoria e poder.',
                'Enfrentai as bestas que assolam estas terras. Quando o vosso espírito for suficientemente temperado, eu o saberei.',
                'Não existem atalhos para a glória. Combatei, aprendei, crescei. Depois voltaremos a parlamentar.',
            ],
        },
        {
            id: 'norte_fraco',
            label: 'Que perigos espreitam no norte?',
            respostas: [
                'Um baluarte sombrio, maculado por uma força ancestral. Criaturas que outrora foram homens.',
                'O mal recrudesce a cada lua cheia nas terras setentrionais. O castelo é a verdadeira danação.',
                'Terras corrompidas, feras sem discernimento. Mas para atravessar, primeiro deveis convencer-me com a vossa bravura.',
            ],
        },
        {
            id: 'adeus',
            label: 'Ficai em paz, guardião.',
            acao: 'fechar',
            repetivel: true,
            respostas: [
                'Ide com cautela, jovem. E regressai mais robusto.',
                'Que os ventos vos conduzam ao vosso destino, caminhante.',
                'Retornai quando as vossas cicatrizes forem o vosso testemunho.',
            ],
        },
    ],
    posPassagem: [
        {
            id: 'norte_pos',
            label: 'O que me aguarda no norte?',
            respostas: [
                'Um castelo fustigado por sombras de eras idas. Criaturas que já foram homens. Ide devidamente preparado.',
                'O mal viceja naquelas entranhas há décadas. O que encontrardes no castelo... não será fácil de subjugar.',
                'Terras mártires e, no âmago, um cristal negro que pulsa como um coração enfermo.',
            ],
        },
        {
            id: 'identidade_pos',
            label: 'Quem sois vós, guardião?',
            respostas: [
                'Um soldado que elegeu o dever em detrimento da glória. Trezentos anos cumpro este posto.',
                'O último da Ordem da Ponte. Os meus irmãos tombaram. Eu permaneço até que alguém leve a contenda ao norte.',
                'Apenas um velho arauto com uma missão. E hoje, antevejo em vós o que tanto busquei.',
            ],
        },
        {
            id: 'adeus_pos',
            label: 'Ficai em paz, guardião.',
            acao: 'fechar',
            repetivel: true,
            respostas: [
                'Que os vossos passos sejam firmes e o vosso aço incansável.',
                'A ponte permanece aberta para vós. Atravessai quando vos sentirdes pronto.',
                'Boa fortuna, guerreiro. Bem haveis de precisar dela.',
            ],
        },
    ],
};

// ==========================================
//  Estado
// ==========================================
let dialogoAberto = false;
let onPassar = null;
let playerLevel = 1;
let passagemConcedida = false;
let respondendoAtual = false;
let typingInterval = null;
let currentTypingText = '';
let currentTypingCallback = null;
let historyLog = [];
const historyByNpc = {};
let summaryExpanded = false;

const usedIds = new Set();
let lastTier = null;
let currentTheme = THEMES.tavern;
let currentNpcConfig = null;

// ==========================================
//  UI - Modern Pixel Art Redesign
// ==========================================

// Injetar CSS para Pixel Art
const style = document.createElement('style');
style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

    .pixel-dialog-box {
        image-rendering: pixelated;
        font-family: 'VT323', monospace;
        box-shadow: 8px 8px 0px rgba(0, 0, 0, 0.6);
        border: 6px solid #1a0f0a;
    }

    .portrait-frame {
        image-rendering: pixelated;
        animation: pixel-breathe 3s ease-in-out infinite;
        border: 4px solid #d4a64a;
        background: #1a0f0a;
        box-shadow: 4px 4px 0px rgba(0,0,0,0.5);
    }

    @keyframes pixel-breathe {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-4px) scale(1.02); }
    }

    .choice-btn-pixel {
        background-color: rgba(26, 15, 10, 0.9);
        border: 3px solid #3a281c;
        color: #f3e6c6;
        font-family: 'VT323', monospace;
        font-size: 15px;
        padding: 5px 12px;
        margin-top: 4px;
        cursor: pointer;
        transition: all 0.2s steps(3);
        text-align: left;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 30px;
    }

    .choice-btn-pixel:hover {
        background-color: #241710;
        border-color: #d4a64a;
        box-shadow: 0 0 15px rgba(212, 166, 74, 0.4);
        text-shadow: 0 0 8px #d4a64a;
        transform: translateX(10px);
    }

    .choice-btn-pixel span {
        flex-shrink: 0;
    }
`;
document.head.appendChild(style);

const overlay = document.createElement('div');
overlay.style.cssText = `
    position: fixed; inset: 0;
    display: none; align-items: flex-end; justify-content: center;
    z-index: 200; padding-bottom: 20px;
    background: rgba(0, 0, 0, 0.6);
    overflow: hidden;
`;

// ---------- History Box (Pixel Style) ----------
const summaryBox = document.createElement('div');
summaryBox.className = 'pixel-dialog-box';
summaryBox.style.cssText = `
    position: absolute;
    right: 24px; top: 24px;
    width: 260px;
    cursor: pointer;
    transition: all 0.3s steps(4);
    z-index: 10;
    overflow: hidden;
    background: #241710;
`;

const summaryHeader = document.createElement('div');
summaryHeader.style.cssText = `
    padding: 6px 12px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(0,0,0,0.4);
    user-select: none;
`;

const summaryLabel = document.createElement('div');
summaryLabel.style.cssText = `
    font-size: 13px; text-transform: uppercase; letter-spacing: 1px;
    font-weight: bold; color: #d4a64a;
`;
summaryLabel.textContent = 'Crónica da Viagem';

const summaryArrow = document.createElement('div');
summaryArrow.style.cssText = `
    font-size: 14px; color: #d4a64a;
    transition: transform 0.3s steps(4);
`;
summaryArrow.textContent = '▼';

summaryHeader.append(summaryLabel, summaryArrow);

const summaryContent = document.createElement('div');
summaryContent.style.cssText = `
    display: flex; flex-direction: column; gap: 12px;
    padding: 0 16px;
    max-height: 0;
    overflow-x: hidden;
    transition: max-height 0.3s steps(5), padding 0.2s;
`;

summaryBox.append(summaryHeader, summaryContent);
overlay.appendChild(summaryBox);

summaryBox.onclick = () => {
    summaryExpanded = !summaryExpanded;
    if (summaryExpanded) {
        summaryContent.style.maxHeight = '320px';
        summaryContent.style.padding = '10px 12px';
        summaryContent.style.overflowY = 'auto';
        summaryArrow.style.transform = 'rotate(180deg)';
    } else {
        summaryContent.style.maxHeight = '0';
        summaryContent.style.padding = '0 12px';
        summaryContent.style.overflowY = 'hidden';
        summaryArrow.style.transform = 'rotate(0deg)';
    }
};

// ---------- Caixa Principal (Side-by-Side) ----------
const caixa = document.createElement('div');
caixa.className = 'pixel-dialog-box';
caixa.style.cssText = `
    width: min(640px, 90vw);
    min-height: 190px;
    background: #241710;
    display: flex;
    gap: 16px;
    padding: 16px;
    position: relative;
    opacity: 0;
    transform: translateY(40px);
    transition: transform 0.4s steps(5), opacity 0.3s;
`;

const portraitWrap = document.createElement('div');
portraitWrap.style.cssText = `
    display: flex; flex-direction: column; align-items: center; gap: 15px;
    flex-shrink: 0;
`;

const retrato = document.createElement('div');
retrato.className = 'portrait-frame';
retrato.style.cssText = `
    width: 96px; height: 96px;
    background-size: cover;
    background-position: center;
`;

portraitWrap.appendChild(retrato);

const contentWrap = document.createElement('div');
contentWrap.style.cssText = `
    display: flex; flex-direction: column; flex: 1; min-width: 0;
`;

const npcHeader = document.createElement('div');
npcHeader.style.cssText = `margin-bottom: 12px;`;

const nomeNpc = document.createElement('div');
nomeNpc.style.cssText = `font-size: 22px; font-weight: bold; color: #d4a64a; text-transform: uppercase;`;

const subtitulo = document.createElement('div');
subtitulo.style.cssText = `font-size: 13px; color: #f3e6c6; opacity: 0.7; font-style: italic;`;

npcHeader.append(nomeNpc, subtitulo);

const falaTexto = document.createElement('div');
falaTexto.style.cssText = `
    font-size: 16px; line-height: 1.3; color: #f3e6c6;
    margin-bottom: 12px; flex-shrink: 0;
    min-height: 48px;
`;

const escolhasDiv = document.createElement('div');
escolhasDiv.style.cssText = `
    display: flex; flex-direction: column; gap: 6px;
    overflow-y: auto; flex: 1; padding-right: 10px;
`;

contentWrap.append(npcHeader, falaTexto, escolhasDiv);

const fecharBtn = document.createElement('button');
fecharBtn.style.cssText = `
    position: absolute; right: 15px; top: 15px;
    background: #1a0f0a; border: 2px solid #d4a64a;
    color: #d4a64a; cursor: pointer;
    font-size: 18px; width: 34px; height: 34px;
    font-family: 'VT323', monospace;
    display: flex; align-items: center; justify-content: center;
`;
fecharBtn.textContent = 'X';

caixa.append(portraitWrap, contentWrap, fecharBtn);
overlay.appendChild(caixa);
document.body.appendChild(overlay);

// ==========================================
//  Lógica de UI
// ==========================================

function renderHistoryEntry(role, text) {
    const entry = document.createElement('div');
    entry.style.cssText = `
        border-left: 3px solid ${role === 'npc' ? '#d4a64a' : '#888'};
        padding-left: 12px; margin-bottom: 12px;
    `;
    
    const label = document.createElement('div');
    label.style.cssText = `
        font-size: 11px; text-transform: uppercase;
        color: ${role === 'npc' ? '#d4a64a' : '#f3e6c6'};
        font-weight: bold; margin-bottom: 2px;
    `;
    label.textContent = role === 'npc' ? (currentNpcConfig?.nome || 'Guerreiro') : 'Herói';

    const content = document.createElement('div');
    content.style.cssText = `font-size: 12px; color: #f3e6c6; opacity: 0.9; line-height: 1.25;`;
    content.textContent = text;
    
    entry.append(label, content);
    summaryContent.appendChild(entry);
}

function addToHistory(role, text) {
    historyLog.push({ role, text });
    renderHistoryEntry(role, text);
    if (!summaryExpanded) {
        summaryContent.scrollTop = summaryContent.scrollHeight;
    }
}

function renderHistoryFromLog() {
    summaryContent.innerHTML = '';
    for (const e of historyLog) renderHistoryEntry(e.role, e.text);
}

function aplicarTema(themeKey) {
    const theme = THEMES[themeKey] || THEMES.tavern;
    currentTheme = theme;

    summaryBox.style.backgroundColor = theme.panel;
    summaryLabel.style.color = theme.accent;
    summaryArrow.style.color = theme.accent;

    caixa.style.backgroundColor = theme.panel;
    retrato.style.borderColor = theme.accent;
    nomeNpc.style.color = theme.accent;
    fecharBtn.style.borderColor = theme.accent;
    fecharBtn.style.color = theme.accent;

    falaTexto.style.color = theme.bodyText;
}

fecharBtn.onclick = () => fecharDialogo();

// ==========================================
//  Lógica de Diálogo
// ==========================================
function escreverComEfeito(texto, onFim) {
    if (typingInterval) clearInterval(typingInterval);
    falaTexto.textContent = '';
    let i = 0;
    currentTypingText = texto;
    currentTypingCallback = onFim;

    addToHistory('npc', texto);

    typingInterval = setInterval(() => {
        falaTexto.textContent += texto[i++];
        if (i >= texto.length) {
            clearInterval(typingInterval);
            typingInterval = null;
            currentTypingText = '';
            currentTypingCallback = null;
            if (onFim) onFim();
        }
    }, 20);
}

function escolhasDisponiveis() {
    if (currentNpcConfig && typeof currentNpcConfig.getEscolhas === 'function') {
        return currentNpcConfig.getEscolhas().filter(e => {
            if (e.condicao && !e.condicao()) return false;
            if (!e.repetivel && usedIds.has(e.id)) return false;
            return true;
        });
    }
    const tier = passagemConcedida ? 'posPassagem' : 'fraco';
    return ESCOLHAS[tier].filter(e => e.repetivel || !usedIds.has(e.id));
}

function mostrarEscolhas() {
    escolhasDiv.innerHTML = '';
    const lista = escolhasDisponiveis();

    lista.forEach((escolha) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn-pixel';
        
        const isAcao = escolha.id === 'atravessar_ponte' || escolha.id === 'fetch_entregar';
        if (isAcao) btn.style.borderLeftColor = currentTheme.accent;

        let labelHtml = escolha.label;
        if (labelHtml.includes('<img')) {
            labelHtml = labelHtml.replace(/style="/g, 'style="image-rendering:pixelated;');
        }

        btn.innerHTML = `<span style="color:${currentTheme.accent};">▶</span> ${labelHtml}`;

        btn.onclick = () => tratarEscolha(escolha);
        escolhasDiv.appendChild(btn);
    });
}

function _stripHtml(s) {
    return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function tratarEscolha(escolha) {
    if (respondendoAtual) return;
    addToHistory('player', _stripHtml(escolha.label));

    if (typeof escolha.acaoImediata === 'function') {
        const r = escolha.acaoImediata();
        if (r === 'cancelar') return;
    }

    if (escolha.acao === 'passar_agora') {
        fecharDialogo();
        if (onPassar) onPassar();
        return;
    }

    respondendoAtual = true;
    if (!escolha.repetivel) usedIds.add(escolha.id);

    [...escolhasDiv.children].forEach(btn => {
        btn.style.opacity = '0.3';
        btn.style.pointerEvents = 'none';
    });

    setTimeout(() => { escolhasDiv.innerHTML = ''; }, 150);

    const candidatas = typeof escolha.respostas === 'function'
        ? escolha.respostas()
        : escolha.respostas;
    const resposta = Array.isArray(candidatas) ? pick(candidatas) : String(candidatas);

    escreverComEfeito(resposta, () => {
        respondendoAtual = false;
        if (escolha.acao === 'passar') passagemConcedida = true;
        if (typeof escolha.acaoApos === 'function') escolha.acaoApos();
        if (escolha.acao === 'fechar') {
            setTimeout(() => fecharDialogo(), 1200);
            return;
        }
        setTimeout(() => mostrarEscolhas(), 300);
    });
}

window.addEventListener('keydown', (e) => {
    if (!dialogoAberto) return;
    if (e.key === 'Escape') { fecharDialogo(); return; }
    if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
        falaTexto.textContent = currentTypingText;
        const cb = currentTypingCallback;
        currentTypingText = '';
        currentTypingCallback = null;
        if (cb) cb();
    }
});

// ==========================================
//  API genérica para abrir um diálogo
// ==========================================
function abrirDialogo(config) {
    if (dialogoAberto) return;
    dialogoAberto = true;
    currentNpcConfig = config;
    respondendoAtual = true;
    summaryExpanded = false;
    
    const npcKey = config.nome || '_default_';
    if (!historyByNpc[npcKey]) historyByNpc[npcKey] = [];
    historyLog = historyByNpc[npcKey];

    aplicarTema(config.tema || 'tavern');

    nomeNpc.textContent = config.nome || '';
    subtitulo.textContent = config.subtitulo || '';
    if (config.retratoUrl) {
        retrato.style.backgroundImage = `url('${config.retratoUrl}')`;
        retrato.textContent = '';
    } else {
        retrato.style.backgroundImage = '';
        retrato.textContent = config.retratoIcone || '⚔';
        retrato.style.fontSize = '42px';
        retrato.style.display = 'flex';
        retrato.style.alignItems = 'center';
        retrato.style.justifyContent = 'center';
        retrato.style.color = currentTheme.accent;
    }

    overlay.style.display = 'flex';
    escolhasDiv.innerHTML = '';
    falaTexto.textContent = '';
    renderHistoryFromLog();

    summaryContent.style.maxHeight = '0';
    summaryContent.style.padding = '0 16px';
    summaryArrow.style.transform = 'rotate(0deg)';

    caixa.style.opacity = '0';
    caixa.style.transform = 'translateY(40px)';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            caixa.style.opacity = '1';
            caixa.style.transform = 'translateY(0)';
        });
    });

    setTimeout(() => {
        const abertura = typeof config.getAbertura === 'function' ? config.getAbertura() : '';
        escreverComEfeito(abertura, () => {
            respondendoAtual = false;
            mostrarEscolhas();
        });
    }, 400);
}

// ==========================================
//  API pública
// ==========================================
export function abrirDialogoGuardiao(level, callbackPassar, passouJa = false, themeKey = 'tavern') {
    if (dialogoAberto) return;
    playerLevel = level;
    onPassar = callbackPassar;
    passagemConcedida = !!passouJa;

    const tier = passagemConcedida ? 'posPassagem' : 'fraco';
    if (tier !== lastTier) { usedIds.clear(); lastTier = tier; }

    abrirDialogo({
        nome: 'Guardião da Ponte',
        subtitulo: 'Protetor da Passagem',
        retratoUrl: 'assets/textures/avatares/guardiao_avatar.png',
        tema: themeKey,
        getAbertura: () => pick(passagemConcedida ? ABERTURA.posPassagem : ABERTURA.fraco),
        getEscolhas: null,
    });
}

export function abrirDialogoGuardiaoCedePassagem(callbackPassar, themeKey = 'tavern') {
    if (dialogoAberto) return;
    onPassar = callbackPassar;
    passagemConcedida = true;
    lastTier = 'posPassagem';
    usedIds.clear();

    abrirDialogo({
        nome: 'Guardião da Ponte',
        subtitulo: 'Protetor da Passagem',
        retratoUrl: 'assets/textures/avatares/guardiao_avatar.png',
        tema: themeKey,
        getAbertura: () => pick(ABERTURA.cedePassagem),
        getEscolhas: () => [
            {
                id: 'atravessar_ponte',
                label: '⚔  Atravessar a ponte',
                acao: 'passar_agora',
                repetivel: true,
                respostas: [''],
            },
        ],
    });
}

// ---- Mercador ----
const MERCADOR_PRECOS = { pocao: 25, mega: 60, elixir: 140, oculos_carga: 20, relampago_arcano: 180 };

const MERCADOR_FALAS_OFERTA = {
    pocao: [
        'Toma — {p} ✦. Um pouco de vitalidade líquida para as vossas andanças.',
        '{p} ✦ bem investidos. Sinto que o vosso fôlego vos agradecerá mais tarde.',
        'Aqui tens — destilada sob o luar, cura o corpo e acalma a alma. {p} ✦.',
    ],
    mega: [
        'Esta é uma essência concentrada — {p} ✦. Senti o calor a percorrer-vos as veias.',
        '{p} ✦ por este elixir. Quando o abismo vos olhar de volta, bebei disto.',
        'Guardai-a para o momento em que a vossa luz parecer fraquejar. {p} ✦.',
    ],
    elixir: [
        'Este elixir é raro — {p} ✦. Dizem que contém o fôlego de estrelas que nunca morreram.',
        'Uma oferenda de {p} ✦ por este frasco. Ele curará até a mais profunda ferida da alma.',
        'O Elixir do Abismo. {p} ✦ e a vossa vitalidade será restaurada por completo.',
    ],
    oculos_carga: [
        'Olhai através destas lentes — {p} ✦. O tempo parece curvar-se, revelando o que está por vir.',
        '{p} ✦. Com estes óculos, o fluxo da magia torna-se visível ao vosso olhar atento.',
        'Uma relíquia de tempos em que víamos mais longe. {p} ✦ e o mundo será diferente.',
    ],
    relampago_arcano: [
        'Puro furor celeste capturado num frasco — {p} ✦. Libertai-o e vede a terra tremer.',
        '{p} ✦. Não é mera magia; é a fúria das tempestades que assolam o vazio entre as estrelas.',
        'Dizem que este raio foi roubado de um deus esquecido. {p} ✦ e o poder será vosso.',
    ],
    semCintilas: [
        'As estrelas não brilham para quem tem os bolsos vazios, viajante.',
        'Voltai quando a vossa fortuna for condizente com as minhas raridades.',
        'Cintilas... precisais de mais delas para selarmos este pacto.',
    ],
};

function _falaCom(template, preco) {
    return template.replace(/\{p\}/g, String(preco));
}

export function abrirDialogoMercador(themeKey = 'tavern') {
    if (dialogoAberto) return;
    usedIds.clear();

    abrirDialogo({
        nome: 'Alice',
        subtitulo: 'Astrónoma e Mercadora',
        retratoUrl: 'assets/textures/avatares/merchant.png',
        tema: themeKey,
        getAbertura: () => {
            const c = getCintilas();
            return c > 0
                ? `Ah, o vosso rasto brilha com ${c} ✦. Que curiosidades procurais no meu humilde entreposto?`
                : 'Seja bem-vindo sob o teto da minha loja. Tenho ervas que curam e talismãs que sussurram... mas tudo requer o devido tributo.';
        },
        getEscolhas: () => {
            const c = getCintilas();

            const _iconHtml = (ic) => (ic && (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.includes('/')))
                ? `<img src="${ic}" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-right:6px;">`
                : `${ic} `;
            const _cintHtml = `<img src="assets/icones/cintilas.png" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;">`;

            const compraEscolha = (id, itemId, preco, falasOk) => ({
                id,
                repetivel: true,
                label: `${_iconHtml(CATALOGO[itemId].icone)} ${CATALOGO[itemId].nome} — ${preco} ${_cintHtml}${(c >= preco) ? '' : '  (insuficiente)'}`,
                respostas: () => (c >= preco)
                    ? falasOk.map(f => _falaCom(f, preco))
                    : MERCADOR_FALAS_OFERTA.semCintilas,
                acaoImediata: () => {
                    if (c < preco) return; 
                    gastarCintilas(preco);
                    adicionarItem(itemId, 1);
                },
            });

            const fase = getFetchFase();
            const escolhaQuest = construirEscolhaFetchQuest(fase);

            const oculosJaComprados = quantidade('oculos_carga') > 0;
            const escolhasCompra = [
                compraEscolha('comprar_pocao', 'pocao', MERCADOR_PRECOS.pocao, MERCADOR_FALAS_OFERTA.pocao),
                compraEscolha('comprar_mega',  'mega',  MERCADOR_PRECOS.mega,  MERCADOR_FALAS_OFERTA.mega),
                compraEscolha('comprar_elixir','elixir',MERCADOR_PRECOS.elixir,MERCADOR_FALAS_OFERTA.elixir),
            ];

            if (!oculosJaComprados) {
                escolhasCompra.push(compraEscolha(
                    'comprar_oculos', 'oculos_carga',
                    MERCADOR_PRECOS.oculos_carga, MERCADOR_FALAS_OFERTA.oculos_carga
                ));
            }

            const arcanoAprendido = ataqueState.desbloqueados.has('relampago_arcano');
            if (!arcanoAprendido) {
                const at = ATAQUES['relampago_arcano'];
                const preco = MERCADOR_PRECOS.relampago_arcano;
                escolhasCompra.push({
                    id: 'comprar_relampago_arcano',
                    repetivel: false,
                    label: `${_iconHtml(at.icone)} ${at.nome} — ${preco} ${_cintHtml}${(c >= preco) ? '' : '  (insuficiente)'}`,
                    respostas: () => (c >= preco)
                        ? MERCADOR_FALAS_OFERTA.relampago_arcano.map(f => _falaCom(f, preco))
                        : MERCADOR_FALAS_OFERTA.semCintilas,
                    acaoImediata: () => {
                        if (c < preco) return;
                        gastarCintilas(preco);
                        desbloquearAtaque('relampago_arcano');
                        const slotLivre = ataqueState.slots.indexOf(null);
                        if (slotLivre !== -1) equiparAtaque(slotLivre, 'relampago_arcano');
                    },
                });
            }

            return [
                ...escolhasCompra,
                escolhaQuest,
                {
                    id: 'adeus_mercador',
                    label: 'Que as estrelas vos guiem, Alice.',
                    acao: 'fechar',
                    repetivel: true,
                    respostas: [
                        'E que o vosso caminho seja iluminado pelo fulgor eterno.',
                        'Regressai quando o cansaço vos pesar ou a curiosidade vos espicaçar.',
                        'Ficai em paz. As estrelas estão a observar, não o esqueçais.',
                    ],
                },
            ];
        },
    });
}

const FETCH_RECOMPENSA_CINTILAS = 120;

function construirEscolhaFetchQuest(fase) {
    if (fase === 'none') {
        return {
            id: 'fetch_oferta',
            label: '✨  Pareceis preocupada com o firmamento...',
            repetivel: true,
            respostas: [
                'Os meus olhos... raramente se desviam do abismo lá em cima. Não sou uma simples mercadora de ervas; sou uma buscadora de verdades celestes. Creio, com cada fibra do meu ser, que a magia que flui nestas terras não nasceu do solo, mas sim do coração das estrelas moribundas.',
                'Esta noite, o céu está inquieto. Sinto-o. Fragmentos do cosmos — Amostras Estelares — estão prestes a romper o véu e cair sobre o nosso mundo. Quando sairdes daqui, olhai para o horizonte; vereis a chuva de luz.',
                'Peço-vos, viajante: recolhei esses fragmentos para a minha investigação. Quatro amostras deverão ser suficientes para provar a minha tese. O mundo pode ser vasto, mas o brilho delas guiar-vos-á.',
            ],
            acaoApos: () => {
                aceitarFetchQuest();
            },
        };
    }
    if (fase === 'ativa') {
        const { coletados, meta } = getFetchProgresso();
        return {
            id: 'fetch_progresso',
            label: `✨  Sobre o rasto das estrelas  (${coletados}/${meta})`,
            repetivel: true,
            respostas: () => {
                const { coletados: c, meta: m } = getFetchProgresso();
                if (c === 0) return [
                    'Ainda nada? O cosmos não entrega os seus segredos facilmente. Procurai nos confins do mundo, onde a luz é mais pura.',
                    'As quatro amostras esperam por vós. Não deixeis que o seu brilho se apague na vossa ausência.',
                ];
                if (c < m) return [
                    `Sim... sinto a energia de ${c} fragmentos convosco. Já é um começo promissor, mas o padrão ainda está incompleto. Trazei-me os ${m} totais.`,
                    `${c} de ${m}. O desenho das constelações começa a formar-se no meu mapa. Continuai a vossa busca, caminhante.`,
                ];
                return ['Sinto o calor do firmamento em vossas mãos! Trazei-mas, depressa, antes que a essência se dissipe!'];
            },
        };
    }
    if (fase === 'completa') {
        return {
            id: 'fetch_entregar',
            label: '✅  Trago os fragmentos do céu que pedistes.',
            repetivel: true,
            respostas: [
                `Incrível... vedes como vibram ao toque? Centelhas, névoas, cristais... a prova é irrefutável! A magia é, de facto, poeira estelar aprisionada na matéria. Vós prestastes um serviço imenso à ciência e ao mistério. Tomai isto — ${FETCH_RECOMPENSA_CINTILAS} ✦ e um Elixir do Abismo. Que a vossa própria luz nunca se apague.`,
            ],
            acaoApos: () => {
                if (entregarFetchQuest()) {
                    ganharCintilas(FETCH_RECOMPENSA_CINTILAS);
                    adicionarItem('elixir', 1);
                }
            },
        };
    }
    return {
        id: 'fetch_concluida',
        label: '⚜  O que revelaram as estrelas?',
        repetivel: true,
        respostas: [
            'As amostras que trouxestes confirmam os meus cálculos mais ousados. Estamos todos ligados ao infinito, viajante. A magia é apenas a linguagem que o universo usa para falar connosco.',
            'Graças a vós, o meu observatório improvisado floresce. Se o céu voltar a chorar luz, estarei aqui para a decifrar.',
        ],
    };
}

export function isDialogoMercadorAberto() { return dialogoAberto; }

export function fecharDialogo() {
    if (!dialogoAberto) return;
    dialogoAberto = false;
    currentNpcConfig = null;
    if (typingInterval) { clearInterval(typingInterval); typingInterval = null; }
    currentTypingText = '';
    currentTypingCallback = null;
    caixa.style.transition = 'transform 0.3s steps(4), opacity 0.2s';
    caixa.style.transform = 'translateY(30px)';
    caixa.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 250);
}

export function isDialogoAberto() {
    return dialogoAberto;
}
