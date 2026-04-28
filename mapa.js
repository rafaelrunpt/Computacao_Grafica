import * as THREE from 'three';
import { modelos } from './assets.js';

export const tileSize = 1;

// 0=Relva, 1=Caminho, 2=Fronteira, 3=Relva Alta, 5=Dungeon, 6=Casas, 8=Porta
export const mapGrid = [
    [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,5,5,5,5,5,0,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,5,5,5,5,5,0,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,5,5,5,5,5,0,0,0,0,0,2,0,0,0,0,0,3,3,3,3,3,0,0,0,0,2],
    [2,0,0,0,5,5,8,8,5,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,0,0,0,2],
    [2,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,0,0,2],
    [2,0,0,0,0,1,1,1,0,0,0,2,2,2,2,0,0,0,0,3,3,3,3,3,3,3,0,0,0,2],
    [2,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,3,3,0,0,0,0,0,2],
    [2,0,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,1,1,1,0,0,0,0,0,0,0,0,0,2],
    [2,0,3,3,3,3,3,3,3,3,3,0,0,2,2,2,0,0,0,1,1,0,0,0,0,0,0,0,0,2],
    [2,0,3,3,3,1,1,1,1,3,3,3,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,2],
    [2,0,3,3,3,1,1,1,1,1,1,3,3,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,2],
    [2,0,0,3,3,3,3,3,3,3,1,1,3,3,0,0,0,2,2,2,2,2,0,1,1,0,0,0,0,2],
    [2,0,0,0,0,0,3,3,3,3,3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,2],
    [2,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,2],
    [2,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,2],
    [2,0,0,0,2,2,2,0,0,0,0,0,0,0,6,6,0,0,0,6,6,1,1,1,6,6,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,6,6,1,1,1,6,6,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,6,6,0,1,1,1,6,6,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,6,6,0,1,1,1,6,6,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2]
];

export function criarMapa(scene) {
    const matRelva = new THREE.MeshStandardMaterial({ color: 0x5cb85c }); 
    const matCaminho = new THREE.MeshStandardMaterial({ color: 0xa87b51 }); 
    const matFronteira = new THREE.MeshStandardMaterial({ color: 0x2b5e2b }); 
    const matRelvaAlta = new THREE.MeshStandardMaterial({ color: 0x1b4d1b });
    const matDungeon = new THREE.MeshStandardMaterial({ color: 0x808080 }); 
    const matPortaPreta = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const matCasa = new THREE.MeshStandardMaterial({ color: 0xffd700 }); 

    for (let z = 0; z < mapGrid.length; z++) {
        for (let x = 0; x < mapGrid[z].length; x++) {
            const tileType = mapGrid[z][x];
            let geo, mat, yPos = 0;
            let castShadow = false;

            if (tileType === 0) {
                geo = new THREE.PlaneGeometry(tileSize, tileSize);
                mat = matRelva;
            } else if (tileType === 1) {
                geo = new THREE.PlaneGeometry(tileSize, tileSize);
                mat = matCaminho; yPos = 0.01;
            } else if (tileType === 2) { 
                geo = new THREE.BoxGeometry(tileSize, tileSize * 2, tileSize);
                mat = matFronteira; yPos = tileSize; castShadow = true;
            } else if (tileType === 3) { 
                geo = new THREE.BoxGeometry(tileSize, tileSize * 0.5, tileSize);
                mat = matRelvaAlta; yPos = tileSize * 0.25; castShadow = true;
            } else if (tileType === 5) { 
                geo = new THREE.BoxGeometry(tileSize, tileSize * 3, tileSize);
                mat = matDungeon; yPos = tileSize * 1.5; castShadow = true;
            } else if (tileType === 8) { 
                geo = new THREE.BoxGeometry(tileSize, tileSize * 1.5, tileSize);
                mat = matPortaPreta; yPos = tileSize * 0.75;
            } else if (tileType === 6) { 
                geo = new THREE.BoxGeometry(tileSize, tileSize * 2, tileSize);
                mat = matCasa; yPos = tileSize; castShadow = true;
            }

            if (geo) {
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x * tileSize, yPos, z * tileSize);
                if (geo.type === 'PlaneGeometry') mesh.rotation.x = -Math.PI / 2;
                mesh.castShadow = castShadow;
                mesh.receiveShadow = true;
                scene.add(mesh);
            }
        }
    }
}

export function verificaColisao(futuroX, futuroZ) {
    const gridX = Math.round(futuroX / tileSize);
    const gridZ = Math.round(futuroZ / tileSize);

    if (gridZ < 0 || gridZ >= mapGrid.length || gridX < 0 || gridX >= mapGrid[0].length) return true; 

    const tipoDeBloco = mapGrid[gridZ][gridX];
    if (tipoDeBloco === 2 || tipoDeBloco === 5 || tipoDeBloco === 6 || tipoDeBloco === 8) return true; 
    return false; 
}