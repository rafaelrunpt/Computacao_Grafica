import * as THREE from 'three';
import { mapBounds } from './mapa.js';

export const minimapCamera = new THREE.OrthographicCamera(-8, 8, 8, -8, 1, 100);

const _miniCamPos = new THREE.Vector2(0, 0);

// ---- Cache de luzes shadow-casters ----
// Em vez de percorrer scene.children todos os frames, descobre uma vez na primeira chamada.
let _shadowLights = null;
function _getShadowLights(scene) {
    if (_shadowLights !== null) return _shadowLights;
    _shadowLights = [];
    for (const child of scene.children) {
        if (child.isLight && child.shadow && child.castShadow) {
            _shadowLights.push(child);
        }
    }
    return _shadowLights;
}

const _savedIntensities = [];

export function renderizarMinimapa(renderer, scene, windowWidth, windowHeight, playerPos, mapaAberto) {
    const border = document.getElementById('minimap-border');

    const mapWidth  = mapBounds.maxX - mapBounds.minX;
    const mapHeight = mapBounds.maxZ - mapBounds.minZ;
    const centerX   = mapBounds.minX + mapWidth  / 2;
    const centerZ   = mapBounds.minZ + mapHeight / 2;

    if (mapaAberto) {
        if (border) border.style.display = 'none';

        minimapCamera.left   = -mapWidth  / 2;
        minimapCamera.right  =  mapWidth  / 2;
        minimapCamera.top    =  mapHeight / 2;
        minimapCamera.bottom = -mapHeight / 2;
        minimapCamera.updateProjectionMatrix();
        minimapCamera.position.set(centerX, 50, centerZ);
        minimapCamera.lookAt(centerX, 0, centerZ);

        const bigMapSize = Math.min(windowWidth, windowHeight) * 0.8;
        const xPos = (windowWidth  - bigMapSize) / 2;
        const yPos = (windowHeight - bigMapSize) / 2;

        renderer.setViewport(xPos, yPos, bigMapSize, bigMapSize);
        renderer.setScissor(xPos, yPos, bigMapSize, bigMapSize);
        renderer.setScissorTest(true);
        // Força o shadow pass — sem render principal neste frame, o shadow map
        // estaria stale e mostraria sombras inconsistentes / em falta.
        renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, minimapCamera);
        renderer.setScissorTest(false);

    } else {
        if (border) border.style.display = 'block';

        const viewSize = 22;
        minimapCamera.left   = -viewSize;
        minimapCamera.right  =  viewSize;
        minimapCamera.top    =  viewSize;
        minimapCamera.bottom = -viewSize;
        minimapCamera.updateProjectionMatrix();

        const minCamX = mapBounds.minX + viewSize, maxCamX = mapBounds.maxX - viewSize;
        const minCamZ = mapBounds.minZ + viewSize, maxCamZ = mapBounds.maxZ - viewSize;

        let targetX = playerPos.x, targetZ = playerPos.z;
        if (maxCamX > minCamX) targetX = Math.max(minCamX, Math.min(maxCamX, playerPos.x));
        else targetX = centerX;
        if (maxCamZ > minCamZ) targetZ = Math.max(minCamZ, Math.min(maxCamZ, playerPos.z));
        else targetZ = centerZ;

        _miniCamPos.x += (targetX - _miniCamPos.x) * 0.08;
        _miniCamPos.y += (targetZ - _miniCamPos.y) * 0.08;
        minimapCamera.position.set(_miniCamPos.x, 50, _miniCamPos.y);
        minimapCamera.lookAt(_miniCamPos.x, 0, _miniCamPos.y);

        // Desativa sombras e força fundo preto no minimap pequeno para evitar flicker
        // de aliasing e transparências indesejadas.
        const _prevShadows = renderer.shadowMap.enabled;
        renderer.shadowMap.enabled = false;
        
        const _prevBg = scene.background;
        scene.background = new THREE.Color(0x000000);

        const size = 116, xPos = 52, yPos = 52;
        renderer.setViewport(xPos, yPos, size, size);
        renderer.setScissor(xPos, yPos, size, size);
        renderer.setScissorTest(true);
        
        // Limpar a área explicitamente com a cor de fundo (preto)
        renderer.clear();
        renderer.render(scene, minimapCamera);
        
        renderer.setScissorTest(false);
        scene.background = _prevBg;
        renderer.shadowMap.enabled = _prevShadows;
    }
}
