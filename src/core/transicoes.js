import * as THREE from 'three';
import { player } from '../entities/jogador.js';
import { lojaScene, lojaSpawnPos } from '../world/loja.js';
import { caseloScene, caseloSpawnPos } from '../world/castelo.js';
import { hidePrompt } from '../ui/hud.js';

// ---- estado da cena ----
export const estado = { cena: 'mundo', ePressBloqueado: false };

// ---- fade negro ----
const fadeEl = document.createElement('div');
fadeEl.style.cssText = `
    position: fixed; inset: 0;
    background: #000; opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s;
    z-index: 100;
`;
document.body.appendChild(fadeEl);

export function fade(toOpacity, callback) {
    fadeEl.style.opacity = toOpacity;
    fadeEl.addEventListener('transitionend', callback, { once: true });
}

// ---- posições dos jogadores por cena ----
export const lojaPlayer   = { x: 0, z: 0, rotY: 0 };
export const caseloPlayer = { x: 0, z: 0, rotY: 0 };

// ---- referência à cena do mundo (injetada em init) ----
let _worldScene = null;
export function setWorldScene(scene) { _worldScene = scene; }

// ---- entrar / sair loja ----
export function entrarLoja() {
    if (estado.ePressBloqueado) return;
    estado.ePressBloqueado = true;
    hidePrompt();
    fade(1, () => {
        lojaPlayer.x = lojaSpawnPos.x;
        lojaPlayer.z = lojaSpawnPos.z;
        lojaPlayer.rotY = Math.PI;
        _worldScene.remove(player);
        lojaScene.add(player);
        estado.cena = 'loja';
        fade(0, () => { estado.ePressBloqueado = false; });
    });
}

export function sairLoja() {
    if (estado.ePressBloqueado) return;
    estado.ePressBloqueado = true;
    hidePrompt();
    fade(1, () => {
        lojaScene.remove(player);
        _worldScene.add(player);
        player.position.set(-25, 0, 25);
        player.rotation.y = -Math.PI / 2;
        estado.cena = 'mundo';
        fade(0, () => { estado.ePressBloqueado = false; });
    });
}

// ---- transição macabra do castelo ----
const castleTransCanvas = document.createElement('canvas');
castleTransCanvas.style.cssText = `
    position: fixed; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none; display: none;
    z-index: 200;
`;
document.body.appendChild(castleTransCanvas);
const ctCtx = castleTransCanvas.getContext('2d');

function resizeCT() {
    castleTransCanvas.width  = window.innerWidth;
    castleTransCanvas.height = window.innerHeight;
}
resizeCT();
window.addEventListener('resize', resizeCT);

const castleMsg = document.createElement('div');
castleMsg.style.cssText = `
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column;
    pointer-events: none; z-index: 210;
    opacity: 0; transition: opacity 0.3s;
`;
castleMsg.innerHTML = `
    <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:bold;color:#cc44ff;
        text-shadow:0 0 30px #aa00ff,0 0 60px #6600cc,2px 2px 0 #000;
        letter-spacing:4px;text-align:center;line-height:1.4;">
        ☠ VOCÊ ENTRA NO CASTELO ☠
    </div>
    <div style="font-family:'Courier New',monospace;font-size:16px;color:#8844aa;
        text-shadow:0 0 10px #6600cc;margin-top:12px;opacity:0.85;">
        Há coisas aqui que não deveriam existir...
    </div>
`;
document.body.appendChild(castleMsg);

let ctRaf = null, ctStart = 0, ctPhase = 0, ctOnEnd = null;

