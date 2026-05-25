// --------------------------------------------------------
// POPUP DE RECOMPENSA + FOGOS DE ARTIFÍCIO
// --------------------------------------------------------
// Mostra um cartão dourado central com o item desbloqueado
// e dispara fogos de artifício no canvas overlay.
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

// canvas dos fogos de artifício
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
dica.textContent = 'Consultai o vosso inventário (I) para o empunhar';
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

// --- fogos de artifício ---
// Assim que a recompensa aparece, várias explosões grandes surgem de
// imediato — já na sua posição final, sem foguetes a subir antes.
// Cada explosão lança um leque de faíscas que se espalham e caem.
const cores = ['#ffd24a', '#ffe7a0', '#7fb0ff', '#ff84b4', '#9dff9d', '#c878ff', '#ff9050', '#ffffff'];
let faiscas  = [];   // faíscas lançadas pelas explosões
let claroes  = [];   // clarão breve no instante da explosão
let animando = false;

function explodir(x, y, cor) {
    const n = 70 + Math.floor(Math.random() * 60);     // explosão grande
    const anel = Math.random() < 0.30;                 // por vezes um anel limpo
    const vel = 5.5 + Math.random() * 4.0;             // espalha-se bem longe
    const cor2 = cores[Math.floor(Math.random() * cores.length)];
    for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.14;
        const spd = anel ? vel * (0.85 + Math.random() * 0.30)
                         : vel * (0.30 + Math.random() * 0.90);
        faiscas.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            cor: Math.random() < 0.72 ? cor : cor2,
            vida: 1,
            decai: 0.011 + Math.random() * 0.020,
            tam: 1.8 + Math.random() * 3.2,
        });
    }
    claroes.push({ x, y, vida: 1 });
}

function tickFireworks() {
    if (!animando) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';   // mistura aditiva → dá brilho
    ctx.lineCap = 'round';

    // clarão das explosões
    for (let i = claroes.length - 1; i >= 0; i--) {
        const c = claroes[i];
        c.vida -= 0.085;
        if (c.vida <= 0) { claroes.splice(i, 1); continue; }
        ctx.globalAlpha = c.vida * 0.55;
        ctx.fillStyle = '#fff3d0';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 16 + (1 - c.vida) * 82, 0, Math.PI * 2);
        ctx.fill();
    }

    // faíscas das explosões (riscos tipo cometa)
    for (let i = faiscas.length - 1; i >= 0; i--) {
        const s = faiscas[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05;                            // gravidade
        s.vx *= 0.985;                           // resistência do ar
        s.vy *= 0.985;
        s.vida -= s.decai;
        if (s.vida <= 0) { faiscas.splice(i, 1); continue; }
        ctx.globalAlpha = s.vida * s.vida;
        ctx.strokeStyle = s.cor;
        ctx.lineWidth = s.tam * (0.4 + s.vida * 0.6);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 2.6, s.y - s.vy * 2.6);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (faiscas.length || claroes.length) {
        requestAnimationFrame(tickFireworks);
    } else {
        animando = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// dispara as explosões — todas logo, já na posição final
function dispararFogos() {
    if (!animando) { animando = true; requestAnimationFrame(tickFireworks); }
    const explosao = () => {
        const x = canvas.width  * (0.10 + Math.random() * 0.80);
        const y = canvas.height * (0.13 + Math.random() * 0.40);
        explodir(x, y, cores[Math.floor(Math.random() * cores.length)]);
    };
    // salva principal — imediata, espalhada pelo ecrã
    for (let i = 0; i < 6; i++) explosao();
    // pequena segunda salva logo a seguir, para encher o ecrã
    setTimeout(() => { for (let i = 0; i < 3; i++) explosao(); }, 320);
}

// --- API pública ---
export function mostrarRecompensa({ icone: ic, nome: nm, descricao: desc, cintilas = 0, duracao = 3500 }) {
    if (ic && (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.includes('/'))) {
        icone.innerHTML = `<img src="${ic}" style="width:130px;height:130px;object-fit:contain;filter:drop-shadow(0 0 15px #d4a830);transform:rotate(20deg);margin:10px 0;">`;
    } else {
        icone.textContent = ic || '🎁';
    }
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

    dispararFogos();

    // fechar
    setTimeout(() => {
        card.style.transform = 'scale(0.85)';
        card.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 350);
    }, duracao);
}
