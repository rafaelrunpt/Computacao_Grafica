import * as THREE from 'three';
import { player, coroaGroup, brincosGroup, oculosGroup, aureolaGroup, mascaraGroup } from '../entities/jogador.js';
import { playerStats, registarCallbacksStats } from '../systems/player-stats.js';

// ---- fontes pixel (uma só vez) ----
(function carregarFontesHUD() {
    if (document.getElementById('hud-pixel-fonts')) return;
    const link = document.createElement('link');
    link.id = 'hud-pixel-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
    document.head.appendChild(link);
})();

(function injectarEstilosHUD() {
    if (document.getElementById('hud-pixel-styles')) return;
    const s = document.createElement('style');
    s.id = 'hud-pixel-styles';
    s.textContent = `
        #game-hud {
            position: fixed; top: 14px; left: 14px;
            display: flex; align-items: flex-start; gap: 14px;
            z-index: 50; pointer-events: none;
            font-family: 'VT323', monospace;
            image-rendering: pixelated;
        }
        #game-hud * { box-sizing: border-box; image-rendering: pixelated; }

        /* Moldura octogonal do avatar */
        #game-hud .hud-avatar {
            position: relative; width: 70px; height: 70px; flex-shrink: 0;
            /* moldura é background-image (data URI) injectada em JS — uma
               única bitmap cacheada em vez de ~80 <rect> SVG recompostos */
            background-repeat: no-repeat;
            background-size: 100% 100%;
        }
        #game-hud .hud-avatar canvas {
            position: absolute; top: 9px; left: 9px;
            width: 52px; height: 52px;
            image-rendering: pixelated;
            clip-path: polygon(
                25% 0%, 75% 0%, 100% 25%, 100% 75%,
                75% 100%, 25% 100%, 0% 75%, 0% 25%
            );
        }

        /* Coluna de info */
        #game-hud .hud-info {
            display: flex; flex-direction: column; gap: 4px;
            min-width: 160px;
            /* sem padding-top — barras alinhadas com o topo do avatar */
            padding-top: 0;
        }
        #game-hud .hud-level {
            font-family: 'Press Start 2P', monospace; font-size: 11px;
            color: #ffd86b; letter-spacing: 2px;
            /* sem text-shadow com blur — apenas drop sharp (zero custo de paint) */
            text-shadow: 0 2px 0 #4a2f08, 0 3px 0 #0a0704;
            line-height: 1;
        }
        #game-hud .hud-level .num {
            color: #fff4c2; font-family: 'VT323', monospace;
            font-size: 18px; margin-left: 6px; letter-spacing: 0; vertical-align: -1px;
        }

        /* Barras pixel */
        #game-hud .hud-bar {
            position: relative; width: 160px; height: 14px;
            background: #0a0704;
            box-shadow: 0 0 0 1px #0a0704, 0 0 0 2px #4a2f08, 0 0 0 3px #0a0704;
            margin: 1px 3px 0;
        }
        #game-hud .hud-bar .track {
            position: absolute; inset: 2px;
            background: linear-gradient(180deg, #1a0a05 0%, #0a0402 100%);
        }
        #game-hud .hud-bar .fill {
            position: absolute; top: 2px; bottom: 2px; left: 2px;
            width: calc(var(--pct, 100%) - 4px);
            background: var(--c-mid);
            box-shadow: inset 0 0 0 1px var(--c-edge);
            transition: width .35s steps(8);
        }
        #game-hud .hud-bar .fill::before {
            content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px;
            background: var(--c-hi);
        }
        #game-hud .hud-bar .fill::after {
            content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
            background: var(--c-lo);
        }
        #game-hud .hud-bar.xp {
            --c-hi: #d97abf; --c-mid: #a85ad9; --c-lo: #7a3aa8; --c-edge: rgba(0,0,0,.5);
            box-shadow: 0 0 0 1px #0a0704, 0 0 0 2px #3a1a5a, 0 0 0 3px #0a0704;
        }
        #game-hud .hud-bar.hp {
            --c-hi: #d94a3a; --c-mid: #a83a26; --c-lo: #6a1a10; --c-edge: rgba(0,0,0,.5);
            box-shadow: 0 0 0 1px #0a0704, 0 0 0 2px #5a1a10, 0 0 0 3px #0a0704;
        }

        /* Labels (tag esq, valor dir) */
        #game-hud .hud-label {
            display: flex; justify-content: space-between; align-items: baseline;
            padding: 0 4px; margin-top: 1px; line-height: 1;
        }
        #game-hud .hud-label .tag {
            font-family: 'Press Start 2P', monospace; font-size: 8px;
            letter-spacing: 1px; text-shadow: 0 1px 0 #0a0704;
        }
        #game-hud .hud-label .val {
            font-family: 'VT323', monospace; font-size: 14px;
            text-shadow: 0 1px 0 #0a0704;
        }
        #game-hud .hud-label.xp .tag { color: #c0a0e0; }
        #game-hud .hud-label.xp .val { color: #e8c8ff; }
        #game-hud .hud-label.hp .tag { color: #ff9a8a; }
        #game-hud .hud-label.hp .val { color: #ffd0c0; }

        /* Cintilas */
        #game-hud .hud-cintilas {
            display: flex; align-items: center; gap: 6px;
            margin-top: 6px; padding: 4px 8px 4px 6px;
            background: linear-gradient(180deg, #1a2a3a 0%, #0a1420 100%);
            box-shadow: 0 0 0 1px #0a0704, 0 0 0 2px #2a4a6a, 0 0 0 3px #0a0704;
            align-self: flex-start;
        }
        #game-hud .hud-cintilas .icon {
            width: 14px; height: 14px; flex-shrink: 0; image-rendering: pixelated;
            object-fit: contain; display: block;
        }
        #game-hud .hud-cintilas .tag {
            font-family: 'Press Start 2P', monospace; font-size: 8px;
            color: #5ab8d9; letter-spacing: 1px; text-shadow: 0 1px 0 #0a0704;
        }
        #game-hud .hud-cintilas .val {
            font-family: 'VT323', monospace; font-size: 18px;
            color: #a8e0f0; letter-spacing: 1px; line-height: 1;
            text-shadow: 0 1px 0 #0a0704;
        }
    `;
    document.head.appendChild(s);
})();

