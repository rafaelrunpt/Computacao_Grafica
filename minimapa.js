import * as THREE from 'three';
import { mapGrid, tileSize } from './mapa.js';

export const minimapCamera = new THREE.OrthographicCamera(-8, 8, 8, -8, 1, 100);

export function renderizarMinimapa(renderer, scene, windowWidth, windowHeight, playerPos, mapaAberto) {
    const border = document.getElementById('minimap-border');

    // Dimensões totais do mapa
    const mapWidth = mapGrid[0].length * tileSize;
    const mapHeight = mapGrid.length * tileSize;

    if (mapaAberto) {
        if(border) border.style.display = 'none'; 

        // LÓGICA DO MAPA GRANDE CENTRADO
        minimapCamera.left = -mapWidth / 2;
        minimapCamera.right = mapWidth / 2;
        minimapCamera.top = mapHeight / 2;
        minimapCamera.bottom = -mapHeight / 2;
        minimapCamera.updateProjectionMatrix();

        minimapCamera.position.set(mapWidth / 2, 20, mapHeight / 2);
        minimapCamera.lookAt(mapWidth / 2, 0, mapHeight / 2);

        const bigMapSize = Math.min(windowWidth, windowHeight) * 0.8;
        const xPos = (windowWidth - bigMapSize) / 2;
        const yPos = (windowHeight - bigMapSize) / 2;

        renderer.setViewport(xPos, yPos, bigMapSize, bigMapSize);
        renderer.setScissor(xPos, yPos, bigMapSize, bigMapSize);
        renderer.setScissorTest(true); 
        renderer.render(scene, minimapCamera);
        
    } else {
        if(border) border.style.display = 'block'; 

        // LÓGICA DO MINIMAPA LOCAL (Canto Inferior Esquerdo)
        const viewSize = 8; // O "zoom" da nossa câmara
        
        minimapCamera.left = -viewSize;
        minimapCamera.right = viewSize;
        minimapCamera.top = viewSize;
        minimapCamera.bottom = -viewSize;
        minimapCamera.updateProjectionMatrix();

        // CAMERA CLAMPING (nao sair dos limites) 
    
        
        const minX = viewSize; 
        const maxX = mapWidth - viewSize - 1;
        const minZ = viewSize;
        const maxZ = mapHeight - viewSize - 1;
        

        const camX = Math.max(minX, Math.min(maxX, playerPos.x));
        const camZ = Math.max(minZ, Math.min(maxZ, playerPos.z));

        minimapCamera.position.set(camX, 20, camZ);
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