// Animações dos ataques do jogador no combate.
// Combina movimento 3D (lunge do player) + overlay SVG (slash) + screen shake.
import * as THREE from 'three';
import { player } from '../entities/jogador.js';
import { posPlayerCombate, posInimigoCombate, combateInimigo } from '../world/combate-scene.js';

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

// ---- screen shake ----
let _shakeRAF = null;
function screenShake(amp, dur) {
    if (_shakeRAF) cancelAnimationFrame(_shakeRAF);
    const t0 = performance.now();
    const body = document.body;
    const original = body.style.transform;
    function step(now) {
        const e = now - t0;
        if (e >= dur) {
            body.style.transform = original;
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
    _tmpDir.copy(posInimigoCombate).sub(posPlayerCombate).setY(0).normalize();
    const t0 = performance.now();
    function step(now) {
        const e = now - t0;
        if (e >= dur) {
            player.position.copy(posPlayerCombate);
            _lungeRAF = null;
            return;
        }
        const u = e / dur;
        // soma das contribuições de cada pico (cada um é meia-senóide)
        let lunge = 0;
        for (const p of peaks) {
            // janela em torno de p, largura 0.5
            const w = 0.45;
            const local = (u - (p - w / 2)) / w;
            if (local > 0 && local < 1) lunge += Math.sin(local * Math.PI);
        }
        lunge = Math.min(1, lunge);
        player.position.copy(posPlayerCombate).addScaledVector(_tmpDir, lunge * amount);
        _lungeRAF = requestAnimationFrame(step);
    }
    _lungeRAF = requestAnimationFrame(step);
}

// ---- pulsar no inimigo (curto flash de emissivo) ----
function pulsarInimigoCurto() {
    const m = combateInimigo.material;
    if (!m) return;
    const original = m.emissiveIntensity;
    m.emissiveIntensity = 3.0;
    setTimeout(() => { m.emissiveIntensity = original; }, 200);
}

// ---- API ----
// callbacks: { onImpacto1, onImpacto2, onFim }
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

    // overlay por tipo
    if (tipo === 'corte') {
        // clarão branco à volta do ataque
        makeFlash({ cor: '#ffffff', cx: 60, cy: 50, dur: 320, delay: 120, intensidade: 0.85 });
        // estocada — risco horizontal curto pela direita
        makeSlash({ d: 'M 380 540 Q 540 480 660 460', cor, width: 10, dur: 220, delay: 80 });
    } else if (tipo === 'talho') {
        // clarão vermelho à volta do ataque
        makeFlash({ cor: '#ff3050', cx: 58, cy: 50, dur: 460, delay: 220, intensidade: 0.95 });
        // talho diagonal pesado
        makeSlash({ d: 'M 320 320 Q 500 480 720 660', cor, width: 18, dur: 380, delay: 200 });
        makeSlash({ d: 'M 360 360 Q 520 500 700 640', cor: '#ffffff', width: 4, dur: 320, delay: 240, glow: false });
    } else if (tipo === 'carga') {
        // linha de velocidade horizontal + impacto radial
        makeSlash({ d: 'M 100 500 L 800 500', cor, width: 22, dur: 360, delay: 180 });
        makeSlash({ d: 'M 100 540 L 750 520', cor, width: 6,  dur: 360, delay: 200, glow: false });
        makeSlash({ d: 'M 120 460 L 780 480', cor, width: 6,  dur: 360, delay: 220, glow: false });
        makeImpactRing({ cx: 720, cy: 500, cor, delay: 480 });
    } else if (tipo === 'danca') {
        // dois cortes em X
        makeSlash({ d: 'M 380 380 L 720 660', cor, width: 12, dur: 220, delay: 220 });
        makeSlash({ d: 'M 380 660 L 720 380', cor, width: 12, dur: 220, delay: 520 });
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