// ---- aviso de interacção ----
const promptEl = document.createElement('div');
promptEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;padding:8px 18px;border-radius:8px;font-family:sans-serif;font-size:16px;display:none;pointer-events:none;z-index:50;';
document.body.appendChild(promptEl);

export function showPrompt(msg) { promptEl.textContent = msg; promptEl.style.display = 'block'; }
export function hidePrompt()    { promptEl.style.display = 'none'; }

let _hudVisivel = true;
export function isHudVisivel() { return _hudVisivel; }
export function setHudVisible(v) {
    _hudVisivel = !!v;
    hudEl.style.display    = v ? 'flex' : 'none';
    promptEl.style.display = v ? promptEl.style.display : 'none';
    if (v) markAvatarDirty(); // re-renderiza ao reaparecer
}

// Render do avatar é caro (segundo contexto WebGL). Só renderizamos quando
// algo mudou — equipamento, materiais, ou o próprio HUD voltar a ser visível.
let _avatarDirty = true;
export function markAvatarDirty() { _avatarDirty = true; }
export function renderAvatarIfDirty() {
    if (!_hudVisivel || !_avatarDirty) return;
    avatarRenderer.render(avatarScene, avatarCam);
    _avatarDirty = false;
}

// ---- HUD (estrutura DOM) ----
const hudEl = document.createElement('div');
hudEl.id = 'game-hud';

