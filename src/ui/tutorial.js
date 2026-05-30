// ===========================================================
// TUTORIAL.JS — Dicas contextuais pixelizadas (canto superior)
// ----------------------------------------------------------
// Mostra cartões de ajuda no canto superior direito, no mesmo
// estilo pixel/medieval do HUD (Press Start 2P + VT323, molduras
// de madeira feitas com box-shadow empilhada).
//
// Cada dica dispara UMA só vez. Uso:
//   import { dispararTutorial } from './tutorial.js';
//   dispararTutorial('tocha');
// ===========================================================

import { isGamepadMode, psGlyph } from './glyphs.js';

// ---- fontes pixel (idempotente; o HUD também as carrega) ----
(function carregarFontesTutorial() {
    if (document.getElementById('hud-pixel-fonts') || document.getElementById('tutorial-pixel-fonts')) return;
    const link = document.createElement('link');
    link.id = 'tutorial-pixel-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
    document.head.appendChild(link);
})();

// ---- estilos (injectados uma só vez) ----
(function injectarEstilosTutorial() {
    if (document.getElementById('tutorial-styles')) return;
    const s = document.createElement('style');
    s.id = 'tutorial-styles';
    s.textContent = `
        #tutorial-layer {
            position: fixed; top: 16px; right: 16px;
            display: flex; flex-direction: column; gap: 12px;
            align-items: flex-end;
            z-index: 600; pointer-events: none;
            image-rendering: pixelated;
        }
        .tut-card {
            position: relative;
            width: 280px;
            padding: 12px 14px;
            background: linear-gradient(180deg, #2a1c0e 0%, #160e06 100%);
            box-shadow:
                0 0 0 2px #0a0704,
                0 0 0 4px #4a2f08,
                0 0 0 6px #0a0704,
                6px 8px 0 6px rgba(0,0,0,0.45);
            image-rendering: pixelated;
            /* entrada/saída em passos para dar sensação pixel */
            opacity: 0; transform: translateX(28px);
            transition: opacity .3s steps(5), transform .3s steps(5);
        }
        .tut-card.show { opacity: 1; transform: translateX(0); }
        .tut-card.hide { opacity: 0; transform: translateX(28px); }

        /* rebites dourados nos cantos */
        .tut-card .tut-rivet {
            position: absolute; width: 4px; height: 4px;
            background: #ffd86b; box-shadow: 0 0 0 1px #0a0704;
        }
        .tut-card .tut-rivet.tl { top: 3px; left: 3px; }
        .tut-card .tut-rivet.tr { top: 3px; right: 3px; }
        .tut-card .tut-rivet.bl { bottom: 3px; left: 3px; }
        .tut-card .tut-rivet.br { bottom: 3px; right: 3px; }

        .tut-titulo {
            font-family: 'Press Start 2P', monospace;
            font-size: 10px; letter-spacing: 1px;
            color: #ffd86b;
            text-shadow: 0 2px 0 #4a2f08, 0 3px 0 #0a0704;
            line-height: 1.3;
            margin-bottom: 9px;
            padding-bottom: 8px;
            border-bottom: 2px solid #4a2f08;
        }
        .tut-corpo { display: flex; align-items: center; gap: 10px; }
        .tut-teclas { display: flex; flex-wrap: wrap; gap: 4px; flex-shrink: 0; }
        .tut-tecla {
            font-family: 'Press Start 2P', monospace;
            font-size: 11px; color: #fff4c2;
            background: linear-gradient(180deg, #5a3f12 0%, #2e2008 100%);
            padding: 7px 8px; min-width: 14px; text-align: center;
            box-shadow:
                0 0 0 2px #0a0704,
                inset 0 1px 0 rgba(255,255,255,0.18),
                0 3px 0 0 #0a0704;
            animation: tutKey 1.1s steps(2) infinite;
        }
        @keyframes tutKey {
            0%, 100% { filter: brightness(1); }
            50%      { filter: brightness(1.5); }
        }
        /* Glyph de comando: sem a moldura da tecla, só o botão PS a piscar */
        .tut-tecla.tut-tecla-ps {
            background: none; box-shadow: none;
            padding: 0; min-width: 0; font-size: 18px;
        }
        .tut-texto {
            font-family: 'VT323', monospace;
            font-size: 19px; line-height: 1.1;
            color: #f0e6d2;
            text-shadow: 0 1px 0 #0a0704;
        }
        .tut-rodape {
            margin-top: 9px; padding-top: 7px;
            border-top: 1px solid rgba(74,47,8,0.7);
            font-family: 'VT323', monospace; font-size: 14px;
            font-style: italic; color: #a8895a; text-align: right;
        }
    `;
    document.head.appendChild(s);
})();

