import * as THREE from 'three';
import { mapBounds } from './mapa.js';

// ---- Overlay HTML do mapa ----
const _mapaOverlay = document.createElement('div');
_mapaOverlay.style.cssText = `
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 50;
    display: none;
    font-family: 'Georgia', serif;
`;
_mapaOverlay.innerHTML = `
    <div style="
        position: absolute; inset: 0;
        background:
            radial-gradient(ellipse at center, rgba(20,12,4,0.18) 0%, rgba(8,4,0,0.72) 100%);
        mix-blend-mode: multiply;
    "></div>

    <!-- bordas estilo pergaminho -->
    <div style="
        position: absolute; inset: 12px;
        border: 3px solid #c8a050;
        border-radius: 4px;
        box-shadow: 0 0 0 6px rgba(0,0,0,0.5), inset 0 0 40px rgba(180,120,30,0.15), 0 0 60px rgba(0,0,0,0.8);
    "></div>
    <div style="
        position: absolute; inset: 18px;
        border: 1px solid rgba(200,160,80,0.35);
        border-radius: 2px;
    "></div>

    <!-- título -->
    <div style="
        position: absolute; top: 22px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(90deg, transparent, rgba(10,6,0,0.85) 20%, rgba(10,6,0,0.85) 80%, transparent);
        padding: 6px 40px;
        color: #f0d080;
        font-size: 18px;
        font-weight: bold;
        letter-spacing: 8px;
        text-shadow: 0 0 12px #a07020, 2px 2px 0 #000;
        white-space: nowrap;
    ">✦ MAPA DO MUNDO ✦</div>

    <!-- canto sup esq -->
    <div style="position:absolute;top:8px;left:8px;width:40px;height:40px;
        border-top:3px solid #c8a050;border-left:3px solid #c8a050;border-radius:3px 0 0 0;"></div>
    <!-- canto sup dir -->
    <div style="position:absolute;top:8px;right:8px;width:40px;height:40px;
        border-top:3px solid #c8a050;border-right:3px solid #c8a050;border-radius:0 3px 0 0;"></div>
    <!-- canto inf esq -->
    <div style="position:absolute;bottom:8px;left:8px;width:40px;height:40px;
        border-bottom:3px solid #c8a050;border-left:3px solid #c8a050;border-radius:0 0 0 3px;"></div>
    <!-- canto inf dir -->
    <div style="position:absolute;bottom:8px;right:8px;width:40px;height:40px;
        border-bottom:3px solid #c8a050;border-right:3px solid #c8a050;border-radius:0 0 3px 0;"></div>

    <!-- rodapé -->
    <div style="
        position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%);
        color: rgba(200,160,80,0.6);
        font-size: 11px;
        letter-spacing: 4px;
        text-shadow: 1px 1px 0 #000;
        white-space: nowrap;
    ">[ M ] FECHAR MAPA</div>
`;
document.body.appendChild(_mapaOverlay);

export const minimapCamera = new THREE.OrthographicCamera(-8, 8, 8, -8, 1, 100);
minimapCamera.layers.enable(1);

const _miniCamPos = new THREE.Vector2(0, 0);

// Fundo preto cacheado para o minimapa pequeno — evita alocar um
// THREE.Color novo a cada frame (era ~60 alocações/s + pressão de GC).
const _miniBg = new THREE.Color(0x000000);

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
        _mapaOverlay.style.display = 'block';

        // Ocupa o ecrã inteiro mantendo a relação de aspecto do mundo:
        // expandimos o frustum ortográfico no eixo mais comprido do
        // ecrã para o mapa caber sem distorção e sem letterbox negro.
        const winAspect = windowWidth / windowHeight;
        const mapAspect = mapWidth / mapHeight;
        let halfW, halfH;
        if (winAspect > mapAspect) {
            halfH = mapHeight / 2;
            halfW = halfH * winAspect;
        } else {
            halfW = mapWidth / 2;
            halfH = halfW / winAspect;
        }
        // pequena margem para não tocar nos bordos do ecrã
        const PAD = 1.05;
        halfW *= PAD; halfH *= PAD;

        minimapCamera.left   = -halfW;
        minimapCamera.right  =  halfW;
        minimapCamera.top    =  halfH;
        minimapCamera.bottom = -halfH;
        minimapCamera.updateProjectionMatrix();
        minimapCamera.position.set(centerX, 50, centerZ);
        minimapCamera.lookAt(centerX, 0, centerZ);

        renderer.setViewport(0, 0, windowWidth, windowHeight);
        renderer.setScissor(0, 0, windowWidth, windowHeight);
        renderer.setScissorTest(false);
        // Força o shadow pass — sem render principal neste frame, o shadow map
        // estaria stale e mostraria sombras inconsistentes / em falta.
        renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, minimapCamera);

    } else {
        if (border) border.style.display = 'block';
        _mapaOverlay.style.display = 'none';

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
        scene.background = _miniBg;

        // Ajustado ao olho interior do PNG de bússola (assets/HUD/compass.png).
        // PNG 44×46 px, olho transparente em PNG cols 8-35 × rows 9-36 (28×28).
        // Escalado para o border CSS 180×180:
        //   olho ≈ 115 (largura) × 110 (altura) CSS
        //   centro do olho em coords screen (bottom-left): (108, 112)
        // Para preencher SEM ultrapassar o anel: size = 115 (encaixa na
        // largura, leve overlap simétrico em altura escondido pelo anel
        // opaco). xPos = centro x − size/2; yPos = centro y − size/2.
        const size = 117, xPos = 50, yPos = 54;
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
