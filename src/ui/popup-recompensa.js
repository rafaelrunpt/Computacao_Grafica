import { playSpriteFX } from './combate-anims.js';
import { playSFX } from '../systems/audio.js';

// --------------------------------------------------------
// POPUP DE RECOMPENSA + FOGOS DE ARTIFÍCIO
// --------------------------------------------------------
// Mostra um cartão dourado central com o item desbloqueado.
// Combina fogos clássicos (partículas Canvas) com os novos VFX (Spritesheet).
// --------------------------------------------------------

const overlay = document.createElement('div');
overlay.id = 'reward-overlay';
overlay.style.cssText = `
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 95;
    display: none;
    align-items: center; justify-content: center;
    font-family: 'Georgia', serif;
`;
document.body.appendChild(overlay);

// canvas dos fogos de artifício clássicos
const canvas = document.createElement('canvas');
canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;`;
overlay.appendChild(canvas);
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// painel central
const card = document.createElement('div');
card.style.cssText = `
    position: relative;
    background: linear-gradient(180deg, #2a1a08 0%, #3a2510 50%, #2a1a08 100%);
    border: 3px solid #d4a830;
    border-radius: 14px;
    box-shadow:
        0 0 40px rgba(220,160,60,0.7),
        inset 0 0 20px rgba(0,0,0,0.7),
        0 10px 30px rgba(0,0,0,0.85);
    color: #f0d080;
    padding: 24px 36px 20px 36px;
    min-width: 360px; max-width: 86vw;
    text-align: center;
    transform: scale(0.8); opacity: 0;
    transition: transform 0.35s cubic-bezier(.2,1.4,.3,1), opacity 0.25s ease;
    z-index: 100;
`;
overlay.appendChild(card);

card.insertAdjacentHTML('afterbegin', `
    <div style="position:absolute;inset:6px;border:1px solid #c8a96e;border-radius:10px;pointer-events:none;"></div>
`);

const titulo = document.createElement('div');
titulo.style.cssText = `
    font-size: 13px; letter-spacing: 4px; color: #c8a96e;
    text-transform: uppercase;
    margin-bottom: 6px;
`;
titulo.textContent = '⚜ Novo Equipamento Desbloqueado ⚜';
card.appendChild(titulo);

const icone = document.createElement('div');
icone.style.cssText = `
    font-size: 64px; line-height: 1;
    margin: 8px 0 4px 0;
    text-shadow: 0 0 20px #d4a830, 0 0 40px #d4a830;
    animation: rewardPop 0.55s cubic-bezier(.2,1.6,.3,1);
`;
card.appendChild(icone);

const nome = document.createElement('div');
nome.style.cssText = `
    font-size: 22px; font-weight: bold;
    color: #ffe0a0;
    text-shadow: 0 0 10px #a07000, 2px 2px 0 #000;
    letter-spacing: 2px;
    margin-bottom: 4px;
`;
card.appendChild(nome);

const descricao = document.createElement('div');
descricao.style.cssText = `
    font-size: 13px; color: #c8a96e;
    font-style: italic;
    margin-bottom: 8px;
`;
card.appendChild(descricao);

const cintilasLinha = document.createElement('div');
cintilasLinha.style.cssText = `
    display: none;
    align-items: center; justify-content: center; gap: 6px;
    font-size: 15px; font-weight: bold;
    color: #a0c8ff;
    text-shadow: 0 0 8px #4488dd, 1px 1px 0 #000;
    letter-spacing: 1px;
    margin: 2px 0 10px;
`;
card.appendChild(cintilasLinha);

const dica = document.createElement('div');
dica.style.cssText = `
    font-size: 11px; color: #a08050;
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
`;
dica.textContent = 'Consulta o teu inventário (I) para o equipar';
card.appendChild(dica);

// keyframes para o pop do ícone
const styleEl = document.createElement('style');
styleEl.textContent = `
    @keyframes rewardPop {
        0%   { transform: scale(0.35); }
        65%  { transform: scale(1.18); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(styleEl);

// --- Lógica 1: Fogos de Artifício em Partículas (Canvas) ---
const coresCanvas = ['#ffd24a', '#ffe7a0', '#7fb0ff', '#ff84b4', '#9dff9d', '#c878ff', '#ff9050', '#ffffff'];
let faiscas  = [];
let claroes  = [];
let animandoCanvas = false;

function explodirCanvas(x, y, cor) {
    const n = 50 + Math.floor(Math.random() * 30);
    const vel = 4.5 + Math.random() * 3;
    for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.15;
        const spd = vel * (0.4 + Math.random() * 0.8);
        faiscas.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            cor,
            vida: 1,
            decai: 0.012 + Math.random() * 0.015,
            tam: 1.5 + Math.random() * 2,
        });
    }
    claroes.push({ x, y, vida: 1 });
}