function drawCastleEffect(elapsed) {
    const w = castleTransCanvas.width, h = castleTransCanvas.height;
    ctCtx.clearRect(0, 0, w, h);

    if (ctPhase === 0) {
        const p = Math.min(elapsed / 0.6, 1);
        const grad = ctCtx.createRadialGradient(w/2, h/2, h*0.1, w/2, h/2, h*0.85);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(40,0,60,${p * 0.85})`);
        ctCtx.fillStyle = grad; ctCtx.fillRect(0, 0, w, h);
        if (Math.random() > 0.55) {
            const x1 = w*(0.3+Math.random()*0.4), y1 = 0;
            const x2 = x1+(Math.random()-0.5)*120, y2 = h*(0.4+Math.random()*0.4);
            ctCtx.strokeStyle = `rgba(${180+Math.floor(Math.random()*75)},${Math.floor(Math.random()*60)},255,${0.5+Math.random()*0.5})`;
            ctCtx.lineWidth = 1+Math.random()*2.5;
            ctCtx.shadowColor = '#aa00ff'; ctCtx.shadowBlur = 18;
            ctCtx.beginPath(); ctCtx.moveTo(x1, y1);
            const segs = 4+Math.floor(Math.random()*4);
            for (let s = 1; s <= segs; s++) {
                ctCtx.lineTo(x1+(x2-x1)*(s/segs)+(Math.random()-0.5)*40, y1+(y2-y1)*(s/segs));
            }
            ctCtx.stroke(); ctCtx.shadowBlur = 0;
        }
    } else if (ctPhase === 1) {
        const p = (elapsed-0.6)/0.4;
        const alpha = p < 0.3 ? p/0.3 : 1-(p-0.3)/0.7;
        ctCtx.fillStyle = `rgba(120,0,180,${alpha*0.9})`; ctCtx.fillRect(0,0,w,h);
        const cGrad = ctCtx.createRadialGradient(w/2,h/2,0,w/2,h/2,h*0.6);
        cGrad.addColorStop(0, `rgba(255,220,255,${alpha*0.7})`);
        cGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctCtx.fillStyle = cGrad; ctCtx.fillRect(0,0,w,h);
    } else if (ctPhase === 2) {
        const p = Math.min((elapsed-1.0)/1.4, 1);
        const fogH = h*p;
        const fogGrad = ctCtx.createLinearGradient(0,h,0,h-fogH);
        fogGrad.addColorStop(0, 'rgba(5,0,12,0.97)');
        fogGrad.addColorStop(0.6, 'rgba(20,0,40,0.88)');
        fogGrad.addColorStop(1, 'rgba(40,0,70,0)');
        ctCtx.fillStyle = fogGrad; ctCtx.fillRect(0,h-fogH,w,fogH);
        for (let i = 0; i < 30; i++) {
            const seed = i*137.5;
            const px = ((seed*0.618)%1)*w;
            const py = h-((seed*0.3)%1)*fogH - Math.sin(elapsed*1.5+i)*20;
            const r = 10+((seed*0.2)%1)*30;
            const a = (0.1+((seed*0.4)%1)*0.3)*p;
            const pg = ctCtx.createRadialGradient(px,py,0,px,py,r);
            pg.addColorStop(0, `rgba(80,0,120,${a})`);
            pg.addColorStop(1, 'rgba(0,0,0,0)');
            ctCtx.fillStyle = pg; ctCtx.fillRect(px-r,py-r,r*2,r*2);
        }
        if (p > 0.4) castleMsg.style.opacity = String(Math.min((p-0.4)/0.4, 1));
        const topGrad = ctCtx.createLinearGradient(0,0,0,h*0.4);
        topGrad.addColorStop(0, `rgba(5,0,12,${p*0.8})`);
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctCtx.fillStyle = topGrad; ctCtx.fillRect(0,0,w,h*0.4);
    } else if (ctPhase === 3) {
        const p = Math.min((elapsed-2.4)/0.8, 1);
        ctCtx.fillStyle = `rgba(0,0,0,${p})`; ctCtx.fillRect(0,0,w,h);
        castleMsg.style.opacity = String(1-p);
    }
}

function castleTransLoop(timestamp) {
    if (!ctStart) ctStart = timestamp;
    const elapsed = (timestamp-ctStart)/1000;
    if (ctPhase === 0 && elapsed >= 0.6) ctPhase = 1;
    if (ctPhase === 1 && elapsed >= 1.0) ctPhase = 2;
    if (ctPhase === 2 && elapsed >= 2.4) ctPhase = 3;
    drawCastleEffect(elapsed);
    if (elapsed < 3.2) {
        ctRaf = requestAnimationFrame(castleTransLoop);
    } else {
        ctCtx.clearRect(0,0,castleTransCanvas.width,castleTransCanvas.height);
        castleTransCanvas.style.display = 'none';
        castleMsg.style.opacity = '0';
        fadeEl.style.transition = 'none';
        fadeEl.style.opacity = '1';
        void fadeEl.offsetHeight;
        fadeEl.style.transition = 'opacity 0.5s';
        if (ctOnEnd) ctOnEnd();
        ctRaf = null;
    }
}

function iniciarTransicaoCastelo(onEnd) {
    if (ctRaf) cancelAnimationFrame(ctRaf);
    ctStart = 0; ctPhase = 0; ctOnEnd = onEnd;
    castleMsg.style.opacity = '0';
    castleTransCanvas.style.display = 'block';
    fadeEl.style.opacity = '0';
    ctRaf = requestAnimationFrame(castleTransLoop);
}

// ---- entrar / sair castelo ----
export function entrarCaselo() {
    if (estado.ePressBloqueado) return;
    estado.ePressBloqueado = true;
    hidePrompt();
    iniciarTransicaoCastelo(() => {
        caseloPlayer.x = caseloSpawnPos.x;
        caseloPlayer.z = caseloSpawnPos.z;
        caseloPlayer.rotY = Math.PI;
        _worldScene.remove(player);
        caseloScene.add(player);
        estado.cena = 'caselo';
        fade(0, () => { estado.ePressBloqueado = false; });
    });
}

export function sairCaselo() {
    if (estado.ePressBloqueado) return;
    estado.ePressBloqueado = true;
    hidePrompt();
    fade(1, () => {
        caseloScene.remove(player);
        _worldScene.add(player);
        player.position.set(0, 0, -70);
        player.rotation.y = Math.PI;
        estado.cena = 'mundo';
        fade(0, () => { estado.ePressBloqueado = false; });
    });
}
