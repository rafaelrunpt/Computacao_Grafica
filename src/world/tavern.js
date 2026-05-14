// Cenário interior da Taverna (Gobble Inn).
// Mínimo funcional: cena + GLB + iluminação + raycast de chão + Box3 de saída.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const tavernScene = new THREE.Scene();
tavernScene.background = new THREE.Color(0x120e08);

// ---- iluminação ----
tavernScene.add(new THREE.AmbientLight(0xffe8c0, 0.35));

const spot1 = new THREE.SpotLight(0xffd9a0, 70, 22, Math.PI * 0.38, 0.4, 1.5);
spot1.position.set(0, 9, 2);
spot1.target.position.set(0, 0, 2);
spot1.castShadow = true;
tavernScene.add(spot1, spot1.target);

const spot2 = new THREE.SpotLight(0xffd9a0, 50, 18, Math.PI * 0.30, 0.4, 1.5);
spot2.position.set(0, 9, -4);
spot2.target.position.set(0, 0, -4);
spot2.castShadow = true;
tavernScene.add(spot2, spot2.target);

// ---- modelo ----
const loader = new GLTFLoader();
export let tavernModel = null;

loader.load('../../assets/models/constructions/medieval_tavern_interior.glb', (gltf) => {
    tavernModel = gltf.scene;
    tavernModel.position.set(0, 0, 0);
    tavernModel.scale.setScalar(1.0);
    tavernModel.traverse(c => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            if (c.material) {
                c.material.side = THREE.DoubleSide;
                if (c.material.metalness !== undefined) c.material.metalness = 0.1;
                if (c.material.roughness !== undefined) c.material.roughness = 0.85;
                c.material.needsUpdate = true;
            }
        }
    });
    tavernScene.add(tavernModel);
    console.log('[Taverna] medieval_tavern_interior.glb carregado.');
}, undefined, e => console.error('Erro tavern GLB:', e));

// ---- movimento / chão ----
export const TAVERN_FLOOR_Y = 0.0;
const RAY_START_Y = 10;
const STEP_MAX   = 0.30;
const DROP_MAX   = 1.2;

const raycaster   = new THREE.Raycaster();
const downVector  = new THREE.Vector3(0, -1, 0);

export function getTavernHeight(x, z) {
    if (!tavernModel) return TAVERN_FLOOR_Y;
    raycaster.set(new THREE.Vector3(x, RAY_START_Y, z), downVector);
    const hits = raycaster.intersectObject(tavernModel, true);
    return hits.length > 0 ? hits[0].point.y : TAVERN_FLOOR_Y;
}

// Versão básica — só verifica altura (sem colisão de parede). Pode ser
// expandida depois com wall-raycast como o loja.js faz.
export function tryMoveTavern(currentY, nextX, nextZ) {
    const targetY = getTavernHeight(nextX, nextZ);
    if (targetY === null) return null;
    const dy = targetY - currentY;
    if (-dy > DROP_MAX) return null;
    if (dy > STEP_MAX)  return null;
    return targetY;
}

// ---- Box3 de saída — ajustar quando souberes a posição da porta no GLB ----
export const tavernSaidaBox = new THREE.Box3(
    new THREE.Vector3(-1.5, 0, 4.0),
    new THREE.Vector3( 1.5, 2, 5.5),
);

// ---- posição inicial do jogador na taverna ----
export const tavernSpawnPos = new THREE.Vector3(0, 0, 3.5);
