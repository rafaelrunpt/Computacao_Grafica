import { grassZones } from './mapa.js';

export const estadoJogo = { emCombate: false };

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
    text-shadow: 2px 2px 8px #000;
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
                iniciarCombate();
            }
            return;
        }
    }
}

function iniciarCombate() {
    estadoJogo.emCombate = true;

    // flash branco + mensagem
    let flashes = 0;
    const flashInterval = setInterval(() => {
        overlayEl.style.background = flashes % 2 === 0
            ? 'rgba(255,255,255,0.6)'
            : 'rgba(0,0,0,0)';
        flashes++;
        if (flashes >= 6) {
            clearInterval(flashInterval);
            overlayEl.style.background = 'rgba(0,0,0,0.75)';
            msgEl.style.opacity = '1';
            msgEl.innerHTML = '⚔️ Um Shaco Selvagem Apareceu! ⚔️<br><span style="font-size:16px;opacity:0.8">Prepara-te para combate...</span>';
        }
    }, 120);

    // libertar após 3 segundos
    setTimeout(() => {
        msgEl.style.opacity = '0';
        overlayEl.style.background = 'rgba(0,0,0,0)';
        setTimeout(() => {
            estadoJogo.emCombate = false;
        }, 400);
    }, 3000);
}
