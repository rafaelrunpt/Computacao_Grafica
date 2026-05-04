import * as THREE from 'three';
import { mapBounds } from './mapa.js';

export const minimapCamera = new THREE.OrthographicCamera(-8, 8, 8, -8, 1, 100);

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

        const viewSize = 8; 
        
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

        let camX = playerPos.x;
        let camZ = playerPos.z;

        // Tranca a câmara para não mostrar o azul (vazio)
        if (maxCamX > minCamX) camX = Math.max(minCamX, Math.min(maxCamX, playerPos.x));
        else camX = centerX; // Proteção caso o teu mapa seja muito pequeno
        
        if (maxCamZ > minCamZ) camZ = Math.max(minCamZ, Math.min(maxCamZ, playerPos.z));
        else camZ = centerZ;

        minimapCamera.position.set(camX, 50, camZ);
        minimapCamera.lookAt(camX, 0, camZ);

        const size = 150; 
        const margin = 20;
        const borderThickness = 3; 

        const xPos = margin + borderThickness;
        const yPos = margin + borderThickness;

        renderer.setViewport(xPos, yPos, size, size);
        renderer.setScissor(xPos, yPos, size, size);
        renderer.setScissorTest(true);
        
        renderer.render(scene, minimapCamera);
    }
}