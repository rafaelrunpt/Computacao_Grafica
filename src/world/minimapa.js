import * as THREE from 'three';
import { mapBounds } from './mapa.js';

export const minimapCamera = new THREE.OrthographicCamera(-8, 8, 8, -8, 1, 100);

// posição suavizada da câmara do minimapa — evita tremido
const _miniCamPos = new THREE.Vector2(0, 0);

export function renderizarMinimapa(renderer, scene, windowWidth, windowHeight, playerPos, mapaAberto) {
    const border = document.getElementById('minimap-border');

    // 1. Calcular largura, altura e o CENTRO do mapa em tempo real
    const mapWidth = mapBounds.maxX - mapBounds.minX;
    const mapHeight = mapBounds.maxZ - mapBounds.minZ;
    const centerX = mapBounds.minX + mapWidth / 2;
    const centerZ = mapBounds.minZ + mapHeight / 2;

    if (mapaAberto) {
        if(border) border.style.display = 'none'; 

        minimapCamera.left = -mapWidth / 2;
        minimapCamera.right = mapWidth / 2;
        minimapCamera.top = mapHeight / 2;
        minimapCamera.bottom = -mapHeight / 2;
        minimapCamera.updateProjectionMatrix();

        minimapCamera.position.set(centerX, 50, centerZ); 
        minimapCamera.lookAt(centerX, 0, centerZ);

        const bigMapSize = Math.min(windowWidth, windowHeight) * 0.8;
        const xPos = (windowWidth - bigMapSize) / 2;
        const yPos = (windowHeight - bigMapSize) / 2;

        renderer.setViewport(xPos, yPos, bigMapSize, bigMapSize);
        renderer.setScissor(xPos, yPos, bigMapSize, bigMapSize);
        renderer.setScissorTest(true); 
        renderer.render(scene, minimapCamera);
        
    } else {
        if(border) border.style.display = 'block';

        const viewSize = 22;

        minimapCamera.left = -viewSize;
        minimapCamera.right = viewSize;
        minimapCamera.top = viewSize;
        minimapCamera.bottom = -viewSize;
        minimapCamera.updateProjectionMatrix();

        // 2. Limites novos da câmara (Camera Clamping) baseados no centro do mapa
        const minCamX = mapBounds.minX + viewSize;
        const maxCamX = mapBounds.maxX - viewSize;
        const minCamZ = mapBounds.minZ + viewSize;
        const maxCamZ = mapBounds.maxZ - viewSize;

        let targetX = playerPos.x;
        let targetZ = playerPos.z;

        if (maxCamX > minCamX) targetX = Math.max(minCamX, Math.min(maxCamX, playerPos.x));
        else targetX = centerX;

        if (maxCamZ > minCamZ) targetZ = Math.max(minCamZ, Math.min(maxCamZ, playerPos.z));
        else targetZ = centerZ;

        // lerp suave — elimina tremido causado por movimento pixel-a-pixel
        _miniCamPos.x += (targetX - _miniCamPos.x) * 0.08;
        _miniCamPos.y += (targetZ - _miniCamPos.y) * 0.08;

        minimapCamera.position.set(_miniCamPos.x, 50, _miniCamPos.y);
        minimapCamera.lookAt(_miniCamPos.x, 0, _miniCamPos.y);

        // Bússola: caixa CSS 180x180 em (20,20) → centro (110,110)
        // janela visível dentro do anel = círculo de raio 58 (diâmetro 116)
        const size = 116;
        const xPos = 52;
        const yPos = 52;

        renderer.setViewport(xPos, yPos, size, size);
        renderer.setScissor(xPos, yPos, size, size);
        renderer.setScissorTest(true);

        renderer.render(scene, minimapCamera);
    }
}