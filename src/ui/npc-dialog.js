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
};

// id único por escolha. repetivel:true → mantém-se na lista após ser usada.
const ESCOLHAS = {
    fraco: [
        {
            id: 'urgente',
            label: 'Preciso de passar — é urgente.',
            respostas: [
                'A urgência não substitui o valor, jovem. Volta quando as tuas cicatrizes contarem histórias.',
                'Muitos disseram o mesmo. Muitos regressaram sem passar. Cresce em poder, depois fala comigo.',
                'A pressa é fraqueza disfarçada. Nenhuma urgência abre esta passagem antes do tempo.',
            ],
        },
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
            id: 'identidade_fraco',
            label: 'Quem és tu, guardião?',
            respostas: [
                'Sou o Guardião desta ponte há trezentos e quarenta anos. Nenhum indigno passou enquanto eu respirei.',
                'Um guerreiro ancião cuja armadura enferrujou mas cujo propósito nunca vacilou. Guardo esta travessia desde antes da tua avó nascer.',
                'O último de uma ordem esquecida. Os meus irmãos caíram. Eu fico. Esta ponte é o meu juramento.',
            ],
        },
        {
            id: 'norte_fraco',
            label: 'Que perigos há no norte?',
            respostas: [
                'Um castelo sombrio corrompido por uma força ancestral. Criaturas que outrora eram homens. Não és forte o suficiente... ainda.',
                'O mal cresce a cada lua cheia nas terras do norte. As zonas do sul onde vieste estão infestadas, mas o castelo é o verdadeiro perigo.',
                'O sábio da aldeia sabe mais do que diz sobre o que há no norte. Mas para atravessar, primeiro tens de me convencer com poder.',
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
    forte: [
        {
            id: 'passar',
            label: 'Quero atravessar a ponte.',
            acao: 'passar',
            repetivel: true,
            respostas: [
                'O teu valor está à vista. Passa, guerreiro — e que a tua lâmina seja afiada no que te espera.',
                'Reconheço a tua força. Esta ponte é tua. Vai, e não olhes para trás sem razão.',
                'Trezentos anos de guarda... e finalmente um digno passa. Vai. A tua missão aguarda-te.',
            ],
        },
        {
            id: 'norte_forte',
            label: 'O que há no norte?',
            respostas: [
                'Um castelo corrompido por sombras antigas. Criaturas que já foram homens. Vai preparado.',
                'O mal cresce lá dentro há décadas. O que encontrares no castelo... não será simples de derrotar.',
                'Terras corrompidas, criaturas sem razão, e no centro — um cristal negro que pulsa como um coração doente.',
            ],
        },
        {
            id: 'identidade_forte',
            label: 'Quem és tu, guardião?',
            respostas: [
                'Um guerreiro que escolheu o dever sobre a glória. Trezentos anos neste posto. Tu és dos poucos dignos que vi passar.',
                'O último da Ordem da Ponte. Os outros tombaram. Eu fico até que alguém suficientemente forte leve a luta ao norte.',
                'Apenas um velho soldado com uma missão. Mas hoje, vejo em ti o que procurava. Vai em frente.',
            ],
        },
        {
            id: 'adeus',
            label: 'Adeus, guardião.',
            acao: 'fechar',
            repetivel: true,
            respostas: [
                'Que os teus passos sejam firmes e o teu aço verdadeiro. Vai.',
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

// Persistência: ids já usados (não repetíveis ficam ocultos depois de usados)
const usedIds = new Set();
let lastTier = null;

// ==========================================
//  UI
// ==========================================
const overlay = document.createElement('div');
overlay.style.cssText = `
    position: fixed; inset: 0;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.85) 100%);
    display: none; align-items: flex-end; justify-content: center;
    z-index: 200; padding-bottom: 50px;
    font-family: 'Georgia', 'Times New Roman', serif;
    backdrop-filter: blur(2px);
`;

// ---------- Caixa exterior (moldura dourada) ----------
const caixaExt = document.createElement('div');
caixaExt.style.cssText = `
    width: min(700px, 94vw);
    padding: 4px;
    background: linear-gradient(135deg,
        #8a5a18 0%,
        #d4a830 25%,
        #f0c850 50%,
        #d4a830 75%,
        #8a5a18 100%);
    border-radius: 12px;
    box-shadow:
        0 0 60px rgba(220,150,40,0.35),
        0 12px 40px rgba(0,0,0,0.95),
        inset 0 0 4px rgba(255,220,120,0.6);
    transform: translateY(50px) scale(0.96);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(.2,.8,.2,1), opacity 0.3s ease-out;
`;

// ---------- Caixa interior (conteúdo) ----------
const caixa = document.createElement('div');
caixa.style.cssText = `
    background:
        linear-gradient(160deg, rgba(38,25,10,0.98) 0%, rgba(18,12,4,0.98) 100%),
        radial-gradient(ellipse at top, rgba(140,90,30,0.25) 0%, transparent 70%);
    border: 1px solid rgba(60,40,15,0.8);
    border-radius: 9px;
    box-shadow:
        inset 0 0 80px rgba(0,0,0,0.7),
        inset 0 1px 0 rgba(220,150,40,0.25);
    overflow: hidden;
    display: flex; flex-direction: column;
    max-height: 70vh;
`;

// ---------- Cabeçalho ----------
const header = document.createElement('div');
header.style.cssText = `
    background:
        linear-gradient(180deg, rgba(60,40,12,0.9) 0%, rgba(30,20,6,0.6) 100%);
    padding: 14px 20px 12px;
    display: flex; align-items: center; gap: 14px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(140,90,25,0.35);
    position: relative;
`;

// Linha decorativa fina sob o header
header.style.boxShadow = 'inset 0 -1px 0 rgba(220,160,40,0.4), 0 2px 4px rgba(0,0,0,0.5)';

// Retrato do guardião
const retrato = document.createElement('div');
retrato.style.cssText = `
    width: 56px; height: 56px;
    background:
        radial-gradient(circle at 35% 30%, #ff7030 0%, #c04018 35%, #5a1808 75%, #2a0c04 100%);
    border-radius: 50%;
    border: 2px solid #d4a830;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; flex-shrink: 0;
    box-shadow:
        0 0 18px rgba(255,100,30,0.5),
        inset 0 0 14px rgba(0,0,0,0.6),
        0 0 0 2px rgba(20,12,4,0.9),
        0 0 0 4px rgba(180,120,30,0.4);
`;
retrato.textContent = '⚔';

// Nome + ornamentos
const nomeWrap = document.createElement('div');
nomeWrap.style.cssText = `display:flex; flex-direction:column; gap:2px; flex:1;`;

const nomeNpc = document.createElement('div');
nomeNpc.style.cssText = `
    color: #f2d070;
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 2px;
    text-shadow:
        0 0 12px rgba(255,200,80,0.7),
        0 1px 2px rgba(0,0,0,1);
    font-variant: small-caps;
`;
nomeNpc.innerHTML = '<span style="color:#c89060;font-weight:normal;font-size:14px;">❖</span> Guardião da Ponte <span style="color:#c89060;font-weight:normal;font-size:14px;">❖</span>';

const subtitulo = document.createElement('div');
subtitulo.style.cssText = `
    color: #a07840; font-size: 11px; letter-spacing: 3px;
    font-style: italic; opacity: 0.85;
`;
subtitulo.textContent = 'Sentinela da Ponte do Norte';

nomeWrap.append(nomeNpc, subtitulo);

const fecharBtn = document.createElement('button');
fecharBtn.style.cssText = `
    background: none; border: 1px solid rgba(140,90,25,0.4);
    border-radius: 4px; cursor: pointer;
    color: #80604060; font-size: 16px; line-height: 1;
    width: 28px; height: 28px;
    transition: all 0.2s;
    display: flex; align-items: center; justify-content: center;
`;
fecharBtn.textContent = '✕';
fecharBtn.onmouseenter = () => {
    fecharBtn.style.color = '#f2d070';
    fecharBtn.style.borderColor = '#c8901c';
    fecharBtn.style.background = 'rgba(120,70,15,0.3)';
};
fecharBtn.onmouseleave = () => {
    fecharBtn.style.color = '#80604060';
    fecharBtn.style.borderColor = 'rgba(140,90,25,0.4)';
    fecharBtn.style.background = 'none';
};
fecharBtn.onclick = () => fecharDialogo();

header.append(retrato, nomeWrap, fecharBtn);

// ---------- Divisor ornamental ----------
function criarDivisor() {
    const div = document.createElement('div');
    div.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        padding: 0 24px; margin: 4px 0;
        flex-shrink: 0;
    `;
    div.innerHTML = `
        <div style="flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(180,130,40,0.5), transparent);"></div>
        <span style="color:#a07840; font-size:10px; letter-spacing:4px;">◆</span>
        <div style="flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(180,130,40,0.5), transparent);"></div>
    `;
    return div;
}

// ---------- Fala do guardião ----------
const falaWrap = document.createElement('div');
falaWrap.style.cssText = `
    padding: 14px 24px 16px;
    flex-shrink: 0;
    min-height: 70px;
    display: flex; align-items: flex-start; gap: 12px;
`;

const aspas = document.createElement('div');
aspas.style.cssText = `
    color: #c8901c; font-size: 36px; line-height: 0.6;
    margin-top: 8px; opacity: 0.5;
    font-family: 'Georgia', serif;
    flex-shrink: 0;
`;
aspas.textContent = '“';

const falaTexto = document.createElement('div');
falaTexto.style.cssText = `
    color: #ecd49a; font-size: 15px; line-height: 1.65;
    font-style: italic; flex: 1;
    text-shadow: 0 1px 2px rgba(0,0,0,0.7);
`;

falaWrap.append(aspas, falaTexto);

// ---------- Escolhas ----------
const escolhasDiv = document.createElement('div');
escolhasDiv.style.cssText = `
    flex: 1; overflow-y: auto;
    padding: 4px 18px 18px;
    display: flex; flex-direction: column; gap: 8px;
    scrollbar-width: thin; scrollbar-color: #6a4a18 transparent;
`;

caixa.append(header, falaWrap, criarDivisor(), escolhasDiv);
caixaExt.appendChild(caixa);
overlay.appendChild(caixaExt);
document.body.appendChild(overlay);

// ==========================================
//  Lógica
// ==========================================
function escreverComEfeito(texto, onFim) {
    if (typingInterval) clearInterval(typingInterval);
    falaTexto.textContent = '';
    let i = 0;
    typingInterval = setInterval(() => {
        falaTexto.textContent += texto[i++];
        if (i >= texto.length) {
            clearInterval(typingInterval);
            typingInterval = null;
            if (onFim) onFim();
        }
    }, 22);
}

function escolhasDisponiveis() {
    const tier = playerLevel >= 2 ? 'forte' : 'fraco';
    if (passagemConcedida) {
        return [{ id: 'passar_agora', label: '⚔  Atravessar a ponte', acao: 'passar_agora', repetivel: true }];
    }
    return ESCOLHAS[tier].filter(e => e.repetivel || !usedIds.has(e.id));
}

function mostrarEscolhas() {
    escolhasDiv.innerHTML = '';
    const lista = escolhasDisponiveis();

    lista.forEach((escolha, idx) => {
        const btn = document.createElement('button');
        const isAcao = escolha.acao === 'passar' || escolha.acao === 'passar_agora';

        btn.style.cssText = `
            text-align: left;
            background: ${isAcao
                ? 'linear-gradient(135deg, rgba(180,120,30,0.4), rgba(80,50,12,0.5))'
                : 'linear-gradient(135deg, rgba(60,38,12,0.45), rgba(30,18,6,0.55))'};
            border: 1px solid ${isAcao ? '#c8901c' : 'rgba(120,80,25,0.55)'};
            border-left: 3px solid ${isAcao ? '#f0c850' : '#7a5018'};
            border-radius: 4px;
            padding: 11px 14px 11px 16px;
            color: ${isAcao ? '#f2d070' : '#d4b87a'};
            font-family: 'Georgia', serif;
            font-size: 14px; line-height: 1.45;
            cursor: pointer;
            transition: all 0.18s ease;
            position: relative;
            opacity: 0;
            transform: translateX(-8px);
            ${isAcao ? 'box-shadow: 0 0 12px rgba(220,160,40,0.25);' : ''}
        `;

        btn.innerHTML = `<span style="color:${isAcao ? '#f0c850' : '#a07840'};margin-right:8px;font-weight:bold;">▸</span>${escolha.label}`;

        btn.onmouseenter = () => {
            btn.style.background = isAcao
                ? 'linear-gradient(135deg, rgba(220,160,50,0.55), rgba(120,75,20,0.65))'
                : 'linear-gradient(135deg, rgba(110,75,20,0.6), rgba(60,38,12,0.7))';
            btn.style.borderLeftColor = '#f0c850';
            btn.style.borderColor = '#d4a830';
            btn.style.transform = 'translateX(2px)';
            btn.style.boxShadow = '0 0 16px rgba(220,160,40,0.4), inset 0 0 8px rgba(220,160,40,0.15)';
        };
        btn.onmouseleave = () => {
            btn.style.background = isAcao
                ? 'linear-gradient(135deg, rgba(180,120,30,0.4), rgba(80,50,12,0.5))'
                : 'linear-gradient(135deg, rgba(60,38,12,0.45), rgba(30,18,6,0.55))';
            btn.style.borderLeftColor = isAcao ? '#f0c850' : '#7a5018';
            btn.style.borderColor = isAcao ? '#c8901c' : 'rgba(120,80,25,0.55)';
            btn.style.transform = 'translateX(0)';
            btn.style.boxShadow = isAcao ? '0 0 12px rgba(220,160,40,0.25)' : 'none';
        };

        btn.onclick = () => tratarEscolha(escolha);
        escolhasDiv.appendChild(btn);

        // stagger fade-in
        setTimeout(() => {
            btn.style.transition = 'all 0.25s ease, transform 0.18s ease';
            btn.style.opacity = '1';
            btn.style.transform = 'translateX(0)';
        }, 60 + idx * 70);
    });
}

function tratarEscolha(escolha) {
    if (respondendoAtual) return;

    if (escolha.acao === 'passar_agora') {
        fecharDialogo();
        if (onPassar) onPassar();
        return;
    }

    respondendoAtual = true;

    // marca como usada se não for repetível
    if (!escolha.repetivel) usedIds.add(escolha.id);

    // remove botões com fade-out
    [...escolhasDiv.children].forEach(btn => {
        btn.style.transition = 'opacity 0.15s';
        btn.style.opacity = '0';
    });
    setTimeout(() => { escolhasDiv.innerHTML = ''; }, 150);

    const resposta = pick(escolha.respostas);
    escreverComEfeito(resposta, () => {
        respondendoAtual = false;
        if (escolha.acao === 'passar') {
            passagemConcedida = true;
        }
        if (escolha.acao === 'fechar') {
            setTimeout(() => fecharDialogo(), 1100);
            return;
        }
        setTimeout(() => mostrarEscolhas(), 350);
    });
}

// Fechar com ESC
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialogoAberto) fecharDialogo();
});

// ==========================================
//  API pública
// ==========================================
export function abrirDialogoGuardiao(level, callbackPassar) {
    if (dialogoAberto) return;
    dialogoAberto = true;
    playerLevel = level;
    onPassar = callbackPassar;
    passagemConcedida = false;
    respondendoAtual = true;

    // reset usedIds se o tier mudou
    const tier = level >= 2 ? 'forte' : 'fraco';
    if (tier !== lastTier) {
        usedIds.clear();
        lastTier = tier;
    }

    overlay.style.display = 'flex';
    escolhasDiv.innerHTML = '';
    falaTexto.textContent = '';

    // animação de entrada
    requestAnimationFrame(() => {
        caixaExt.style.transform = 'translateY(0) scale(1)';
        caixaExt.style.opacity = '1';
    });

    setTimeout(() => {
        const abertura = pick(level >= 2 ? ABERTURA.forte : ABERTURA.fraco);
        escreverComEfeito(abertura, () => {
            respondendoAtual = false;
            mostrarEscolhas();
        });
    }, 220);
}

export function fecharDialogo() {
    if (!dialogoAberto) return;
    dialogoAberto = false;
    if (typingInterval) { clearInterval(typingInterval); typingInterval = null; }
    caixaExt.style.transform = 'translateY(50px) scale(0.96)';
    caixaExt.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 250);
}

export function isDialogoAberto() {
    return dialogoAberto;
}
