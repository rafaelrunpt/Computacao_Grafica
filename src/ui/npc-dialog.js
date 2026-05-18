import { THEMES } from './dialogue-themes.js';
import { getCintilas, gastarCintilas, ganharCintilas } from '../systems/currency.js';
import { adicionarItem, CATALOGO, quantidade } from '../systems/inventario.js';
import { ATAQUES, ataqueState, desbloquearAtaque, equiparAtaque } from '../systems/ataques.js';
import {
    getFase as getFetchFase, getProgresso as getFetchProgresso,
    aceitarFetchQuest, entregarFetchQuest,
} from '../systems/merchant-fetch-quest.js';

// ==========================================
//  Dados do diálogo
// ==========================================
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
        {
            id: 'requisito',
            label: 'O que tenho de fazer para passar?',
            respostas: [
                'Prova o teu valor em combate. Regressa quando tiveres crescido em experiência e poder.',
                'Enfrenta as criaturas destas terras. Quando o teu espírito for suficientemente forte, eu saberei.',
                'Não há atalho. Combate, aprende, cresce. Depois voltamos a falar.',
            ],
        },
        {
            id: 'norte_fraco',
            label: 'Que perigos há no norte?',
            respostas: [
                'Um castelo sombrio corrompido por uma força ancestral. Criaturas que outrora eram homens.',
                'O mal cresce a cada lua cheia nas terras do norte. O castelo é o verdadeiro perigo.',
                'Terras corrompidas, criaturas sem razão. Mas para atravessar, primeiro tens de me convencer com poder.',
            ],
        },
        {
            id: 'adeus',
            label: 'Adeus, guardião.',
            acao: 'fechar',
            repetivel: true,
            respostas: [
                'Vai com cuidado, jovem. E volta mais forte.',
                'Que os ventos te levem ao teu destino, viajante.',
                'Volta quando as tuas cicatrizes me convencerem.',
            ],
        },
    ],
    posPassagem: [
        {
            id: 'norte_pos',
            label: 'O que há no norte?',
            respostas: [
                'Um castelo corrompido por sombras antigas. Criaturas que já foram homens. Vai preparado.',
                'O mal cresce lá dentro há décadas. O que encontrares no castelo... não será simples de derrotar.',
                'Terras corrompidas e, no centro, um cristal negro que pulsa como um coração doente.',
            ],
        },
        {
            id: 'identidade_pos',
            label: 'Quem és tu, guardião?',
            respostas: [
                'Um guerreiro que escolheu o dever sobre a glória. Trezentos anos neste posto.',
                'O último da Ordem da Ponte. Os outros tombaram. Eu fico até que alguém leve a luta ao norte.',
                'Apenas um velho soldado com uma missão. E hoje, vejo em ti o que procurava.',
            ],
        },
        {
            id: 'adeus_pos',
            label: 'Adeus, guardião.',
            acao: 'fechar',
            repetivel: true,
            respostas: [
                'Que os teus passos sejam firmes e o teu aço verdadeiro.',
                'A ponte está aberta para ti. Passa quando estiveres pronto.',
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
let currentNpcConfig = null;     // config do NPC atualmente em diálogo

// ==========================================
//  UI
// ==========================================
const overlay = document.createElement('div');
overlay.style.cssText = `
    position: fixed; inset: 0;
    display: none; align-items: flex-end; justify-content: center;
    z-index: 200; padding-bottom: 0;
    backdrop-filter: blur(6px);
    background: rgba(0, 0, 0, 0.15);
    overflow: hidden;
`;

const accentsContainer = document.createElement('div');
accentsContainer.style.cssText = `
    position: absolute; inset: 0;
    pointer-events: none;
    z-index: -1;
`;
overlay.appendChild(accentsContainer);

// ---------- History Box (Topo Esquerda, Dropdown) ----------
const summaryBox = document.createElement('div');
summaryBox.style.cssText = `
    position: absolute;
    left: 40px; top: 40px;
    width: 280px;
    border-radius: 10px;
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.12);
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 10;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
`;

const summaryHeader = document.createElement('div');
summaryHeader.style.cssText = `
    padding: 11px 16px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
    user-select: none;
`;

const summaryLabel = document.createElement('div');
summaryLabel.style.cssText = `
    font-size: 10px; text-transform: uppercase; letter-spacing: 2.5px;
    font-weight: bold;
`;
summaryLabel.textContent = 'Histórico da Conversa';

const summaryArrow = document.createElement('div');
summaryArrow.style.cssText = `
    font-size: 11px;
    transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    opacity: 0.6;
`;
summaryArrow.textContent = '▾';

summaryHeader.append(summaryLabel, summaryArrow);

const summaryContent = document.createElement('div');
summaryContent.style.cssText = `
    display: flex; flex-direction: column; gap: 10px;
    padding: 0 16px;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), padding 0.35s;
`;

summaryBox.append(summaryHeader, summaryContent);
overlay.appendChild(summaryBox);

summaryBox.onclick = () => {
    summaryExpanded = !summaryExpanded;
    if (summaryExpanded) {
        summaryContent.style.maxHeight = '420px';
        summaryContent.style.padding = '0 16px 16px';
        summaryContent.style.overflowY = 'auto';
        summaryArrow.style.transform = 'rotate(180deg)';
        summaryBox.style.boxShadow = '0 16px 40px rgba(0,0,0,0.5)';
        setTimeout(() => {
            summaryContent.scrollTop = summaryContent.scrollHeight;
        }, 50);
    } else {
        summaryContent.style.maxHeight = '0';
        summaryContent.style.padding = '0 16px';
        summaryContent.style.overflowY = 'hidden';
        summaryArrow.style.transform = 'rotate(0deg)';
        summaryBox.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    }
};

// ---------- Caixa Principal (Centro Baixo) ----------
const caixaExt = document.createElement('div');
caixaExt.style.cssText = `
    width: min(960px, 100vw);
    padding: 1px 1px 0 1px;
    border-radius: 14px 14px 0 0;
    transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease-out;
    position: relative;
    z-index: 1;
    transform: translateY(36px) scale(0.97);
    opacity: 0;
`;

const caixa = document.createElement('div');
caixa.style.cssText = `
    border-radius: 13px 13px 0 0;
    overflow: hidden;
    display: flex; flex-direction: column;
    height: 440px;
    border-width: 1px 1px 0 1px;
    border-style: solid;
    backdrop-filter: blur(28px);
`;

// ---------- Cabeçalho ----------
const header = document.createElement('div');
header.style.cssText = `
    padding: 14px 22px;
    display: flex; align-items: center; gap: 14px;
    flex-shrink: 0;
    height: 76px; box-sizing: border-box;
`;

const retrato = document.createElement('div');
retrato.style.cssText = `
    width: 48px; height: 48px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 12px rgba(0,0,0,0.3);
    background-size: cover;
    background-position: center;
`;

const nomeWrap = document.createElement('div');
nomeWrap.style.cssText = `display:flex; flex-direction:column; gap:2px; flex:1;`;

const nomeNpc = document.createElement('div');
nomeNpc.style.cssText = `font-size: 18px; font-weight: bold; letter-spacing: 0.5px;`;
nomeNpc.innerHTML = 'Guardião da Ponte';

const subtitulo = document.createElement('div');
subtitulo.style.cssText = `
    font-size: 10px; letter-spacing: 2px;
    font-style: italic; opacity: 0.6;
    text-transform: uppercase;
`;
subtitulo.textContent = 'Protetor da Passagem';

nomeWrap.append(nomeNpc, subtitulo);

const fecharBtn = document.createElement('button');
fecharBtn.style.cssText = `
    background: none; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 50%; cursor: pointer;
    font-size: 14px; width: 28px; height: 28px;
    transition: all 0.2s;
    display: flex; align-items: center; justify-content: center;
`;
fecharBtn.textContent = '✕';

header.append(retrato, nomeWrap, fecharBtn);

// ---------- Conteúdo Diálogo ----------
const dialogueView = document.createElement('div');
dialogueView.style.cssText = `display: flex; flex-direction: column; flex: 1; overflow: hidden;`;

const falaWrap = document.createElement('div');
falaWrap.style.cssText = `
    padding: 15px 28px 5px; flex-shrink: 0;
    height: 100px; box-sizing: border-box;
    display: flex; align-items: flex-start; gap: 16px;
    overflow: hidden;
    cursor: default;
    user-select: none;
`;

const aspas = document.createElement('div');
aspas.style.cssText = `font-size: 38px; line-height: 0.6; margin-top: 10px; opacity: 0.3; flex-shrink: 0;`;
aspas.textContent = '“';

const falaTexto = document.createElement('div');
falaTexto.style.cssText = `font-size: 15px; line-height: 1.5; flex: 1; overflow: hidden;`;

falaWrap.append(aspas, falaTexto);

const escolhasDiv = document.createElement('div');
escolhasDiv.style.cssText = `
    padding: 10px 28px 20px;
    flex: 1;
    display: flex; flex-direction: column;
    justify-content: flex-start;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
`;

// Click na área de texto para saltar typing
falaWrap.onclick = () => {
    if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
        falaTexto.textContent = currentTypingText;
        falaWrap.style.cursor = 'default';
        const cb = currentTypingCallback;
        currentTypingText = '';
        currentTypingCallback = null;
        if (cb) cb();
    }
};

dialogueView.append(falaWrap, escolhasDiv);
caixa.append(header, dialogueView);
caixaExt.appendChild(caixa);
overlay.appendChild(caixaExt);
document.body.appendChild(overlay);

// ==========================================
//  Lógica de UI
// ==========================================

function renderHistoryEntry(role, text) {
    const entry = document.createElement('div');
    entry.style.cssText = `
        border-left: 2px solid ${role === 'npc' ? currentTheme.accent : 'rgba(255,255,255,0.2)'};
        padding-left: 12px; margin-bottom: 4px;
        flex-shrink: 0;
    `;
    
    const label = document.createElement('div');
    label.style.cssText = `
        font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px;
        color: ${role === 'npc' ? currentTheme.accent : currentTheme.bodyTextDim};
        font-weight: bold; margin-bottom: 2px;
    `;
    label.textContent = role === 'npc' ? 'Guerreiro' : 'Herói';
    
    const content = document.createElement('div');
    content.style.cssText = `
        font-size: 12px; line-height: 1.4; color: ${currentTheme.bodyText};
        font-family: ${currentTheme.bodyFont};
        ${role === 'player' ? 'font-style: italic; opacity: 0.8;' : ''}
    `;
    content.textContent = text;
    
    entry.append(label, content);
    summaryContent.appendChild(entry);
}

function addToHistory(role, text) {
    historyLog.push({ role, text });
    renderHistoryEntry(role, text);
    // Auto-scroll history box se não estiver expandido (mostra o fundo)
    if (!summaryExpanded) {
        summaryBox.scrollTop = summaryBox.scrollHeight;
    }
}

function renderHistoryFromLog() {
    summaryContent.innerHTML = '';
    for (const e of historyLog) renderHistoryEntry(e.role, e.text);
}

function aplicarTema(themeKey) {
    const theme = THEMES[themeKey] || THEMES.tavern;
    currentTheme = theme;

    overlay.style.fontFamily = theme.bodyFont;

    accentsContainer.innerHTML = '';
    if (theme.sceneAccents) {
        theme.sceneAccents.forEach(acc => {
            const div = document.createElement('div');
            div.style.cssText = `
                position: absolute; left: ${acc.left}; top: ${acc.top};
                width: ${acc.size}px; height: ${acc.size}px;
                background: ${acc.color}; filter: blur(${acc.size / 3}px);
                border-radius: 50%; opacity: 0.3;
            `;
            accentsContainer.appendChild(div);
        });
    }

    summaryBox.style.background = `${theme.panel}BB`;
    summaryHeader.style.background = `rgba(0,0,0,0.15)`;
    summaryLabel.style.color = theme.accent;
    summaryArrow.style.color = theme.accent;

    caixaExt.style.background = `linear-gradient(135deg, ${theme.panelBorder}66, ${theme.panelBorder}11)`;
    caixaExt.style.boxShadow = `0 25px 50px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.1)`;

    caixa.style.background = `${theme.panel}DD`;
    caixa.style.borderColor = 'rgba(255,255,255,0.1)';

    header.style.background = 'rgba(0,0,0,0.2)';
    retrato.style.border = `2px solid ${theme.accent}66`;
    retrato.style.color = theme.accent;

    nomeNpc.style.color = theme.nameText;
    nomeNpc.style.fontFamily = theme.nameFont;
    subtitulo.style.color = theme.accent;

    fecharBtn.style.color = theme.bodyTextDim;
    aspas.style.color = theme.accent;
    falaTexto.style.color = theme.bodyText;
    falaTexto.style.fontFamily = theme.bodyFont;
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
    falaWrap.style.cursor = 'pointer';

    typingInterval = setInterval(() => {
        falaTexto.textContent += texto[i++];
        if (i >= texto.length) {
            clearInterval(typingInterval);
            typingInterval = null;
            currentTypingText = '';
            currentTypingCallback = null;
            falaWrap.style.cursor = 'default';
            if (onFim) onFim();
        }
    }, 15);
}

function escolhasDisponiveis() {
    if (currentNpcConfig && typeof currentNpcConfig.getEscolhas === 'function') {
        return currentNpcConfig.getEscolhas().filter(e => {
            if (e.condicao && !e.condicao()) return false;
            if (!e.repetivel && usedIds.has(e.id)) return false;
            return true;
        });
    }
    // Fallback: guardião — sem opção de "passar" no diálogo
    // (a passagem é concedida fora do diálogo, em main.js, quando o jogador
    // tem nível 2+ e interage). O diálogo só serve para conversa.
    const tier = passagemConcedida ? 'posPassagem' : 'fraco';
    return ESCOLHAS[tier].filter(e => e.repetivel || !usedIds.has(e.id));
}

function mostrarEscolhas() {
    escolhasDiv.innerHTML = '';
    const lista = escolhasDisponiveis();
    const theme = currentTheme;

    const numChoices = lista.length;
    // escolhasDiv real: caixa(440) - header(76) - falaWrap(100) - padding(10+20) = 234px
    const availableHeight = 234;
    const totalGaps = Math.max(0, numChoices - 1) * 6;
    const baseButtonHeight = numChoices > 0 ? (availableHeight - totalGaps) / numChoices : 30;

    const paddingY = Math.min(12, Math.max(4, (baseButtonHeight - 18) / 2));
    const fontSize = Math.min(15, Math.max(11, baseButtonHeight / 2.6));
    const gapSize = Math.min(8, Math.max(3, 140 / (numChoices * 4)));

    escolhasDiv.style.gap = `${gapSize}px`;

    lista.forEach((escolha) => {
        const btn = document.createElement('button');
        const isAcao = escolha.acao === 'passar' || escolha.acao === 'passar_agora';

        btn.style.cssText = `
            text-align: left; background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-left: 4px solid ${isAcao ? theme.accent : 'rgba(255,255,255,0.1)'};
            border-radius: 4px; 
            padding: ${paddingY}px 22px;
            color: ${theme.choiceText}; font-family: ${theme.bodyFont};
            font-size: ${fontSize}px; line-height: 1.2; cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        `;

        btn.innerHTML = `<span style="color:${theme.accent};margin-right:12px;font-weight:bold;opacity:0.8;">▸</span>${escolha.label}`;

        btn.onmouseenter = () => {
            btn.style.background = 'rgba(255, 255, 255, 0.12)';
            btn.style.borderColor = theme.accent + '55';
            btn.style.borderLeftColor = theme.accent;
            btn.style.transform = 'translateX(8px)';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'rgba(255, 255, 255, 0.05)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            btn.style.borderLeftColor = isAcao ? theme.accent : 'rgba(255,255,255,0.1)';
            btn.style.transform = 'translateX(0)';
        };

        btn.onclick = () => tratarEscolha(escolha);
        escolhasDiv.appendChild(btn);
    });
}

function tratarEscolha(escolha) {
    if (respondendoAtual) return;
    addToHistory('player', escolha.label);

    // Ação imediata (antes da resposta) — pode cancelar/fechar o diálogo.
    if (typeof escolha.acaoImediata === 'function') {
        const r = escolha.acaoImediata();
        if (r === 'cancelar') return;
    }

    // Sistema antigo (guardião) — `passar_agora` fecha e dispara callback.
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

    // respostas pode ser array OU função (para respostas dinâmicas).
    const candidatas = typeof escolha.respostas === 'function'
        ? escolha.respostas()
        : escolha.respostas;
    const resposta = Array.isArray(candidatas) ? pick(candidatas) : String(candidatas);

    escreverComEfeito(resposta, () => {
        respondendoAtual = false;
        if (escolha.acao === 'passar') passagemConcedida = true;
        if (typeof escolha.acaoApos === 'function') escolha.acaoApos();
        if (escolha.acao === 'fechar') {
            setTimeout(() => fecharDialogo(), 1000);
            return;
        }
        setTimeout(() => mostrarEscolhas(), 300);
    });
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialogoAberto) fecharDialogo();
});

