import * as THREE from 'three';
import { player } from '../entities/jogador.js';
import { playerStats, registarCallbacksStats } from '../systems/player-stats.js';

// ---- prompt de interação ----
const promptEl = document.createElement('div');
promptEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;padding:8px 18px;border-radius:8px;font-family:sans-serif;font-size:16px;display:none;pointer-events:none;z-index:50;';
document.body.appendChild(promptEl);

export function showPrompt(msg) { promptEl.textContent = msg; promptEl.style.display = 'block'; }
export function hidePrompt()    { promptEl.style.display = 'none'; }

// ---- HUD ----
const hudEl = document.createElement('div');
hudEl.style.cssText = `
    position: fixed; top: 10px; left: 10px;
    display: flex; align-items: center; gap: 6px;
    z-index: 50; pointer-events: none;
    font-family: 'Georgia', serif;
`;

// avatar canvas
const avatarCanvas = document.createElement('canvas');
avatarCanvas.width = 96; avatarCanvas.height = 96;
avatarCanvas.style.cssText = `
    width: 32px; height: 32px;
    border-radius: 50%;
    border: 2px solid #c8a96e;
    box-shadow: 0 0 6px rgba(0,0,0,0.7);
    flex-shrink: 0; display: block;
    object-fit: cover;
`;

export const avatarRenderer = new THREE.WebGLRenderer({ canvas: avatarCanvas, antialias: true, alpha: true });
avatarRenderer.setSize(96, 96);
avatarRenderer.setPixelRatio(1);
avatarRenderer.shadowMap.enabled = false;
avatarRenderer.setClearColor(0x000000, 0);

export const avatarScene = new THREE.Scene();
avatarScene.background = new THREE.Color(0x1a1a2e);


export const avatarCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10);
avatarCam.position.set(0, 0, 2);
avatarCam.lookAt(0, 0, 0);

const avatarLight = new THREE.DirectionalLight(0xffffff, 1.2);
avatarLight.position.set(1, 2, 3);
avatarScene.add(avatarLight);
avatarScene.add(new THREE.AmbientLight(0xffffff, 0.6));

let _avatarBuilt = false;
let _avatarOriginalMeshes = [];
let _avatarSyncCounter = 0;

export function buildAvatarScene() {
    if (_avatarBuilt) return;
    let headGroup = null, maxY = -Infinity;
    for (const c of player.children) {
        if (c.isGroup && c.position.y > maxY) { maxY = c.position.y; headGroup = c; }
    }
    if (!headGroup) return;

    const clone = headGroup.clone(true);
    clone.position.set(0, 0, 0);
    avatarScene.add(clone);

    const origMeshes = [], cloneMeshes = [];
    headGroup.traverse(c => { if (c.isMesh) origMeshes.push(c); });
    clone.traverse(c => { if (c.isMesh) cloneMeshes.push(c); });
    _avatarOriginalMeshes = origMeshes.map((o, i) => ({ orig: o, clone: cloneMeshes[i] }));

    const s = 0.65;
    avatarCam.left = -s; avatarCam.right = s;
    avatarCam.top  =  s + 0.1; avatarCam.bottom = -s + 0.1;
    avatarCam.position.set(0, 0.1, 2);
    avatarCam.lookAt(0, 0.1, 0);
    avatarCam.updateProjectionMatrix();
    _avatarBuilt = true;
}

export function syncAvatarMaterials() {
    if (++_avatarSyncCounter % 10 !== 0) return;
    for (const { orig, clone } of _avatarOriginalMeshes) {
        if (!orig.material || !clone.material) continue;
        clone.material.color.copy(orig.material.color);
        if (orig.material.map !== undefined) clone.material.map = orig.material.map;
        clone.material.needsUpdate = true;
    }
}

// painel direito: nível + barra XP
const infoEl = document.createElement('div');
infoEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;min-width:90px;';

const levelEl = document.createElement('div');
levelEl.style.cssText = 'color:#f0d080;font-size:13px;font-weight:bold;text-shadow:0 1px 4px #000,0 0 8px #a07000;letter-spacing:1px;';

const xpBarWrap = document.createElement('div');
xpBarWrap.style.cssText = 'width:100%;height:6px;background:rgba(0,0,0,0.55);border-radius:3px;border:1px solid #6a5020;overflow:hidden;';

const xpBarFill = document.createElement('div');
xpBarFill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#a060f0,#d090ff);border-radius:3px;transition:width 0.4s ease;box-shadow:0 0 4px #9040e0;';
xpBarWrap.appendChild(xpBarFill);

const xpLabelEl = document.createElement('div');
xpLabelEl.style.cssText = 'color:#c0a0e0;font-size:11px;text-shadow:0 1px 3px #000;letter-spacing:0.5px;';

infoEl.append(levelEl, xpBarWrap, xpLabelEl);
hudEl.append(avatarCanvas, infoEl);
document.body.appendChild(hudEl);

export function atualizarHUD() {
    const pct = Math.min(100, (playerStats.xp / playerStats.xpToNext) * 100);
    levelEl.textContent = `NÍVEL  ${playerStats.level}`;
    xpBarFill.style.width = pct + '%';
    xpLabelEl.textContent = `${playerStats.xp} / ${playerStats.xpToNext} XP`;
}

// ligar stats → hud
registarCallbacksStats(atualizarHUD, () => atualizarHUD());
atualizarHUD();
