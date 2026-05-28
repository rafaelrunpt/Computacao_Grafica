// --------------------------------------------------------
// FPS COUNTER — controlado pelo settings.showFps
// Mostra também draw calls + triângulos (renderer.info) para
// diagnosticar gargalos de GPU/draw-calls em vez de só FPS.
// Em modo debug (showFps ligado) também mostra contagem de meshes
// dentro/fora do frustum, para verificar se o culling funciona.
// --------------------------------------------------------
import * as THREE from 'three';
import { settings, onSettingChange } from '../systems/settings.js';
import { renderer } from '../core/renderer.js';

let _scene = null;
let _camera = null;
export function setFpsDebugTargets(scene, camera) { _scene = scene; _camera = camera; }

const _frustum = new THREE.Frustum();
const _projScreen = new THREE.Matrix4();
const _tmpSphere = new THREE.Sphere();

function countCulling() {
    if (!_scene || !_camera) return null;
    _projScreen.multiplyMatrices(_camera.projectionMatrix, _camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreen);
    let drawn = 0, culledLayer = 0, culledFrustum = 0, culledVisible = 0;
    _scene.traverse(o => {
        if (!o.isMesh) return;
        if (!o.visible) { culledVisible++; return; }
        // Sistema de culling do jogo: meshes "atrás da câmara" são movidos
        // para uma layer que a câmara principal não desenha. Contam aqui.
        if (!o.layers.test(_camera.layers)) { culledLayer++; return; }
        if (o.frustumCulled) {
            const g = o.geometry;
            if (!g.boundingSphere) g.computeBoundingSphere?.();
            if (g.boundingSphere) {
                _tmpSphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
                if (!_frustum.intersectsSphere(_tmpSphere)) { culledFrustum++; return; }
            }
        }
        drawn++;
    });
    return { drawn, culledLayer, culledFrustum, culledVisible };
}

const el = document.createElement('div');
el.id = 'fps-counter';
el.style.cssText = `
    position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.55);
    color: #aaffbb;
    border: 1px solid #6a5020;
    border-radius: 4px;
    padding: 3px 10px;
    font-family: 'Courier New', monospace;
    font-size: 12px; letter-spacing: 1px;
    z-index: 200;
    pointer-events: none;
    display: none;
    white-space: nowrap;
`;
document.body.appendChild(el);

let _frames = 0;
let _last = performance.now();
let _lastCullTick = 0;
let _cachedCull = null;

// Chamado pelo main.js entre _cullBehindCamera e o render, para que o estado
// dos layers reflicta o que o renderer vai realmente usar.
export function sampleCullingNow() {
    if (!settings.showFps) return;
    const now = performance.now();
    if (now - _lastCullTick < 2000) return;
    _cachedCull = countCulling();
    _lastCullTick = now;
}

function applyVisibility() { el.style.display = settings.showFps ? 'block' : 'none'; }
applyVisibility();
onSettingChange('showFps', applyVisibility);

export function tickFps() {
    _frames++;
    const now = performance.now();
    if (now - _last >= 500) {
        const fps = Math.round(_frames * 1000 / (now - _last));
        _frames = 0; _last = now;
        if (settings.showFps) {
            const info = renderer.info.render;
            const tris = info.triangles >= 1000
                ? (info.triangles / 1000).toFixed(1) + 'k'
                : info.triangles;
            // Culling stats são amostradas via sampleCullingNow() pelo main.js
            // no momento certo (entre cull e restore). Aqui só exibimos a cache.
            const cull = _cachedCull;
            const cullStr = cull
                ? `  |  draw ${cull.drawn} / layer ${cull.culledLayer} / frust ${cull.culledFrustum}`
                : '';
            el.textContent = `${fps} FPS  |  ${info.calls} calls  |  ${tris} tris${cullStr}`;
        }
    }
}
