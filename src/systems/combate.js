import { grassZones, limparZonaBatalha } from '../world/mapa.js';
import { ganharXP } from './player-stats.js';

export const estadoJogo = { emCombate: false, combateX: 0, combateZ: 0 };

// ---- canvas de glitch roxo ----
const glitchCanvas = document.createElement('canvas');
glitchCanvas.style.cssText = `
    position: fixed; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    display: none;
    z-index: 20;
`;
document.body.appendChild(glitchCanvas);
const gCtx = glitchCanvas.getContext('2d');

function resizeGlitch() {
    glitchCanvas.width  = window.innerWidth;
    glitchCanvas.height = window.innerHeight;
}
resizeGlitch();
window.addEventListener('resize', resizeGlitch);

// ---- UI de combate ----
const overlayEl = document.createElement('div');
overlayEl.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0);
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
    transition: background 0.4s;
    z-index: 10;
`;
document.body.appendChild(overlayEl);

const msgEl = document.createElement('div');
msgEl.style.cssText = `
    color: #fff;
    font-family: 'Courier New', monospace;
    font-size: 28px;
    font-weight: bold;
    text-shadow: 2px 2px 8px #000, 0 0 20px #aa00ff;
    opacity: 0;
    transition: opacity 0.3s;
    text-align: center;
    line-height: 1.5;
`;
overlayEl.appendChild(msgEl);

export function verificarEncontro(x, z) {
    if (estadoJogo.emCombate) return;
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

// ---- glitch engine ----
let glitchRaf = null;
let glitchStartTime = 0;
let glitchDuration = 0;
let glitchOnEnd = null;

function drawGlitch(t) {
    const w = glitchCanvas.width;
    const h = glitchCanvas.height;
    gCtx.clearRect(0, 0, w, h);

    // fundo escuro com pulso roxo
    const alpha = 0.35 + 0.35 * Math.sin(t * 18);
    gCtx.fillStyle = `rgba(40, 0, 70, ${alpha})`;
    gCtx.fillRect(0, 0, w, h);

    // linhas de glitch horizontais deslocadas
    const nLinhas = 6 + Math.floor(Math.random() * 8);
    for (let i = 0; i < nLinhas; i++) {
        const y      = Math.random() * h;
        const lh     = 2 + Math.random() * 18;
        const offset = (Math.random() - 0.5) * 80;
        const r = 120 + Math.floor(Math.random() * 80);
        const g = 0;
        const b = 180 + Math.floor(Math.random() * 75);
        const a = 0.4 + Math.random() * 0.5;
        gCtx.fillStyle = `rgba(${r},${g},${b},${a})`;
        gCtx.fillRect(0, y, w, lh);
        // fragmento deslocado
        gCtx.save();
        gCtx.globalCompositeOperation = 'screen';
        gCtx.fillStyle = `rgba(${r},${g},${b},${a * 0.6})`;
        gCtx.fillRect(offset, y, w * (0.3 + Math.random() * 0.5), lh * 0.5);
        gCtx.restore();
    }

    // scanlines finas (dão sensação de ecrã a colapsar)
    gCtx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 3) {
        gCtx.fillRect(0, y, w, 1);
    }

    // ruído digital — pixels aleatórios roxos/brancos
    const nPixels = 300 + Math.floor(Math.random() * 400);
    for (let i = 0; i < nPixels; i++) {
        const px = Math.random() * w;
        const py = Math.random() * h;
        const bright = Math.random() > 0.5;
        gCtx.fillStyle = bright
            ? `rgba(220,160,255,${0.4 + Math.random() * 0.6})`
            : `rgba(80,0,140,${0.5 + Math.random() * 0.5})`;
        gCtx.fillRect(px, py, 2 + Math.random() * 4, 1 + Math.random() * 3);
    }

    // borda a pulsar (vinheta roxa)
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

// ---- iniciar combate ----
function iniciarCombate() {
    estadoJogo.emCombate = true;

    // fase 1 — glitch roxo intenso (1.8s)
    startGlitch(1.8, () => {
        // fase 2 — fade para preto + mensagem
        overlayEl.style.background = 'rgba(10,0,20,0.88)';
        msgEl.style.opacity = '1';
        msgEl.innerHTML = '⚔️ Um Shaco Selvagem Apareceu! ⚔️<br><span style="font-size:16px;opacity:0.8;color:#cc88ff;">A corrupção desperta...</span>';

        // glitch residual mais suave enquanto a mensagem está visível
        startGlitch(2.5, () => {
            msgEl.style.opacity = '0';
            overlayEl.style.background = 'rgba(0,0,0,0)';
            setTimeout(() => {
                estadoJogo.emCombate = false;
                ganharXP(30 + Math.floor(Math.random() * 20));
                limparZonaBatalha(estadoJogo.combateX, estadoJogo.combateZ);
            }, 400);
        });
    });
}