// ==========================================
//  API genérica para abrir um diálogo com qualquer NPC
// ==========================================
function abrirDialogo(config) {
    if (dialogoAberto) return;
    dialogoAberto = true;
    currentNpcConfig = config;
    respondendoAtual = true;
    summaryExpanded = false;
    // Persiste a crónica por NPC entre interacções (chave = nome do NPC)
    const npcKey = config.nome || '_default_';
    if (!historyByNpc[npcKey]) historyByNpc[npcKey] = [];
    historyLog = historyByNpc[npcKey];

    aplicarTema(config.tema || 'tavern');

    // Identidade
    nomeNpc.textContent = config.nome || '';
    subtitulo.textContent = config.subtitulo || '';
    if (config.retratoUrl) {
        retrato.style.backgroundImage = `url('${config.retratoUrl}')`;
        retrato.textContent = '';
    } else {
        retrato.style.backgroundImage = '';
        retrato.textContent = config.retratoIcone || '⚔';
        retrato.style.fontSize = '22px';
    }

    overlay.style.display = 'flex';
    escolhasDiv.innerHTML = '';
    falaTexto.textContent = '';
    renderHistoryFromLog();

    summaryContent.style.maxHeight = '0';
    summaryContent.style.padding = '0 16px';
    summaryContent.style.overflowY = 'hidden';
    summaryArrow.style.transform = 'rotate(0deg)';
    summaryBox.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';

    caixaExt.style.transition = 'none';
    caixaExt.style.transform = 'translateY(36px) scale(0.97)';
    caixaExt.style.opacity = '0';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            caixaExt.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease-out';
            caixaExt.style.transform = 'translateY(0) scale(1)';
            caixaExt.style.opacity = '1';
        });
    });

    setTimeout(() => {
        const abertura = typeof config.getAbertura === 'function' ? config.getAbertura() : '';
        escreverComEfeito(abertura, () => {
            respondendoAtual = false;
            mostrarEscolhas();
        });
    }, 200);
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
        // null deixa o sistema antigo (ESCOLHAS por tier) tomar conta
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
const MERCADOR_PRECOS = { pocao: 15, mega: 35, oculos_carga: 20, relampago_arcano: 180 };

