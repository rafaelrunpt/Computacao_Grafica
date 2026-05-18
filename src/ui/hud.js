import * as THREE from 'three';
import { player, coroaGroup, brincosGroup, oculosGroup, aureolaGroup, mascaraGroup } from '../entities/jogador.js';
import { playerStats, registarCallbacksStats } from '../systems/player-stats.js';

// ---- aviso de interacção ----
const promptEl = document.createElement('div');
promptEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;padding:8px 18px;border-radius:8px;font-family:sans-serif;font-size:16px;display:none;pointer-events:none;z-index:50;';
document.body.appendChild(promptEl);

export function showPrompt(msg) { promptEl.textContent = msg; promptEl.style.display = 'block'; }
export function hidePrompt()    { promptEl.style.display = 'none'; }

// ---- HUD (Mostrador de Estado) ----
const hudEl = document.createElement('div');
hudEl.id = 'game-hud';
hudEl.style.cssText = `
    position: fixed; top: 10px; left: 10px;
    display: flex; align-items: center; gap: 6px;
    z-index: 50; pointer-events: none;
    font-family: 'Georgia', serif;
`;

// canvas do avatar
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
let _avatarCoroaClone = null;
let _avatarBrincosClone = null;
let _avatarOculosClone = null;
let _avatarAureolaClone = null;
let _avatarMascaraClone = null;

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

    // localizar artefactos clonados para sincronizar visibilidade
    _avatarCoroaClone   = clone.getObjectByName('coroaGroup')   || null;
    _avatarBrincosClone = clone.getObjectByName('brincosGroup') || null;
    _avatarOculosClone  = clone.getObjectByName('oculosGroup')  || null;
    _avatarAureolaClone = clone.getObjectByName('aureolaGroup') || null;
    _avatarMascaraClone = clone.getObjectByName('mascaraGroup') || null;

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
    // visibilidade dos artefactos no avatar acompanha o herói principal
    if (_avatarCoroaClone)   _avatarCoroaClone.visible   = coroaGroup.visible;
    if (_avatarBrincosClone) _avatarBrincosClone.visible = brincosGroup.visible;
    if (_avatarOculosClone)  _avatarOculosClone.visible  = oculosGroup.visible;
    if (_avatarAureolaClone) _avatarAureolaClone.visible = aureolaGroup.visible;
    if (_avatarMascaraClone) _avatarMascaraClone.visible = mascaraGroup.visible;

    if (++_avatarSyncCounter % 10 !== 0) return;
    for (const { orig, clone } of _avatarOriginalMeshes) {
        if (!orig.material || !clone.material) continue;
        clone.material.color.copy(orig.material.color);
        if (orig.material.map !== undefined) clone.material.map = orig.material.map;
        clone.material.needsUpdate = true;
    }
}

// painel direito: nível + barra XP + barra HP
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

const hpBarWrap = document.createElement('div');
hpBarWrap.style.cssText = 'width:100%;height:6px;background:rgba(0,0,0,0.55);border-radius:3px;border:1px solid #6a2020;overflow:hidden;';

const hpBarFill = document.createElement('div');
hpBarFill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#d04040,#ff8080);border-radius:3px;transition:width 0.3s ease;box-shadow:0 0 4px #d04040;';
hpBarWrap.appendChild(hpBarFill);

const hpLabelEl = document.createElement('div');
hpLabelEl.style.cssText = 'color:#ffb0b0;font-size:11px;text-shadow:0 1px 3px #000;letter-spacing:0.5px;';

const cintilasEl = document.createElement('div');
cintilasEl.style.cssText = 'color:#a0c8ff;font-size:12px;font-weight:bold;text-shadow:0 1px 3px #000,0 0 8px #4488dd;letter-spacing:1px;display:flex;align-items:center;gap:5px;margin-top:3px;';
cintilasEl.innerHTML = '<span style="font-size:14px;color:#cde2ff;">✦</span><span id="hud-cintilas-val">0</span> Cintilas';

infoEl.append(levelEl, xpBarWrap, xpLabelEl, hpBarWrap, hpLabelEl, cintilasEl);
hudEl.append(avatarCanvas, infoEl);
document.body.appendChild(hudEl);

import('../systems/currency.js').then(({ onCintilasChange, getCintilas }) => {
    const el = document.getElementById('hud-cintilas-val');
    if (el) el.textContent = String(getCintilas());
    onCintilasChange((total) => {
        const e = document.getElementById('hud-cintilas-val');
        if (e) e.textContent = String(total);
    });
});

export function atualizarHUD() {
    const pct = Math.min(100, (playerStats.xp / playerStats.xpToNext) * 100);
    levelEl.textContent = `NÍVEL  ${playerStats.level}`;
    xpBarFill.style.width = pct + '%';
    xpLabelEl.textContent = `${playerStats.xp} / ${playerStats.xpToNext} XP`;

    const hpPct = Math.min(100, (playerStats.hp / playerStats.maxHp) * 100);
    hpBarFill.style.width = hpPct + '%';
    hpLabelEl.textContent = `${playerStats.hp} / ${playerStats.maxHp} HP${playerStats.derrotado ? ' (a recuperar)' : ''}`;
}

// ligar estatísticas → HUD
registarCallbacksStats(atualizarHUD, () => atualizarHUD(), atualizarHUD);
atualizarHUD();
