import { THEMES } from './dialogue-themes.js';
import { getCintilas, gastarCintilas, ganharCintilas } from '../systems/currency.js';
import { adicionarItem, CATALOGO, quantidade } from '../systems/inventario.js';
import { ATAQUES, ataqueState, desbloquearAtaque, equiparAtaque } from '../systems/ataques.js';
import {
    getFase as getFetchFase, getProgresso as getFetchProgresso,
    aceitarFetchQuest, entregarFetchQuest,
} from '../systems/merchant-fetch-quest.js';
import { limparTutoriais } from './tutorial.js';

// ==========================================
//  Dados do diálogo (Guardião)
// ==========================================
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const ABERTURA = {
    fraco: [
        'Alto! Esta ponte não é para qualquer um. Volta quando fores mais forte.',
        'Para! Sinto que ainda és um principiante. Esta travessia não é para ti... ainda.',
        'Ninguém passa sem provar o seu valor. Tu ainda não o fizestes.',
    ],
    forte: [
        'Aproxima-te. Pareces ter o peso de muitas batalhas. Talvez sejas digno de passar.',
        'Reconheço um verdadeiro guerreiro. Esta ponte pode ser tua... se quiseres.',
        'Paro-te por tradição, não por dúvida. Vejo que tens um espírito forjado em combate.',
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
        {
            id: 'requisito',
            label: 'O que tenho de fazer para passar?',
            respostas: [
                'Prova o teu valor em combate. Volta quando tiveres mais sabedoria e poder.',
                'Enfrenta as criaturas que andam por estas terras. Quando fores suficientemente forte, eu saberei.',
                'Não há atalhos para a glória. Luta, aprende e cresce. Depois voltamos a falar.',
            ],
        },
        {
            id: 'norte_fraco',
            label: 'Que perigos existem no norte?',
            respostas: [
                'Um forte sombrio, dominado por uma força antiga. Criaturas que antes eram homens.',
                'O mal cresce a cada lua cheia nas terras do norte. O castelo é a verdadeira maldição.',
                'Terras corrompidas e feras perigosas. Mas para passar, primeiro tens de me convencer com a tua coragem.',
            ],
        },
        {
            id: 'adeus',
            label: 'Fica bem, guardião.',
            acao: 'fechar',
            repetivel: true,
            respostas: [
                'Vai com cuidado. E volta mais forte.',
                'Que os ventos te levem ao teu destino.',
                'Volta quando as tuas cicatrizes forem a tua prova.',
            ],
        },
    ],
    posPassagem: [
        {
            id: 'norte_pos',
            label: 'O que me espera no norte?',
            respostas: [
                'Um castelo assombrado por sombras do passado. Criaturas que já foram homens. Vai bem preparado.',
                'O mal vive ali há décadas. O que encontrares no castelo... não será fácil de derrotar.',
                'Terras sofridas e, no centro, um cristal negro que pulsa como um coração doente.',
            ],
        },
        {
            id: 'identidade_pos',
            label: 'Quem és tu, guardião?',
            respostas: [
                'Um soldado que escolheu o dever em vez da glória. Cumpro este posto há trezentos anos.',
                'O último da Ordem da Ponte. Os meus irmãos morreram. Eu fico aqui até que alguém leve a luta ao norte.',
                'Apenas um velho com uma missão. E hoje, vejo em ti o que tanto procurei.',
            ],
        },
        {
            id: 'adeus_pos',
            label: 'Fica bem, guardião.',
            acao: 'fechar',
            repetivel: true,
            respostas: [
                'Que os teus passos sejam firmes e a tua espada incansável.',
                'A ponte continua aberta para ti. Passa quando te sentires pronto.',
                'Boa sorte, guerreiro. Vais precisar dela.',
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

    // Reset do foco do gamepad para a primeira escolha disponível.
    _focusedChoiceIdx = 0;
    _applyChoiceFocus();
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
    limparTutoriais();
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
        'Aqui tens — {p} ✦. Um pouco de vida para as tuas andanças.',
        '{p} ✦ bem investidos. Vais agradecer isto mais tarde.',
        'Aqui tens — curada sob o luar, cura o corpo e acalma a alma. {p} ✦.',
    ],
    mega: [
        'Esta é uma essência concentrada — {p} ✦. Sente o calor a percorrer-te as veias.',
        '{p} ✦ por este elixir. Quando o perigo espreitar, bebe isto.',
        'Guarda-a para o momento em que a tua luz parecer fraquejar. {p} ✦.',
    ],
    elixir: [
        'Este elixir é raro — {p} ✦. Dizem que contém o fôlego de estrelas que nunca morreram.',
        'Uma oferta de {p} ✦ por este frasco. Ele vai curar até a ferida mais profunda.',
        'O Elixir do Abismo. {p} ✦ e a tua vida será restaurada por completo.',
    ],
    oculos_carga: [
        'Olha através destas lentes — {p} ✦. O tempo parece parar, revelando o que está para vir.',
        '{p} ✦. Com estes óculos, a magia torna-se visível ao teu olhar.',
        'Uma relíquia de tempos em que víamos mais longe. {p} ✦ e o mundo será diferente.',
    ],
    relampago_arcano: [
        'Puro furor celeste capturado num frasco — {p} ✦. Liberta-o e vê a terra tremer.',
        '{p} ✦. Não é apenas magia; é a fúria das tempestades que andam entre as estrelas.',
        'Dizem que este raio foi roubado de um deus esquecido. {p} ✦ e o poder será teu.',
    ],
    semCintilas: [
        'As estrelas não brilham para quem tem os bolsos vazios, viajante.',
        'Volta quando tiveres dinheiro suficiente para as minhas raridades.',
        'Cintilas... precisas de mais para fazermos negócio.',
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
                ? `Ah, o teu rasto brilha com ${c} ✦. Que curiosidades procuras no meu entreposto?`
                : 'Bem-vindo à minha loja. Tenho ervas que curam e talismãs... mas tudo tem o seu preço.';
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
                    label: 'Que as estrelas te guiem, Alice.',
                    acao: 'fechar',
                    repetivel: true,
                    respostas: [
                        'E que o teu caminho seja iluminado.',
                        'Regressa quando estiveres cansado ou tiveres curiosidade.',
                        'Fica em paz. As estrelas estão a observar, não te esqueças.',
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
            label: '✨  Pareces preocupada com o céu...',
            repetivel: true,
            respostas: [
                'Os meus olhos... raramente saem do céu lá em cima. Não sou apenas uma vendedora de ervas; procuro as verdades das estrelas. Acredito que a magia que corre nestas terras veio do coração de estrelas que morreram.',
                'Esta noite, o céu está agitado. Sinto-o. Fragmentos do cosmos — Amostras Estelares — estão prestes a cair sobre o nosso mundo. Quando saíres daqui, olha para o horizonte; vais ver a chuva de luz.',
                'Peço-te, viajante: recolhe esses fragmentos para a minha investigação. Quatro amostras deverão ser suficientes para provar a minha teoria. O mundo pode ser grande, mas o brilho delas vai guiar-te.',
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
                    'Ainda nada? O universo não entrega os seus segredos facilmente. Procura nos confins do mundo, onde a luz é mais pura.',
                    'As quatro amostras esperam por ti. Não deixes que o brilho delas se apague.',
                ];
                if (c < m) return [
                    `Sim... sinto a energia de ${c} fragmentos contigo. Já é um bom começo, mas ainda não chega. Traz-me os ${m} totais.`,
                    `${c} de ${m}. O desenho das constelações começa a formar-se no meu mapa. Continua a procurar.`,
                ];
                return ['Sinto o calor do céu nas tuas mãos! Traz-me as amostras depressa!'];
            },
        };
    }
    if (fase === 'completa') {
        return {
            id: 'fetch_entregar',
            label: '✅  Trago os fragmentos do céu que pediste.',
            repetivel: true,
            respostas: [
                `Incrível... vê como vibram ao toque? A prova é clara! A magia é mesmo poeira das estrelas. Fizeste um serviço imenso à ciência. Toma isto — ${FETCH_RECOMPENSA_CINTILAS} ✦ e um Elixir do Abismo. Que a tua própria luz nunca se apague.`,
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
            'As amostras que trouxeste confirmam os meus cálculos. Estamos todos ligados ao infinito, viajante. A magia é a linguagem que o universo usa para falar connosco.',
            'Graças a ti, o meu observatório está a crescer. Se o céu voltar a brilhar, estarei aqui para perceber porquê.',
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

// --------------------------------------------------------
// GAMEPAD — navegação por D-pad/stick + A/B
// --------------------------------------------------------
import { pushNavContext, popNavContext } from '../core/gamepad.js';
import { settings as _settings } from '../systems/settings.js';

let _focusedChoiceIdx = 0;
let _navCtx = null;

function _applyChoiceFocus() {
    const btns = Array.from(escolhasDiv.children);
    for (const b of btns) b.classList.remove('gp-focus');
    if (_settings.inputMethod !== 'gamepad') return;
    if (btns.length === 0) return;
    if (_focusedChoiceIdx >= btns.length) _focusedChoiceIdx = btns.length - 1;
    if (_focusedChoiceIdx < 0) _focusedChoiceIdx = 0;
    const target = btns[_focusedChoiceIdx];
    if (target) target.classList.add('gp-focus');
}

function _navChoices(dir) {
    const btns = Array.from(escolhasDiv.children);
    if (btns.length === 0) return;
    if (dir === 'up')   _focusedChoiceIdx = (_focusedChoiceIdx - 1 + btns.length) % btns.length;
    if (dir === 'down') _focusedChoiceIdx = (_focusedChoiceIdx + 1) % btns.length;
    _applyChoiceFocus();
}

function _confirmChoice() {
    const btns = Array.from(escolhasDiv.children);
    const b = btns[_focusedChoiceIdx];
    if (b) b.click();
}

// Tenta saltar o efeito de typing actual. Devolve true se consumiu o input
// (ou seja, o jogador está a ver texto em andamento e queremos completá-lo
// em vez de processar a acção normal do botão).
function _trySkipTyping() {
    if (!typingInterval) return false;
    clearInterval(typingInterval);
    typingInterval = null;
    falaTexto.textContent = currentTypingText;
    const cb = currentTypingCallback;
    currentTypingText = '';
    currentTypingCallback = null;
    if (cb) cb();
    return true;
}

function _entrarNavDialogo() {
    if (_navCtx) return;
    _focusedChoiceIdx = 0;
    _navCtx = {
        onNav: _navChoices,
        // Qualquer botão do comando salta o typing se o texto ainda estiver
        // a aparecer — igual ao keydown global. Caso contrário, faz a acção
        // habitual (✕ confirma, ○ cancela, ✕/△ sem acção própria).
        onConfirm: () => { if (_trySkipTyping()) return; _confirmChoice(); },
        onCancel:  () => { if (_trySkipTyping()) return; fecharDialogo();  },
        onCross:    () => { _trySkipTyping(); },
        onTriangle: () => { _trySkipTyping(); },
    };
    pushNavContext(_navCtx);
    _applyChoiceFocus();
}
function _sairNavDialogo() {
    if (!_navCtx) return;
    popNavContext(_navCtx);
    _navCtx = null;
    for (const b of escolhasDiv.children) b.classList.remove('gp-focus');
}

// Hooks: monitoriza overlay.style.display para registar/desregistar contexto.
// Em vez de mexer em todas as funções export, usamos um MutationObserver
// que segue o atributo `style` do overlay.
const _dialogObserver = new MutationObserver(() => {
    const visivel = overlay.style.display === 'flex';
    if (visivel && _settings.inputMethod === 'gamepad') _entrarNavDialogo();
    else if (!visivel) _sairNavDialogo();
});
_dialogObserver.observe(overlay, { attributes: true, attributeFilter: ['style'] });
