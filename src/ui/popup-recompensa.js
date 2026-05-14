// --------------------------------------------------------
// POPUP DE RECOMPENSA + CONFETTI
// --------------------------------------------------------
// Mostra um cartão dourado central com o item desbloqueado
// e dispara uma chuva de confettis no canvas overlay.
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

// canvas dos confettis
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
dica.textContent = 'Abre o inventário (I) para o equipar';
card.appendChild(dica);

// keyframes para o pop do ícone (sem rotação)
const style = document.createElement('style');
style.textContent = `
    @keyframes rewardPop {
        0%   { transform: scale(0.35); }
        65%  { transform: scale(1.18); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);

// --- confetti ---
const cores = ['#d4a830', '#ffe0a0', '#88aaff', '#ff90b0', '#aaffbb', '#c060ff', '#ff8040'];
let particulas = [];
let animando = false;

function spawnConfetti(qtd = 140) {
    for (let i = 0; i < qtd; i++) {
        particulas.push({
            x: Math.random() * canvas.width,
            y: -20 - Math.random() * 200,
            vx: (Math.random() - 0.5) * 4,
            vy: 2 + Math.random() * 4,
            w: 6 + Math.random() * 6,
            h: 8 + Math.random() * 8,
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.3,
            cor: cores[Math.floor(Math.random() * cores.length)],
            vida: 1,
        });
    }
}

function tickConfetti() {
    if (!animando) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.vx *= 0.995;
        p.rot += p.vrot;
        if (p.y > canvas.height + 30) { particulas.splice(i, 1); continue; }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
    }
    if (particulas.length > 0) requestAnimationFrame(tickConfetti);
    else { animando = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

// --- API pública ---
export function mostrarRecompensa({ icone: ic, nome: nm, descricao: desc, cintilas = 0, duracao = 3500 }) {
    icone.textContent = ic || '🎁';
    nome.textContent = nm || 'Novo Item';
    descricao.textContent = desc || '';

    if (cintilas > 0) {
        cintilasLinha.innerHTML = `<span style="font-size:18px;color:#cde2ff;">✦</span> +${cintilas} Cintilas`;
        cintilasLinha.style.display = 'flex';
    } else {
        cintilasLinha.style.display = 'none';
    }

    // re-trigger da animação de pop no ícone
    icone.style.animation = 'none';
    void icone.offsetWidth;
    icone.style.animation = 'rewardPop 0.55s cubic-bezier(.2,1.6,.3,1)';

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        card.style.transform = 'scale(1)';
        card.style.opacity = '1';
    });

    spawnConfetti(160);
    if (!animando) { animando = true; requestAnimationFrame(tickConfetti); }
    // segunda leva, mais leve, para prolongar o efeito
    setTimeout(() => spawnConfetti(80), 400);
    setTimeout(() => spawnConfetti(60), 900);

    // fechar
    setTimeout(() => {
        card.style.transform = 'scale(0.85)';
        card.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 350);
    }, duracao);
}