// Avatar — canvas WebGL dentro de moldura pixel octogonal.
// A moldura é uma SVG serializada como data URI e usada como background
// (uma só bitmap cacheada pelo compositor) em vez de SVG inline com ~80
// <rect>, que custaria recomposição a cada frame que o canvas actualiza.
const AVATAR_FRAME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 54" shape-rendering="crispEdges"><g fill="#0a0704"><rect x="14" y="0" width="26" height="2"/><rect x="10" y="2" width="4" height="2"/><rect x="40" y="2" width="4" height="2"/><rect x="6" y="4" width="4" height="2"/><rect x="44" y="4" width="4" height="2"/><rect x="4" y="6" width="2" height="4"/><rect x="48" y="6" width="2" height="4"/><rect x="2" y="10" width="2" height="4"/><rect x="50" y="10" width="2" height="4"/><rect x="0" y="14" width="2" height="26"/><rect x="52" y="14" width="2" height="26"/><rect x="2" y="40" width="2" height="4"/><rect x="50" y="40" width="2" height="4"/><rect x="4" y="44" width="2" height="4"/><rect x="48" y="44" width="2" height="4"/><rect x="6" y="48" width="4" height="2"/><rect x="44" y="48" width="4" height="2"/><rect x="10" y="50" width="4" height="2"/><rect x="40" y="50" width="4" height="2"/><rect x="14" y="52" width="26" height="2"/></g><g fill="#7a4d12"><rect x="14" y="2" width="26" height="2"/><rect x="10" y="4" width="34" height="2"/><rect x="6" y="6" width="4" height="2"/><rect x="44" y="6" width="4" height="2"/><rect x="4" y="8" width="2" height="6"/><rect x="48" y="8" width="2" height="6"/><rect x="2" y="14" width="2" height="26"/><rect x="50" y="14" width="2" height="26"/><rect x="4" y="40" width="2" height="6"/><rect x="48" y="40" width="2" height="6"/><rect x="6" y="46" width="4" height="2"/><rect x="44" y="46" width="4" height="2"/><rect x="10" y="48" width="34" height="2"/><rect x="14" y="50" width="26" height="2"/></g><g fill="#c98a22"><rect x="14" y="4" width="26" height="2"/><rect x="10" y="6" width="34" height="2"/><rect x="6" y="8" width="42" height="2"/><rect x="4" y="10" width="2" height="4"/><rect x="48" y="10" width="2" height="4"/><rect x="2" y="14" width="2" height="26"/><rect x="50" y="14" width="2" height="26"/></g><g fill="#ffd86b"><rect x="14" y="3" width="26" height="1"/><rect x="10" y="5" width="4" height="1"/><rect x="40" y="5" width="4" height="1"/><rect x="6" y="7" width="4" height="1"/><rect x="44" y="7" width="4" height="1"/><rect x="4" y="9" width="2" height="1"/><rect x="48" y="9" width="2" height="1"/><rect x="3" y="10" width="1" height="4"/><rect x="50" y="10" width="1" height="4"/></g><g fill="#4a2f08"><rect x="14" y="48" width="26" height="1"/><rect x="10" y="46" width="4" height="1"/><rect x="40" y="46" width="4" height="1"/><rect x="6" y="44" width="4" height="1"/><rect x="44" y="44" width="4" height="1"/></g><g fill="#0a0704"><rect x="14" y="6" width="26" height="1"/><rect x="10" y="8" width="34" height="1"/><rect x="6" y="10" width="42" height="1"/><rect x="6" y="43" width="42" height="1"/><rect x="10" y="45" width="34" height="1"/><rect x="14" y="47" width="26" height="1"/></g><g fill="#ffd86b"><rect x="9" y="9" width="2" height="2"/><rect x="43" y="9" width="2" height="2"/><rect x="9" y="43" width="2" height="2"/><rect x="43" y="43" width="2" height="2"/></g><g fill="#0a0704"><rect x="10" y="10" width="1" height="1"/><rect x="44" y="10" width="1" height="1"/><rect x="10" y="44" width="1" height="1"/><rect x="44" y="44" width="1" height="1"/></g></svg>`;

const avatarBox = document.createElement('div');
avatarBox.className = 'hud-avatar';
avatarBox.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(AVATAR_FRAME_SVG).replace(/'/g, '%27').replace(/"/g, '%22')}")`;
const avatarCanvas = document.createElement('canvas');
avatarCanvas.width = 128; avatarCanvas.height = 128;
avatarBox.appendChild(avatarCanvas);

export const avatarRenderer = new THREE.WebGLRenderer({ canvas: avatarCanvas, antialias: true, alpha: true });
avatarRenderer.setSize(128, 128, false); // buffer interno maior — avatar agora ocupa 52×52 em CSS
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
    markAvatarDirty();
}