function tickCanvas() {
    if (!animandoCanvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let i = claroes.length - 1; i >= 0; i--) {
        const c = claroes[i];
        c.vida -= 0.08;
        if (c.vida <= 0) { claroes.splice(i, 1); continue; }
        ctx.globalAlpha = c.vida * 0.4;
        ctx.fillStyle = '#fff3d0';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 10 + (1 - c.vida) * 60, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = faiscas.length - 1; i >= 0; i--) {
        const s = faiscas[i];
        s.x += s.vx; s.y += s.vy;
        s.vy += 0.05; s.vx *= 0.98; s.vy *= 0.98;
        s.vida -= s.decai;
        if (s.vida <= 0) { faiscas.splice(i, 1); continue; }
        ctx.globalAlpha = s.vida * s.vida;
        ctx.strokeStyle = s.cor;
        ctx.lineWidth = s.tam * (0.5 + s.vida * 0.5);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 2, s.y - s.vy * 2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (faiscas.length || claroes.length) {
        requestAnimationFrame(tickCanvas);
    } else {
        animandoCanvas = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// --- Lógica 2: Fogos de Artifício em Spritesheet (VFX) ---
let intervalofogos = null;

function dispararFogos() {
    const explosaoVFX = (x, y) => {
        const size = 20 + Math.random() * 15; 
        playSpriteFX({
            url: 'assets/vfx/fireworks_ordered.png',
            cols: 4, rows: 3, frames: 12,
            fps: 20, 
            x, y, size,
            extraCss: 'transform: translate(-50%, -50%) scaleY(-1); filter: hue-rotate(' + (Math.random() * 360) + 'deg) brightness(1.3); z-index: 90;'
        });
    };

    const explosaoCanvas = (xvw, yvh) => {
        const canvX = (xvw / 100) * canvas.width;
        const canvY = (yvh / 100) * canvas.height;
        explodirCanvas(canvX, canvY, coresCanvas[Math.floor(Math.random() * coresCanvas.length)]);
    };

    if (!animandoCanvas) { animandoCanvas = true; requestAnimationFrame(tickCanvas); }

    // 1. Salva Inicial: VFX nos cantos e Canvas em posições intermédias
    // VFX (PNG)
    explosaoVFX(15, 15); // Canto Superior Esquerdo
    explosaoVFX(85, 15); // Canto Superior Direito
    explosaoVFX(10, 50); // Lado Esquerdo
    explosaoVFX(90, 50); // Lado Direito
    
    // Partículas (Canvas)
    explosaoCanvas(50, 15); // Topo Centro
    explosaoCanvas(30, 80); // Baixo Esquerda
    explosaoCanvas(70, 80); // Baixo Direita

    // 2. Loop de explosões aleatórias — Alternando locais
    if (intervalofogos) clearInterval(intervalofogos);
    intervalofogos = setInterval(() => {
        if (Math.random() > 0.5) {
            // Spritesheet (PNG) nos lados
            const rx = Math.random() < 0.5 ? (5 + Math.random() * 20) : (75 + Math.random() * 20);
            const ry = 10 + Math.random() * 70;
            explosaoVFX(rx, ry);
        } else {
            // Partículas (Canvas) no topo ou fundo
            const rx = 20 + Math.random() * 60;
            const ry = Math.random() < 0.5 ? (5 + Math.random() * 15) : (75 + Math.random() * 20);
            explosaoCanvas(rx, ry);
        }
    }, 350); 
}

function pararFogos() {
    if (intervalofogos) { clearInterval(intervalofogos); intervalofogos = null; }
    faiscas = []; claroes = [];
}

// --- API pública ---
export function mostrarRecompensa({
    icone: ic,
    nome: nm,
    descricao: desc,
    cintilas = 0,
    duracao = 3500,
    titulo: customTitulo = '⚜ Novo Equipamento Desbloqueado ⚜',
    dica: customDica = 'Consultai o vosso inventário (I) para o empunhar',
    som = false,
}) {
    titulo.textContent = customTitulo;
    dica.textContent = customDica;

    if (ic && (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.includes('/'))) {
        const rodar = /potion|elixir/i.test(ic);
        icone.innerHTML = `<img src="${ic}" style="width:130px;height:130px;object-fit:contain;filter:drop-shadow(0 0 15px #d4a830);${rodar ? 'transform:rotate(20deg);' : ''}margin:10px 0;">`;
    } else {
        icone.textContent = ic || '🎁';
    }
    nome.textContent = nm || 'Novo Item';
    descricao.textContent = desc || '';

    if (cintilas > 0) {
        cintilasLinha.innerHTML = `<img src="assets/icones/cintilas.png" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;"> +${cintilas} Cintilas`;
        cintilasLinha.style.display = 'flex';
    } else {
        cintilasLinha.style.display = 'none';
    }

    icone.style.animation = 'none';
    void icone.offsetWidth;
    icone.style.animation = 'rewardPop 0.55s cubic-bezier(.2,1.6,.3,1)';

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        card.style.transform = 'scale(1)';
        card.style.opacity = '1';
    });

    dispararFogos();
    if (som) playSFX('heart_collect');

    setTimeout(() => {
        card.style.transform = 'scale(0.85)';
        card.style.opacity = '0';
        pararFogos();
        setTimeout(() => { overlay.style.display = 'none'; }, 350);
    }, duracao);
}
