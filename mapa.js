import * as THREE from 'three';

export const tileSize = 1;

// 0=Relva, 1=Caminho, 2=Fronteira, 3=Relva Alta, 5=Dungeon, 6=Casas
export const mapGrid = [
    [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0,0,0,2],
    [2,0,6,6,0,0,6,6,0,0,0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0,0,0,2],
    [2,0,6,6,0,0,6,6,0,0,0,0,0,0,0,3,3,3,3,3,3,0,0,0,5,5,5,5,0,2],
    [2,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,5,5,5,5,0,2],
    [2,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,6,5,0,2],
    [2,6,6,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,2],
    [2,6,6,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,1,0,0,0,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2] // Resumi para 10 linhas para o código caber, podes expandir!
];

export function criarMapa(scene) {
    const matRelva = new THREE.MeshStandardMaterial({ color: 0x5cb85c }); 
    const matCaminho = new THREE.MeshStandardMaterial({ color: 0xa87b51 }); 
    const matFronteira = new THREE.MeshStandardMaterial({ color: 0x2b5e2b }); 
    const matRelvaAlta = new THREE.MeshStandardMaterial({ color: 0x1b4d1b });
    const matDungeon = new THREE.MeshStandardMaterial({ color: 0x808080 }); 
    const matCasa = new THREE.MeshStandardMaterial({ color: 0xffd700 }); 
    const matPortaPreta = new THREE.MeshStandardMaterial({ color: 0x000000 });

    for (let z = 0; z < mapGrid.length; z++) {
        for (let x = 0; x < mapGrid[z].length; x++) {
            const tileType = mapGrid[z][x];
            let geo, mat, yPos;
            let castShadow = false, receiveShadow = true;

            if (tileType === 0) {
                geo = new THREE.PlaneGeometry(tileSize, tileSize);
                mat = matRelva; yPos = 0;
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
            } else if (tileType === 6) { 
                // Apenas um truque para desenhar a porta na dungeon e nas casas
                if(mapGrid[z][x-1] === 5) {
                    geo = new THREE.BoxGeometry(tileSize, tileSize * 1.5, tileSize);
                    mat = matPortaPreta; yPos = tileSize * 0.75;
                } else {
                    geo = new THREE.BoxGeometry(tileSize, tileSize * 2, tileSize);
                    mat = matCasa; yPos = tileSize; castShadow = true;
                }
            }

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x * tileSize, yPos, z * tileSize);
            if (geo.type === 'PlaneGeometry') mesh.rotation.x = -Math.PI / 2;

            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            scene.add(mesh);
        }
    }
}

export function verificaColisao(futuroX, futuroZ) {
    const gridX = Math.round(futuroX / tileSize);
    const gridZ = Math.round(futuroZ / tileSize);

    if (gridZ < 0 || gridZ >= mapGrid.length || gridX < 0 || gridX >= mapGrid[0].length) return true; 

    const tipoDeBloco = mapGrid[gridZ][gridX];
    // Bloqueia fronteiras(2), casas(6) e dungeon(5)
    if (tipoDeBloco === 2 || tipoDeBloco === 5 || tipoDeBloco === 6) return true; 
    return false; 
}