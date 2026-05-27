// Animações dos ataques do jogador no combate.
// Combina movimento 3D (lunge do player) + overlay SVG (slash) + screen shake.
import * as THREE from 'three';
import { player } from '../entities/jogador.js';
import { posPlayerCombate, posInimigoCombate, getInimigoActivo, isBossMode } from '../world/combate-scene.js';
import { combateCamera, combateBossCamera } from '../core/renderer.js';

// ---- overlay SVG ----
const overlay = document.createElement('div');
overlay.id = 'combate-anim-overlay';
overlay.style.cssText = `
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 240;
    display: none;
    overflow: hidden;
`;
overlay.innerHTML = `
    <svg id="combate-anim-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice"
         style="position:absolute;inset:0;width:100%;height:100%;"></svg>
`;
document.body.appendChild(overlay);
const svg = overlay.querySelector('#combate-anim-svg');

function clearOverlay() { svg.innerHTML = ''; }

// Clarão radial à volta do ataque — div com radial-gradient que pulsa.
function makeFlash({ cor = '#ffffff', cx = 64, cy = 50, dur = 240, delay = 0, intensidade = 1 }) {
    const flash = document.createElement('div');
    const peak = Math.max(0.2, Math.min(1, intensidade));
    flash.style.cssText = `
        position: absolute; inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at ${cx}% ${cy}%, ${cor} 0%, ${cor}00 45%);
        opacity: 0;
        transition: opacity ${Math.floor(dur * 0.35)}ms ease-out;
        mix-blend-mode: screen;
    `;
    overlay.appendChild(flash);
    setTimeout(() => { flash.style.opacity = String(peak); }, delay + 8);
    setTimeout(() => {
        flash.style.transition = `opacity ${Math.floor(dur * 0.65)}ms ease-in`;
        flash.style.opacity = '0';
    }, delay + Math.floor(dur * 0.35) + 20);
    setTimeout(() => { flash.remove(); }, delay + dur + 80);
}

