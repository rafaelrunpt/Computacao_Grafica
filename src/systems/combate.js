import { grassZones, limparZonaBatalha } from '../world/mapa.js';
import { ganharXP, playerStats, receberDano, recuperarTotal, getAtkEfetivo } from './player-stats.js';
import { entrarCombate, sairCombate, getMundoSnapshot } from '../core/transicoes.js';
import { combateInimigo } from '../world/combate-scene.js';
import { getItens, usarItem } from './inventario.js';
import { playSFX, switchMusic } from './audio.js';
import { player } from '../entities/jogador.js';
import {
    mostrarCombateUI, esconderCombateUI, setCombateHandlers,
    setHpInimigo, setHpPlayer, setLog, setBotoesAtivos, preencherItens
} from '../ui/combate-ui.js';

export const estadoJogo = { emCombate: false, combateX: 0, combateZ: 0 };

// ----------------------------------------------------------------------
// EFEITO DE GLITCH ROXO (mantido — toca antes da transição para a arena)
// ----------------------------------------------------------------------
const glitchCanvas = document.createElement('canvas');
glitchCanvas.style.cssText = `
    position: fixed; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    display: none;
    z-index: 250;
`;
document.body.appendChild(glitchCanvas);
const gCtx = glitchCanvas.getContext('2d');

function resizeGlitch() {
    glitchCanvas.width  = window.innerWidth;
    glitchCanvas.height = window.innerHeight;
}
resizeGlitch();
window.addEventListener('resize', resizeGlitch);

let glitchRaf = null, glitchStartTime = 0, glitchDuration = 0, glitchOnEnd = null;