// ---- camada DOM ----
let layer = document.getElementById('tutorial-layer');
if (!layer) {
    layer = document.createElement('div');
    layer.id = 'tutorial-layer';
    document.body.appendChild(layer);
}

// ---- passos pré-definidos (português, voz do jogo) ----
const PASSOS = {
    movimento: {
        titulo: 'PRIMEIROS PASSOS',
        teclas: ['W', 'A', 'S', 'D'],
        botoes: ['lstick'],
        texto: 'Movei-vos pelos aposentos com estas teclas.',
        textoGamepad: 'Movei-vos pelos aposentos com o stick esquerdo.',
        rodape: 'Procurai a porta para descer à estalagem',
        accao: 'mover',
        dismissOnUse: true,
    },
    tocha: {
        titulo: 'LUZ NA ESCURIDÃO',
        teclas: ['N'],
        botoes: ['l1'],
        texto: 'Premi N para empunhar a Tocha do Viajante e rasgar as trevas.',
        textoGamepad: 'Premi L1 para empunhar a Tocha do Viajante e rasgar as trevas.',
        rodape: 'A escuridão não vos reclamará',
        accao: 'tocha',
        dismissOnUse: true,
    },
    inventario: {
        titulo: 'OS VOSSOS HAVERES',
        teclas: ['I'],
        botoes: ['triangle'],
        texto: 'Premi I para abrir a bolsa e usar os vossos elixires e haveres.',
        textoGamepad: 'Premi △ para abrir a bolsa e usar os vossos elixires e haveres.',
        rodape: 'Premi I ou interagi com algo para dispensar',
        rodapeGamepad: 'Premi △ ou interagi com algo para dispensar',
        persistente: true,
        accao: 'inventario',
        dismissOnUse: true,
    },
    arsenal: {
        titulo: 'O VOSSO ARSENAL',
        teclas: ['V'],
        botoes: ['l2'],
        texto: 'Premi V para abrir o arsenal e trocar os golpes que empunhais.',
        textoGamepad: 'Premi L2 para abrir o arsenal e trocar os golpes que empunhais.',
        rodape: 'Equipai os golpes adquiridos antes da peleja',
        accao: 'arsenal',
        dismissOnUse: true,
    },
    combate: {
        titulo: 'A ARTE DA PELEJA',
        teclas: ['J', 'K', 'L'],
        texto: 'Combate por turnos: J para Atacar, K para Itens, L para Fugir. Premi 1-4 para escolher o golpe. Nos chefes, esquivai-vos com W A S D.',
        rodape: 'A vitória pertence aos audazes',
        persistente: true,
    },
};

const _mostrados = new Set();   // dicas já exibidas
const _fila = [];               // dicas em espera (uma de cada vez)
let _ativa = false;
const _persistentes = new Map(); // chave -> fechar() das dicas que ficam fixas
const _ativos = [];              // dicas no ecrã que se fecham ao usar a acção
let _comprasAtaque = 0;          // contador de golpes comprados na loja
const DURACAO = 8500;           // ms que cada cartão temporário permanece no ecrã

// Dispara uma dica pré-definida (uma só vez por chave).
export function dispararTutorial(chave) {
    const passo = PASSOS[chave];
    if (!passo || _mostrados.has(chave)) return;
    _mostrados.add(chave);
    if (passo.persistente) {
        _render(passo,
            () => _persistentes.delete(chave),
            (fechar) => _persistentes.set(chave, fechar));
    } else {
        _fila.push(passo);
        if (!_ativa) _processarFila();
    }
}

// Dica avulsa: dispararTutorialCustom({ titulo, teclas, texto, rodape }).
export function dispararTutorialCustom(passo) {
    _fila.push(passo);
    if (!_ativa) _processarFila();
}