function makeSlash({ d, cor = '#fff', width = 14, dur = 240, delay = 0, glow = true }) {
    const ns = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', cor);
    path.setAttribute('stroke-width', String(width));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.style.filter = glow ? `drop-shadow(0 0 10px ${cor}) drop-shadow(0 0 18px ${cor})` : 'none';
    svg.appendChild(path);
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.style.opacity = '0';
    path.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.4,.6,.2,1), opacity 80ms linear`;
    setTimeout(() => {
        path.style.opacity = '1';
        path.style.strokeDashoffset = '0';
    }, delay + 16);
    // fade-out
    setTimeout(() => {
        path.style.transition = 'opacity 220ms ease-out';
        path.style.opacity = '0';
    }, delay + dur + 80);
    return path;
}

function makeImpactRing({ cx = 500, cy = 500, cor = '#fff', delay = 0 }) {
    const ns = 'http://www.w3.org/2000/svg';
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', '20');
    c.setAttribute('stroke', cor);
    c.setAttribute('stroke-width', '6');
    c.setAttribute('fill', 'none');
    c.style.filter = `drop-shadow(0 0 12px ${cor})`;
    c.style.opacity = '0';
    c.style.transition = 'r 380ms cubic-bezier(.2,.6,.2,1), opacity 380ms ease-out, stroke-width 380ms';
    svg.appendChild(c);
    setTimeout(() => {
        c.style.opacity = '1';
        c.setAttribute('r', '180');
        c.setAttribute('stroke-width', '2');
    }, delay + 16);
    setTimeout(() => { c.style.opacity = '0'; }, delay + 200);
}

// Slash estático (1 PNG) — aparece, brilha e desvanece. Para ataques do player.
// Modos:
//   sweep:false  → pop-in: scale 0.5→1.0, fade in/out
//   sweep:true   → revela a imagem da esquerda para a direita (slash a desenhar-se)
export function playSlashImage({ url, x = 63, y = 25, size = 40, dur = 360, rot = 0, flipX = false, blend = 'screen', sweep = false, startReveal = 0.1, anchor = 'center' }) {
    const el = document.createElement('img');
    el.src = url;
    // anchor controla onde está o ponto (x,y) na imagem:
    //   'center'      → centro (default)
    //   'left'        → bordo esquerdo (para sweep que vem do player)
    const tx = anchor === 'left' ? '0%' : '-50%';
    const xf = `translate(${tx}, -50%) rotate(${rot}deg) ${flipX ? 'scaleX(-1)' : ''}`;

    if (sweep) {
        const startClip = `inset(0 ${Math.floor((1 - startReveal) * 100)}% 0 0)`;
        el.style.cssText = `
            position: fixed;
            left: ${x}vw; top: ${y}vh;
            width: ${size}vh; height: auto;
            transform: ${xf};
            opacity: 1;
            clip-path: ${startClip};
            -webkit-clip-path: ${startClip};
            pointer-events: none;
            z-index: 246;
            mix-blend-mode: ${blend};
            filter: drop-shadow(0 0 14px rgba(255,255,255,0.6));
            transition: clip-path ${Math.floor(dur * 0.6)}ms cubic-bezier(.2,.7,.3,1),
                        -webkit-clip-path ${Math.floor(dur * 0.6)}ms cubic-bezier(.2,.7,.3,1),
                        opacity ${Math.floor(dur * 0.35)}ms ease-out;
        `;
        document.body.appendChild(el);
        requestAnimationFrame(() => {
            el.style.clipPath = 'inset(0 0% 0 0)';
            el.style.webkitClipPath = 'inset(0 0% 0 0)';
        });
        // depois do sweep, fade out suave
        setTimeout(() => {
            el.style.transition = `opacity ${Math.floor(dur * 0.4)}ms ease-in`;
            el.style.opacity = '0';
        }, Math.floor(dur * 0.6));
    } else {
        el.style.cssText = `
            position: fixed;
            left: ${x}vw; top: ${y}vh;
            width: ${size}vh; height: auto;
            transform: ${xf.replace('rotate(', 'scale(0.5) rotate(')};
            opacity: 0;
            pointer-events: none;
            z-index: 246;
            mix-blend-mode: ${blend};
            filter: drop-shadow(0 0 14px rgba(255,255,255,0.6));
            transition: transform 140ms cubic-bezier(.2,1.6,.3,1), opacity 90ms ease-out;
        `;
        document.body.appendChild(el);
        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = xf;
        });
        setTimeout(() => {
            el.style.transition = `opacity ${Math.floor(dur * 0.5)}ms ease-in, transform ${Math.floor(dur * 0.5)}ms ease-out`;
            el.style.opacity = '0';
            el.style.transform = xf.replace('rotate(', 'scale(1.15) rotate(');
        }, Math.floor(dur * 0.45));
    }
    setTimeout(() => el.remove(), dur + 80);
    return el;
}

// ---- sprite-sheet VFX ----
// Toca um sprite-sheet (grelha cols×rows de frames) num <div> overlay.
// Posição em vw/vh (mesmo sistema que as âncoras de combate).
function playSpriteFX({ url, cols, rows, frames = cols * rows, fps = 24, x, y, size = 14, loop = false, dur = 0, extraCss = '' }) {
    const el = document.createElement('div');
    el.style.cssText = `
        position: fixed;
        left: ${x}vw; top: ${y}vh;
        width: ${size}vh; height: ${size}vh;
        transform: translate(-50%, -50%);
        background-image: url('${url}');
        background-size: ${cols * 100}% ${rows * 100}%;
        background-repeat: no-repeat;
        background-position: 0% 0%;
        pointer-events: none;
        z-index: 245;
        mix-blend-mode: screen;
        ${extraCss}
    `;
    document.body.appendChild(el);
    let f = 0;
    const frameDur = 1000 / fps;
    const totalDur = loop ? (dur || frameDur * frames) : frameDur * frames;
    const t0 = performance.now();
    function tick(now) {
        const e = now - t0;
        if (!loop && e >= totalDur) { el.remove(); return; }
        if (loop && e >= totalDur) { el.remove(); return; }
        const idx = loop ? Math.floor((e / frameDur)) % frames : Math.min(frames - 1, Math.floor(e / frameDur));
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        // posição percentual: divide pelos espaçamentos entre frames (cols-1 / rows-1)
        const px = cols > 1 ? (col / (cols - 1)) * 100 : 0;
        const py = rows > 1 ? (row / (rows - 1)) * 100 : 0;
        el.style.backgroundPosition = `${px}% ${py}%`;
        el.dataset.tick = String(idx);
        if (el._stop) { el.remove(); return; }
        el._raf = requestAnimationFrame(tick);
    }
    el._raf = requestAnimationFrame(tick);
    return el;
}

// Sequência de PNGs separados (1 ficheiro por frame). Toca na posição (x,y) em vw/vh.
// onLastFrame dispara quando o último frame aparece (sincronizar dano com impacto visual).
const _framePreload = new Map(); // url -> Image
function _preloadFrames(urls) {
    for (const u of urls) {
        if (_framePreload.has(u)) continue;
        const img = new Image();
        img.src = u;
        _framePreload.set(u, img);
    }
}
export function playFramesFX({ frames, fps = 18, x, y, size = 30, extraCss = '', onLastFrame }) {
    _preloadFrames(frames);
    const img = document.createElement('img');
    img.src = frames[0];
    img.style.cssText = `
        position: fixed;
        left: ${x}vw; top: ${y}vh;
        width: ${size}vh; height: auto;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 245;
        mix-blend-mode: screen;
        image-rendering: auto;
        ${extraCss}
    `;
    document.body.appendChild(img);
    const frameDur = 1000 / fps;
    const t0 = performance.now();
    let lastFired = false;
    function tick(now) {
        const e = now - t0;
        const idx = Math.min(frames.length - 1, Math.floor(e / frameDur));
        img.src = frames[idx];
        if (idx === frames.length - 1 && !lastFired) {
            lastFired = true;
            if (onLastFrame) onLastFrame();
        }
        if (e >= frameDur * frames.length) {
            img.remove();
            return;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return img;
}

// Projéctil que voa de uma âncora (vw/vh) até outra, com sprite-sheet em loop.
// Chama onImpact quando chega. Devolve o elemento para se poder cancelar.
export function dispararProjetilSprite({ url, cols, rows, frames, fps, from, to, dur = 500, size = 12, extraCss = '', onImpact }) {
    // Sincroniza os frames com o tempo de voo: o último frame coincide com o impacto.
    const totalFrames = frames || (cols * rows);
    const syncedFps = fps || (totalFrames * 1000 / dur);
    const el = playSpriteFX({ url, cols, rows, frames: totalFrames, fps: syncedFps, x: from.x, y: from.y, size, loop: false, extraCss });
    const t0 = performance.now();
    function step(now) {
        const e = Math.min(1, (now - t0) / dur);
        const cx = from.x + (to.x - from.x) * e;
        const cy = from.y + (to.y - from.y) * e;
        el.style.left = `${cx}vw`;
        el.style.top = `${cy}vh`;
        if (e < 1) requestAnimationFrame(step);
        else {
            el._stop = true;
            if (onImpact) onImpact();
        }
    }
    requestAnimationFrame(step);
    return el;
}

// ---- screen shake ----
let _shakeRAF = null;
function screenShake(amp, dur) {
    if (_shakeRAF) cancelAnimationFrame(_shakeRAF);
    const t0 = performance.now();
    const body = document.body;
    function step(now) {
        const e = now - t0;
        if (e >= dur) {
            // sempre repõe o offset a zero — se "original" tivesse ficado
            // a meio de um shake interrompido, evitava-se o reset.
            body.style.transform = '';
            _shakeRAF = null;
            return;
        }
        const decay = 1 - e / dur;
        const x = (Math.random() * 2 - 1) * amp * decay;
        const y = (Math.random() * 2 - 1) * amp * decay;
        body.style.transform = `translate(${x}px, ${y}px)`;
        _shakeRAF = requestAnimationFrame(step);
    }
    _shakeRAF = requestAnimationFrame(step);
}

// ---- player lunge 3D ----
let _lungeRAF = null;
const _tmpDir = new THREE.Vector3();
function playerLunge({ amount, dur, peaks = [0.5] }) {
    if (_lungeRAF) cancelAnimationFrame(_lungeRAF);
    
    // Direção do lunge: sempre do player para o inimigo.
    _tmpDir.copy(posInimigoCombate).sub(posPlayerCombate).setY(0).normalize();
    
    const t0 = performance.now();
    function step(now) {
        const e = now - t0;
        if (e >= dur) {
            player.userData.lungeOffset = 0;
            // Se não for boss, repomos a posição fixa. Se for boss, 
            // o BossAttacks.js já está a tratar da posição base.
            if (!isBossMode()) {
                player.position.copy(posPlayerCombate);
            }
            _lungeRAF = null;
            return;
        }
        const u = e / dur;
        let lunge = 0;
        for (const p of peaks) {
            const w = 0.45;
            const local = (u - (p - w / 2)) / w;
            if (local > 0 && local < 1) lunge += Math.sin(local * Math.PI);
        }
        const offset = Math.min(1, lunge) * amount;
        player.userData.lungeOffset = offset;

        // No modo normal, aplicamos directamente à posição.
        // No modo boss, o BossAttacks.js lê o lungeOffset e aplica-o.
        if (!isBossMode()) {
            player.position.copy(posPlayerCombate).addScaledVector(_tmpDir, offset);
        }
        
        _lungeRAF = requestAnimationFrame(step);
    }
    _lungeRAF = requestAnimationFrame(step);
}

// ---- pulsar no inimigo (curto flash de emissivo) ----
function pulsarInimigoCurto() {
    // usa o inimigo activo (wraith ou núcleo corrompido), não um fixo
    const alvo = getInimigoActivo();
    const m = alvo && alvo.material;
    if (!m) return;
    const original = m.emissiveIntensity;
    m.emissiveIntensity = 3.0;
    setTimeout(() => { m.emissiveIntensity = original; }, 200);
}

// ---- API ----
// callbacks: { onImpacto1, onImpacto2, onFim }

export function lancarEfeitoBuff(at, targetAnchor, callbacks = {}) {
    const cor = '#88ffaa'; // verde místico
    const dur = 1000;
    const { x: cx = 38, y: cy = 35 } = targetAnchor || {};
    
    overlay.style.display = 'block';
    clearOverlay();

    // clarão verde suave no centro do player
    makeFlash({ cor: '#40ff80', cx, cy, dur: 800, delay: 0, intensidade: 0.6 });

    // criar escudos (arcos circulares) à volta do player
    const ns = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(ns, 'g');
    group.style.transition = 'transform 1000ms cubic-bezier(.2,.6,.4,1), opacity 800ms';
    group.style.transformOrigin = `${cx}% ${cy}%`;
    group.style.transform = 'scale(0.5) rotate(-45deg)';
    group.style.opacity = '0';
    svg.appendChild(group);

    // centros (ancora player no 2D)
    const px = cx * 10, py = cy * 10;

    for (let i = 0; i < 3; i++) {
        const path = document.createElementNS(ns, 'path');
        const r = 80 + i * 25;
        const startAngle = i * 120;
        const endAngle = startAngle + 180;
        
        const x1 = px + r * Math.cos(startAngle * Math.PI / 180);
        const y1 = py + r * Math.sin(startAngle * Math.PI / 180);
        const x2 = px + r * Math.cos(endAngle * Math.PI / 180);
        const y2 = py + r * Math.sin(endAngle * Math.PI / 180);

        path.setAttribute('d', `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`);
        path.setAttribute('stroke', cor);
        path.setAttribute('stroke-width', '4');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('fill', 'none');
        path.style.filter = `drop-shadow(0 0 12px ${cor})`;
        group.appendChild(path);
    }

    setTimeout(() => {
        group.style.opacity = '1';
        group.style.transform = 'scale(1.2) rotate(45deg)';
    }, 16);

    setTimeout(() => {
        group.style.opacity = '0';
        group.style.transform = 'scale(1.4) rotate(90deg)';
    }, 700);

    setTimeout(() => {
        overlay.style.display = 'none';
        clearOverlay();
        if (callbacks.onFim) callbacks.onFim();
    }, dur + 60);
}

export function lancarAnimacaoAtaque(at, falhou, callbacks = {}) {
    const a = at.anim || {};
    const cor = a.cor || '#ffffff';
    const dur = a.dur || 600;
    const tipo = a.tipo || 'corte';
    const lunge = (a.lunge || 1.2);

    overlay.style.display = 'block';
    clearOverlay();

    // movimento 3D
    if (tipo === 'danca') {
        playerLunge({ amount: lunge, dur, peaks: [0.32, 0.72] });
    } else {
        playerLunge({ amount: lunge, dur, peaks: [0.5] });
    }

    // Âncoras dinâmicas para posicionar os efeitos de ecrã conforme as posições 3D.
    const getPos = (alvo) => {
        const cam = isBossMode() ? combateBossCamera : combateCamera;
        let p;
        if (alvo === 'inimigo') {
            // Em boss mode, o boss está fixo no centro Z negativo. 
            // Em modo normal, o inimigo está à direita (X positivo).
            const height = isBossMode() ? 2.8 : 1.6;
            p = new THREE.Vector3(posInimigoCombate.x, height, posInimigoCombate.z);
        } else {
            // Player em (x, y, z) — y+1.2 é aproximadamente a altura do peito.
            p = new THREE.Vector3(player.position.x, player.position.y + 1.2, player.position.z);
        }
        const _v = p.project(cam);
        return { x: (_v.x * 0.5 + 0.5) * 100, y: (-_v.y * 0.5 + 0.5) * 100 };
    };

    // overlay por tipo
    if (tipo === 'corte') {
        const ai = getPos('inimigo');
        const ap = getPos('player');
        
        // clarão branco no ponto de impacto (inimigo)
        makeFlash({ cor: '#ffffff', cx: ai.x, cy: ai.y, dur: 320, delay: 120, intensidade: 0.85 });
        
        // som da lâmina
        setTimeout(() => {
            const a = new Audio('assets/sounds/Attacks/player/lamina.mp3');
            a.volume = 0.7;
            a.play().catch(() => {});
        }, 80);
        
        // sprite do lunge — sai do player e estende-se até ao inimigo.
        setTimeout(() => {
            // Calcular ângulo dinâmico no ecrã para apontar do player ao boss.
            // ap.x/y são em vw/vh, por isso o ângulo é visualmente correcto.
            const dx = ai.x - ap.x;
            const dy = ai.y - ap.y;
            const rot = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // Em boss mode, a distância Z é maior, aumentamos o tamanho do sprite.
            const size = isBossMode() ? 65 : 50;

            playSlashImage({
                url: 'assets/vfx/player/Lunge_Big.png',
                x: ap.x, y: ap.y, size, dur: 460, rot,
                sweep: true, startReveal: 0.1, anchor: 'left',
            });
        }, 80);
    } else if (tipo === 'talho') {
        const ai = getPos('inimigo');
        // clarão vermelho no impacto
        makeFlash({ cor: '#ff3050', cx: ai.x, cy: ai.y, dur: 460, delay: 220, intensidade: 0.95 });
        // talho diagonal pesado (SVG absoluto por agora)
        makeSlash({ d: 'M 320 320 Q 500 480 720 660', cor, width: 18, dur: 380, delay: 200 });
        makeSlash({ d: 'M 360 360 Q 520 500 700 640', cor: '#ffffff', width: 4, dur: 320, delay: 240, glow: false });
    } else if (tipo === 'carga') {
        const ai = getPos('inimigo');
        // linha de velocidade horizontal + impacto radial
        makeSlash({ d: 'M 100 500 L 800 500', cor, width: 22, dur: 360, delay: 180 });
        makeImpactRing({ cx: ai.x * 10, cy: ai.y * 10, cor, delay: 480 });
    } else if (tipo === 'danca') {
        const ai = getPos('inimigo');
        const ap = getPos('player');
        // dois cortes em X centrados no inimigo
        makeSlash({ d: `M ${ai.x * 10 - 150} ${ai.y * 10 - 150} L ${ai.x * 10 + 150} ${ai.y * 10 + 150}`, cor, width: 12, dur: 220, delay: 220 });
        makeSlash({ d: `M ${ai.x * 10 - 150} ${ai.y * 10 + 150} L ${ai.x * 10 + 150} ${ai.y * 10 - 150}`, cor, width: 12, dur: 220, delay: 520 });
    }

    if (a.shake && !falhou) screenShake(a.shake, Math.min(dur, 360));

    const impacto1 = a.impacto ?? Math.floor(dur * 0.45);
    const impacto2 = a.impacto2;

    setTimeout(() => {
        if (callbacks.onImpacto1) callbacks.onImpacto1();
        if (!falhou) pulsarInimigoCurto();
    }, impacto1);

    if (impacto2 != null) {
        setTimeout(() => {
            if (callbacks.onImpacto2) callbacks.onImpacto2();
            if (!falhou) pulsarInimigoCurto();
        }, impacto2);
    }

    setTimeout(() => {
        overlay.style.display = 'none';
        clearOverlay();
        if (callbacks.onFim) callbacks.onFim();
    }, dur + 60);
}
