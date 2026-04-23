import * as THREE from 'three';
import { mapGrid, tileSize } from './mapa.js';

// Configuramos a câmara aqui, escondida do main.js
const mapWidth = mapGrid[0].length * tileSize;
const mapHeight = mapGrid.length * tileSize;

export const minimapCamera = new THREE.OrthographicCamera(-15, 15, 10, -4.5, 1, 100);
minimapCamera.position.set(mapWidth / 2, 20, mapHeight / 2);
minimapCamera.lookAt(mapWidth / 2, 0, mapHeight / 2);

// Esta é a função que o Maestro (main.js) vai chamar todos os frames
export function renderizarMinimapa(renderer, scene, windowWidth, windowHeight) {
    const minimapSize = 250;
    const margin = 20;

    renderer.setViewport(windowWidth - minimapSize - margin, windowHeight - minimapSize - margin, minimapSize, minimapSize);
    renderer.setScissor(windowWidth - minimapSize - margin, windowHeight - minimapSize - margin, minimapSize, minimapSize);
    renderer.setScissorTest(true);
    
    renderer.render(scene, minimapCamera);
}