function drawGlitch(t) {
    const w = glitchCanvas.width, h = glitchCanvas.height;
    gCtx.clearRect(0, 0, w, h);

    const alpha = 0.35 + 0.35 * Math.sin(t * 18);
    gCtx.fillStyle = `rgba(40, 0, 70, ${alpha})`;
    gCtx.fillRect(0, 0, w, h);

    const nLinhas = 6 + Math.floor(Math.random() * 8);
    for (let i = 0; i < nLinhas; i++) {
        const y      = Math.random() * h;
        const lh     = 2 + Math.random() * 18;
        const offset = (Math.random() - 0.5) * 80;
        const r = 120 + Math.floor(Math.random() * 80);
        const b = 180 + Math.floor(Math.random() * 75);
        const a = 0.4 + Math.random() * 0.5;
        gCtx.fillStyle = `rgba(${r},0,${b},${a})`;
        gCtx.fillRect(0, y, w, lh);
        gCtx.save();
        gCtx.globalCompositeOperation = 'screen';
        gCtx.fillStyle = `rgba(${r},0,${b},${a * 0.6})`;
        gCtx.fillRect(offset, y, w * (0.3 + Math.random() * 0.5), lh * 0.5);
        gCtx.restore();
    }

    gCtx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 3) gCtx.fillRect(0, y, w, 1);

    const nPixels = 300 + Math.floor(Math.random() * 400);
    for (let i = 0; i < nPixels; i++) {
        const px = Math.random() * w, py = Math.random() * h;
        const bright = Math.random() > 0.5;
        gCtx.fillStyle = bright
            ? `rgba(220,160,255,${0.4 + Math.random() * 0.6})`
            : `rgba(80,0,140,${0.5 + Math.random() * 0.5})`;
        gCtx.fillRect(px, py, 2 + Math.random() * 4, 1 + Math.random() * 3);
    }

    const grad = gCtx.createRadialGradient(w/2, h/2, h * 0.25, w/2, h/2, h * 0.85);
    const vAlpha = 0.3 + 0.4 * Math.abs(Math.sin(t * 6));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(60,0,100,${vAlpha})`);
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, w, h);
}

function glitchLoop(timestamp) {
    if (!glitchStartTime) glitchStartTime = timestamp;
    const elapsed = (timestamp - glitchStartTime) / 1000;
    if (elapsed >= glitchDuration) {
        gCtx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height);
        glitchCanvas.style.display = 'none';
        if (glitchOnEnd) glitchOnEnd();
        glitchRaf = null;
        return;
    }
    drawGlitch(elapsed);
    glitchRaf = requestAnimationFrame(glitchLoop);
}

function startGlitch(duration, onEnd) {
    if (glitchRaf) cancelAnimationFrame(glitchRaf);
    glitchStartTime = 0;
    glitchDuration = duration;
    glitchOnEnd = onEnd;
    glitchCanvas.style.display = 'block';
    glitchRaf = requestAnimationFrame(glitchLoop);
}

// ----------------------------------------------------------------------
// VERIFICAÇÃO DE ENCONTRO (chamada pelo loop do mundo)
// ----------------------------------------------------------------------
export function verificarEncontro(x, z) {
    if (estadoJogo.emCombate) return;
    if (playerStats.derrotado) return; // bloqueado até recuperar
    for (const zona of grassZones) {
        if (x >= zona.min.x && x <= zona.max.x && z >= zona.min.z && z <= zona.max.z) {
            if (Math.random() < 0.01) {
                estadoJogo.combateX = x;
                estadoJogo.combateZ = z;
                iniciarCombate();
            }
            return;
        }
    }
}

// ----------------------------------------------------------------------
// ESTADO DE COMBATE (turn-based simples)
// ----------------------------------------------------------------------
const inimigoBase = {
    nome: 'SHACO CORROMPIDO',
    hp: 30, maxHp: 30,
    atk: 4,
    xpDrop: 35,
};
let inimigoAtual = { ...inimigoBase };

function novoInimigo() {
    inimigoAtual = { ...inimigoBase };
}

function refreshHpUI() {
    setHpInimigo(inimigoAtual.hp, inimigoAtual.maxHp);
    setHpPlayer(playerStats.hp, playerStats.maxHp);
}

// bloqueia ações enquanto uma animação de turno está a decorrer
let turnoBloqueado = false;
function bloquearTurno(ms, fim) {
    turnoBloqueado = true;
    setBotoesAtivos(false);
    setTimeout(() => {
        turnoBloqueado = false;
        if (fim) fim();
    }, ms);
}

// ---- ações ----
function acaoAtacar() {
    if (turnoBloqueado) return;
    const dano = getAtkEfetivo() + Math.floor(Math.random() * 4);
    inimigoAtual.hp = Math.max(0, inimigoAtual.hp - dano);
    setLog(`Atacaste o ${inimigoAtual.nome}! Causaste ${dano} de dano.`);
    pulsarInimigo();
    refreshHpUI();

    if (inimigoAtual.hp <= 0) {
        bloquearTurno(900, finalizarVitoria);
        return;
    }
    bloquearTurno(800, turnoInimigo);
}

function acaoItem(item) {
    if (turnoBloqueado) return;
    if (item.quantidade <= 0) return;
    const r = usarItem(item.id);
    setLog(r.mensagem);
    refreshHpUI();
    // refresca o painel para mostrar nova quantidade
    preencherItens(getItens(), acaoItem);
    if (!r.ok) {
        // tentativa inválida não consome turno
        setBotoesAtivos(true);
        return;
    }
    bloquearTurno(800, turnoInimigo);
}

function acaoFugir() {
    if (turnoBloqueado) return;
    const sucesso = Math.random() < 0.6;
    if (sucesso) {
        setLog('Conseguiste fugir!');
        bloquearTurno(700, () => finalizarFuga());
    } else {
        setLog('Falhaste a fuga! O inimigo aproveita...');
        bloquearTurno(800, turnoInimigo);
    }
}

function turnoInimigo() {
    if (inimigoAtual.hp <= 0) return;
    const dano = inimigoAtual.atk + Math.floor(Math.random() * 3);
    receberDano(dano);
    setLog(`${inimigoAtual.nome} ataca! Sofreste ${dano} de dano.`);
    pulsarPlayer();
    refreshHpUI();

    if (playerStats.hp <= 0) {
        bloquearTurno(900, finalizarDerrota);
        return;
    }
    setBotoesAtivos(true);
}

// ---- micro-animações (flash) ----
function pulsarInimigo() {
    const m = combateInimigo.material;
    const original = m.emissiveIntensity;
    m.emissiveIntensity = 2.5;
    setTimeout(() => { m.emissiveIntensity = original; }, 180);
}
function pulsarPlayer() {
    const overlay = document.getElementById('combate-flash') || (() => {
        const o = document.createElement('div');
        o.id = 'combate-flash';
        o.style.cssText = 'position:fixed;inset:0;background:rgba(255,40,80,0.0);pointer-events:none;z-index:79;transition:background 0.18s;';
        document.body.appendChild(o);
        return o;
    })();
    overlay.style.background = 'rgba(255,40,80,0.35)';
    setTimeout(() => { overlay.style.background = 'rgba(255,40,80,0.0)'; }, 180);
}

// ----------------------------------------------------------------------
// FIM DE COMBATE
// ----------------------------------------------------------------------
function finalizarVitoria() {
    setLog(`Venceste! ${inimigoAtual.nome} foi destruído. (+${inimigoBase.xpDrop} XP)`);
    setBotoesAtivos(false);
    // pequena animação de desaparecimento do inimigo
    const m = combateInimigo.material;
    m.transparent = true;
    let f = 1;
    const fadeId = setInterval(() => {
        f -= 0.08;
        m.opacity = Math.max(0, f);
        combateInimigo.scale.setScalar(Math.max(0.01, f));
        if (f <= 0) {
            clearInterval(fadeId);
            ganharXP(inimigoBase.xpDrop);
            // limpa a zona corrompida onde estávamos no mundo
            const snap = getMundoSnapshot();
            limparZonaBatalha(snap.x, snap.z);
            setTimeout(() => sairDaArena(), 600);
        }
    }, 60);
}

function finalizarDerrota() {
    setLog('Caíste em combate. Vais recuperar...');
    setBotoesAtivos(false);
    setTimeout(() => sairDaArena(), 1200);
}

function finalizarFuga() {
    setBotoesAtivos(false);
    sairDaArena();
}

function sairDaArena() {
    sairCombate(() => {
        esconderCombateUI();
        estadoJogo.emCombate = false;
        
        // Restaurar música do mundo baseada na posição
        const estaNaZonaDark = player.position.z < -3;
        switchMusic(estaNaZonaDark ? 'dark' : 'mundo', 1.5);
    });
}

// ----------------------------------------------------------------------
// INÍCIO DE COMBATE
// ----------------------------------------------------------------------
function iniciarCombate() {
    estadoJogo.emCombate = true;
    novoInimigo();

    // Toca o som de transição
    playSFX('transicao_batalha');

    // glitch curto antes da transição (mantém a vibe do encontro)
    startGlitch(1.2, () => {
        // Muda para a música de batalha ao entrar na arena
        switchMusic('batalha', 0.5);

        entrarCombate(() => {
            // já estamos na arena, com a câmara estática a apontar para os dois
            mostrarCombateUI(inimigoAtual.nome);
            refreshHpUI();
            setLog(`Um ${inimigoAtual.nome} apareceu! O que vais fazer?`);
            setCombateHandlers({
                onAtacar: acaoAtacar,
                onItem:   acaoItem,
                onFugir:  acaoFugir,
            });
            preencherItens(getItens(), acaoItem);
        });
    });

    // Mini-glitch final sincronizado com o áudio (ocorre entre 1.8s e 2.2s)
    // Aparece mesmo sobre a tela preta/transição graças ao z-index elevado.
    setTimeout(() => {
        startGlitch(0.4);
    }, 1700);
}

// expõe uma forma simples de recuperar (chamar p.ex. ao entrar em casa)
export function recuperarPlayer() {
    recuperarTotal();
    setLog && setLog('Recuperaste totalmente.');
}