function _syncVis(clone, src) {
    if (!clone) return;
    if (clone.visible !== src.visible) { clone.visible = src.visible; markAvatarDirty(); }
}
export function syncAvatarMaterials() {
    _syncVis(_avatarCoroaClone,   coroaGroup);
    _syncVis(_avatarBrincosClone, brincosGroup);
    _syncVis(_avatarOculosClone,  oculosGroup);
    _syncVis(_avatarAureolaClone, aureolaGroup);
    _syncVis(_avatarMascaraClone, mascaraGroup);

    if (++_avatarSyncCounter % 10 !== 0) return;
    let materialChanged = false;
    for (const { orig, clone } of _avatarOriginalMeshes) {
        if (!orig.material || !clone.material) continue;
        if (!clone.material.color.equals(orig.material.color)) {
            clone.material.color.copy(orig.material.color);
            materialChanged = true;
        }
        if (orig.material.map !== undefined && clone.material.map !== orig.material.map) {
            clone.material.map = orig.material.map;
            materialChanged = true;
        }
        if (materialChanged) clone.material.needsUpdate = true;
    }
    if (materialChanged) markAvatarDirty();
}

// ---- coluna de info ----
const infoEl = document.createElement('div');
infoEl.className = 'hud-info';
infoEl.innerHTML = `
    <div class="hud-level">NÍVEL<span class="num" id="hud-level-val">1</span></div>

    <div class="hud-bar xp"><div class="track"></div><div class="fill" id="hud-xp-fill" style="--pct:0%"></div></div>
    <div class="hud-label xp">
        <span class="tag">XP</span>
        <span class="val" id="hud-xp-val">0 / 0</span>
    </div>

    <div class="hud-bar hp"><div class="track"></div><div class="fill" id="hud-hp-fill" style="--pct:100%"></div></div>
    <div class="hud-label hp">
        <span class="tag">HP</span>
        <span class="val" id="hud-hp-val">0 / 0</span>
    </div>

    <div class="hud-cintilas">
        <img class="icon" src="assets/icones/cintilas.png" alt="">
        <span class="val" id="hud-cintilas-val">0</span>
        <span class="tag">CINTILAS</span>
    </div>
`;

hudEl.append(avatarBox, infoEl);
document.body.appendChild(hudEl);

// referências para atualizarHUD
const levelValEl    = infoEl.querySelector('#hud-level-val');
const xpFillEl      = infoEl.querySelector('#hud-xp-fill');
const xpValEl       = infoEl.querySelector('#hud-xp-val');
const hpFillEl      = infoEl.querySelector('#hud-hp-fill');
const hpValEl       = infoEl.querySelector('#hud-hp-val');

import('../systems/currency.js').then(({ onCintilasChange, getCintilas }) => {
    const el = document.getElementById('hud-cintilas-val');
    if (el) el.textContent = String(getCintilas());
    onCintilasChange((total) => {
        const e = document.getElementById('hud-cintilas-val');
        if (e) e.textContent = String(total);
    });
});

export function atualizarHUD() {
    const xpPct = Math.min(100, (playerStats.xp / playerStats.xpToNext) * 100);
    levelValEl.textContent = playerStats.level;
    xpFillEl.style.setProperty('--pct', xpPct + '%');
    xpValEl.textContent = `${playerStats.xp} / ${playerStats.xpToNext}`;

    const hpPct = Math.min(100, (playerStats.hp / playerStats.maxHp) * 100);
    hpFillEl.style.setProperty('--pct', hpPct + '%');
    hpValEl.textContent = `${playerStats.hp} / ${playerStats.maxHp}${playerStats.derrotado ? ' ⟡' : ''}`;
}

registarCallbacksStats(atualizarHUD, () => atualizarHUD(), atualizarHUD);
atualizarHUD();