// Fecha uma dica persistente (ex.: 'inventario').
export function descartarTutorial(chave) {
    const fechar = _persistentes.get(chave);
    if (fechar) fechar();
}

// Fecha as dicas no ecrã associadas a uma acção, assim que ela é usada.
// Serve teclado e comando (o objecto `keys` reflecte ambos). Idempotente.
export function descartarTutorialPorAccao(accao) {
    if (!_ativos.length) return;
    for (const entry of [..._ativos]) {
        if (entry.accao === accao) entry.fechar();
    }
}

// Notifica a compra de um golpe na loja. À 3ª compra, ensina o arsenal (V).
export function notificarCompraAtaque() {
    _comprasAtaque++;
    if (_comprasAtaque >= 3) dispararTutorial('arsenal');
}

// Limpa todas as dicas do ecrã e da fila (ex.: ao mudar de cena).
export function limparTutoriais() {
    // 1. Limpar fila de espera
    _fila.length = 0;
    _ativa = false;

    // 2. Fechar todos os persistentes
    for (const fechar of _persistentes.values()) {
        fechar();
    }
    _persistentes.clear();

    // 3. Fechar todos os activos que aguardam acção
    // Usamos uma cópia para evitar problemas ao remover durante a iteração
    const ativosCopy = [..._ativos];
    for (const entry of ativosCopy) {
        entry.fechar();
    }
    // _ativos será limpo pelas próprias funções fechar() chamadas acima
}

function _processarFila() {
    const passo = _fila.shift();
    if (!passo) { _ativa = false; return; }
    _ativa = true;
    _render(passo, () => setTimeout(_processarFila, 250));
}

function _render(passo, onClose, onReady) {
    const card = document.createElement('div');
    card.className = 'tut-card';
    // Em modo comando mostramos os glyphs do gamepad (e o texto/rodapé
    // adaptados) sempre que o passo os definir; caso contrário, teclado.
    const usarComando = isGamepadMode() && passo.botoes && passo.botoes.length;
    const teclasHTML = usarComando
        ? passo.botoes.map(b => `<span class="tut-tecla tut-tecla-ps">${psGlyph(b)}</span>`).join('')
        : (passo.teclas || []).map(t => `<span class="tut-tecla">${t}</span>`).join('');
    const texto = (usarComando && passo.textoGamepad) ? passo.textoGamepad : passo.texto;
    const rodape = (usarComando && passo.rodapeGamepad) ? passo.rodapeGamepad : passo.rodape;
    card.innerHTML = `
        <span class="tut-rivet tl"></span><span class="tut-rivet tr"></span>
        <span class="tut-rivet bl"></span><span class="tut-rivet br"></span>
        <div class="tut-titulo">${passo.titulo}</div>
        <div class="tut-corpo">
            ${teclasHTML ? `<div class="tut-teclas">${teclasHTML}</div>` : ''}
            <div class="tut-texto">${texto}</div>
        </div>
        ${rodape ? `<div class="tut-rodape">${rodape}</div>` : ''}
    `;
    layer.appendChild(card);
    requestAnimationFrame(() => card.classList.add('show'));

    let fechado = false;
    let entry = null;
    const fechar = () => {
        if (fechado) return;
        fechado = true;
        if (entry) {
            const i = _ativos.indexOf(entry);
            if (i !== -1) _ativos.splice(i, 1);
        }
        card.classList.remove('show');
        card.classList.add('hide');
        setTimeout(() => { card.remove(); if (onClose) onClose(); }, 350);
    };
    // Dicas que se fecham ao usar a acção entram no registo de activos.
    if (passo.dismissOnUse && passo.accao) {
        entry = { accao: passo.accao, fechar };
        _ativos.push(entry);
    }
    if (passo.persistente) {
        // Dica fixa: não fecha sozinha — espera por descartarTutorial().
        if (onReady) onReady(fechar);
    } else {
        setTimeout(fechar, DURACAO);
    }
}

// As dicas fecham-se assim que a acção é usada — ver descartarTutorialPorAccao,
// chamado a cada frame pelo loop principal a partir do estado `keys` (que
// reflecte teclado e comando).