const MERCADOR_FALAS_OFERTA = {
    pocao: [
        'Toma — {p} ✦. Cuida-te lá fora.',
        '{p} ✦ bem investidos. Que te seja útil.',
        'Aqui tens — não dês a mais ninguém.',
    ],
    mega: [
        'Esta é mais forte — {p} ✦. Usa-a com cabeça.',
        '{p} ✦ por isto. Não desperdices num arranhão.',
        'Guarda-a para quando contar mesmo. {p} ✦.',
    ],
    oculos_carga: [
        'Olha bem para eles — {p} ✦. Vês os ataques antes deles acontecerem.',
        '{p} ✦. Quem os usa nunca espera demais por uma carga.',
        'Raros, estes. {p} ✦ é uma pechincha.',
    ],
    relampago_arcano: [
        'Energia arcana destilada — {p} ✦. Aponta, e arde.',
        '{p} ✦. Não há armadura que aguente este raio.',
        'Aprendi-o há anos com um vidente cego. {p} ✦ e é teu.',
    ],
    semCintilas: [
        'Não tens Cintilas suficientes, viajante.',
        'Volta quando os bolsos estiverem mais cheios.',
        'Sem Cintilas não há negócio.',
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
        subtitulo: 'Mercador',
        retratoUrl: 'assets/textures/avatares/merchant.png',
        tema: themeKey,
        getAbertura: () => {
            const c = getCintilas();
            return c > 0
                ? `Bem-vindo, viajante. Tens ${c} ✦ contigo — vê se algo te agrada.`
                : 'Bem-vindo, viajante. Tenho ervas, talismãs e poções — mas tudo tem o seu preço.';
        },
        getEscolhas: () => {
            const c = getCintilas();

            const compraEscolha = (id, itemId, preco, falasOk) => ({
                id,
                repetivel: true,
                label: `${CATALOGO[itemId].icone}  ${CATALOGO[itemId].nome} — ${preco} ✦${(c >= preco) ? '' : '  (insuficiente)'}`,
                respostas: () => (c >= preco)
                    ? falasOk.map(f => _falaCom(f, preco))
                    : MERCADOR_FALAS_OFERTA.semCintilas,
                acaoImediata: () => {
                    if (c < preco) return; // resposta cobre o caso "sem cintilas"
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
            ];
            // Óculos: peça única, desaparece da loja depois de comprados
            if (!oculosJaComprados) {
                escolhasCompra.push(compraEscolha(
                    'comprar_oculos', 'oculos_carga',
                    MERCADOR_PRECOS.oculos_carga, MERCADOR_FALAS_OFERTA.oculos_carga
                ));
            }

            // ATAQUE MÁGICO — Relâmpago Arcano (compra única).
            const arcanoAprendido = ataqueState.desbloqueados.has('relampago_arcano');
            if (!arcanoAprendido) {
                const at = ATAQUES['relampago_arcano'];
                const preco = MERCADOR_PRECOS.relampago_arcano;
                escolhasCompra.push({
                    id: 'comprar_relampago_arcano',
                    repetivel: false,
                    label: `${at.icone}  ${at.nome} — ${preco} ✦${(c >= preco) ? '' : '  (insuficiente)'}`,
                    respostas: () => (c >= preco)
                        ? MERCADOR_FALAS_OFERTA.relampago_arcano.map(f => _falaCom(f, preco))
                        : MERCADOR_FALAS_OFERTA.semCintilas,
                    acaoImediata: () => {
                        if (c < preco) return;
                        gastarCintilas(preco);
                        desbloquearAtaque('relampago_arcano');
                        // equipar automaticamente num slot livre
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
                    label: 'Adeus, mercador.',
                    acao: 'fechar',
                    repetivel: true,
                    respostas: [
                        'Que a sorte te acompanhe, viajante.',
                        'Volta sempre — tenho coisas boas.',
                        'Bom proveito do que te resta.',
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
            label: '⚔  Tens algum trabalho para mim?',
            repetivel: true,
            respostas: [
                'Ontem... fui apanhada por uma emboscada na estrada. Levaram-me o que eu trazia. Quatro objetos importantes — perdidos pelos caminhos. Trá-mos de volta e recompenso-te bem.',
                'Uns bandidos saíram-me ao caminho ontem. Espalharam as minhas coisas pelo mapa. Se trouxeres os quatro objetos que perdi — saco, caderno, anel e pingente — recompenso-te com Cintilas.',
            ],
            acaoApos: () => {
                // Aceita automaticamente ao receber a explicação
                aceitarFetchQuest();
            },
        };
    }
    if (fase === 'ativa') {
        const { coletados, meta } = getFetchProgresso();
        return {
            id: 'fetch_progresso',
            label: `⚔  Sobre a tua tarefa  (${coletados}/${meta})`,
            repetivel: true,
            respostas: () => {
                const { coletados: c, meta: m } = getFetchProgresso();
                if (c === 0) return [
                    'Ainda não trouxeste nada. Procura nos caminhos onde costumam haver emboscadas.',
                    'Continuam por aí, viajante. Procura bem.',
                ];
                if (c < m) return [
                    `Vais bem — ${c} de ${m}. Faltam ainda alguns. Continua.`,
                    `${c}/${m}. Não desistas — os outros estão pelo mapa.`,
                ];
                return ['Já tens todos! Vem trazê-los.'];
            },
        };
    }
    if (fase === 'completa') {
        return {
            id: 'fetch_entregar',
            label: '✅  Tenho tudo o que perdeste.',
            repetivel: true,
            respostas: [
                `Os meus tesouros! Não sei como te agradecer... Toma — ${FETCH_RECOMPENSA_CINTILAS} ✦ e uma Poção Maior. Mereceste cada uma.`,
            ],
            acaoApos: () => {
                if (entregarFetchQuest()) {
                    ganharCintilas(FETCH_RECOMPENSA_CINTILAS);
                    adicionarItem('mega', 1);
                }
            },
        };
    }
    // 'entregue' — quest já feita
    return {
        id: 'fetch_concluida',
        label: '⚜  Sobre aquela emboscada...',
        repetivel: true,
        respostas: [
            'Já recuperei tudo graças a ti. Que os caminhos te tratem melhor do que me trataram.',
            'Sempre que precisares de algo, sabes onde estou.',
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
    caixaExt.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 1, 1), opacity 0.25s ease-in';
    caixaExt.style.transform = 'translateY(28px) scale(0.97)';
    caixaExt.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 280);
}

export function isDialogoAberto() {
    return dialogoAberto;
}
