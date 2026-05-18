// Cenário interior da Taverna (Gobble Inn).
// Mínimo funcional: cena + GLB + iluminação + raycast de chão + Box3 de saída.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { criarBartender, updateBartender, bartenderIntroFeita as _bartenderIntroFeita, marcarBartenderIntroFeita as _marcarBartenderIntroFeita } from '../entities/bartender.js';
import { criarEstalajadeiro, updateEstalajadeiro } from '../entities/estalajadeiro.js';

export const tavernScene = new THREE.Scene();
tavernScene.background = new THREE.Color(0x120e08);

// Luz ambiente ténue para visibilidade geral (não tão clara)
tavernScene.add(new THREE.AmbientLight(0xffffff, 0.08));

// Material comum para as chamas
const matFlame = new THREE.MeshStandardMaterial({ 
    color: 0xffaa44, 
    emissive: 0xff6622, 
    emissiveIntensity: 3.0,
    transparent: true,
    opacity: 0.85
});

// ---- Tocha na parede (Segunda Chama + Luz) ----
const torchFlame2 = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.32, 8), matFlame);
torchFlame2.position.set(-9.48, 2.65, 2.00);
tavernScene.add(torchFlame2);

const torchLight2 = new THREE.PointLight(0xff8a44, 40, 12, 1.4);
torchLight2.position.set(-9.48, 2.75, 2.00);
torchLight2.castShadow = true;
torchLight2.shadow.mapSize.set(512, 512);
torchLight2.shadow.bias = -0.005;
tavernScene.add(torchLight2);

// ---- Tocha na parede (Terceira Chama + Luz) ----
const torchFlame3 = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.32, 8), matFlame);
torchFlame3.position.set(-10.51, 2.65, 1.99);
tavernScene.add(torchFlame3);

const torchLight3 = new THREE.PointLight(0xff8a44, 40, 12, 1.4);
torchLight3.position.set(-10.51, 2.75, 1.99);
torchLight3.castShadow = true;
torchLight3.shadow.mapSize.set(512, 512);
torchLight3.shadow.bias = -0.005;
tavernScene.add(torchLight3);

// ---- modelo ----
const loader = new GLTFLoader();
export let tavernModel = null;

loader.load('assets/models/constructions/medieval_tavern_interior.glb', (gltf) => {
    tavernModel = gltf.scene;
    tavernModel.position.set(0, 0, 0);
    tavernModel.scale.setScalar(1.0);
    tavernModel.traverse(c => {
        // Remover TODAS as luzes que vêm no ficheiro GLB
        if (c.isLight) {
            c.intensity = 0;
            c.visible = false;
            if (c.parent) c.parent.remove(c);
        }
        
        // Remover objetos físicos de velas/tochas originais pelo nome
        const name = c.name.toLowerCase();
        if (name.includes('candle') || name.includes('vela') || name.includes('torch') || name.includes('lamp')) {
            c.visible = false;
            if (c.isMesh) {
                c.geometry?.dispose();
                if (c.material) {
                    if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                    else c.material.dispose();
                }
            }
        }

        if (c.isMesh && c.visible) {
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
    console.log('[Taverna] medieval_tavern_interior.glb carregado sem luzes internas.');
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

// ---- Box3 de saída (Porta em X: -5.04, Z: 9.62) ----
export const tavernSaidaBox = new THREE.Box3(
    new THREE.Vector3(-6.5, 0, 8.5),
    new THREE.Vector3(-3.5, 3, 10.5),
);

// ---- zona de interacção com o estalajadeiro (atrás do balcão) ----
// O balcão na cena do GLB fica em x ~4..6, z ~-1..1. Posicionamos a
// caixa em frente ao balcão para o jogador se aproximar.
export const tavernBarmanBox = new THREE.Box3(
    new THREE.Vector3(2.5, 0, -1.5),
    new THREE.Vector3(5.5, 3,  1.5),
);
export const tavernBarmanPos = new THREE.Vector3(4.5, 0, 0);

// ---- posição inicial do jogador na taverna (ajustada para perto da nova porta) ----
export const tavernSpawnPos = new THREE.Vector3(-5.0, 0, 8.0);

// ----------------------------------------------------------------------
// NPCs goblin (entidades em src/entities/) — Estalajadeiro + Bartender
// ----------------------------------------------------------------------
const BARTENDER_DOOR_POS   = new THREE.Vector3(5.27, 0, 5.8);
const BARTENDER_VENDOR_POS = new THREE.Vector3(-6.38, 0, -7.46);

export function bartenderIntroFeita() { return _bartenderIntroFeita(); }
export function marcarBartenderIntroFeita() { _marcarBartenderIntroFeita(); }

// caixas de interacção (continuam ligadas ao layout da cena)
export const bartenderIntroBox = new THREE.Box3(
    new THREE.Vector3(4.4, 0, 4.8),
    new THREE.Vector3(6.1, 3, 6.6),
);
export let bartenderVendorBox = new THREE.Box3(
    new THREE.Vector3(-5.77 - 1.0, 0, -4.54 - 1.0),
    new THREE.Vector3(-5.77 + 1.0, 2.4, -4.54 + 1.0),
);

criarEstalajadeiro(tavernScene, tavernBarmanPos);
criarBartender(tavernScene, BARTENDER_DOOR_POS, BARTENDER_VENDOR_POS);

export function updateTavernNPCs(dt, playerPos) {
    const t = performance.now() * 0.002;

    // Animação da segunda tocha na parede
    if (torchLight2 && torchFlame2) {
        const flicker2 = Math.sin(t * 14) * 4 + Math.sin(t * 22) * 2;
        torchLight2.intensity = 35 + flicker2;
        const s2 = 0.96 + Math.sin(t * 13) * 0.04;
        torchFlame2.scale.set(s2, 1.0 + Math.sin(t * 11) * 0.12, s2);
        torchFlame2.rotation.y += dt * 1.5;
    }

    // Animação da terceira tocha na parede
    if (torchLight3 && torchFlame3) {
        const flicker3 = Math.sin(t * 10) * 4 + Math.sin(t * 28) * 2;
        torchLight3.intensity = 35 + flicker3;
        const s3 = 0.94 + Math.sin(t * 16) * 0.06;
        torchFlame3.scale.set(s3, 1.0 + Math.sin(t * 12) * 0.14, s3);
        torchFlame3.rotation.y += dt * 1.8;
    }

    updateEstalajadeiro(dt);
    updateBartender(dt, playerPos);
}

// ---- porta para o quarto (X:5.27, Z:4.42) ----
export const quartoEnterBox = new THREE.Box3(
    new THREE.Vector3(4.6, 0, 3.7),
    new THREE.Vector3(5.9, 3, 5.1),
);
// posição de regresso à taverna ao sair do quarto (em frente à porta, virado para sul)
export const tavernQuartoReturnPos = new THREE.Vector3(5.27, 0, 5.2);
