import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Bau } from './bau.js';

export const lojaScene = new THREE.Scene();
lojaScene.background = new THREE.Color(0x1a120a);

// ---- iluminação interior ----
const ambient = new THREE.AmbientLight(0xffffff, 0.3);
lojaScene.add(ambient);

// Spot principal — ilumina o centro do piso térreo
const spot1 = new THREE.SpotLight(0xfff5e0, 80, 20, Math.PI * 0.35, 0.4, 1.5);
spot1.position.set(0, 9, 1);
spot1.target.position.set(0, 0, 1);
spot1.castShadow = true;
lojaScene.add(spot1, spot1.target);

// Spot secundário — ilumina a zona do balcão/fundo
const spot2 = new THREE.SpotLight(0xfff5e0, 60, 16, Math.PI * 0.3, 0.4, 1.5);
spot2.position.set(0, 9, -3);
spot2.target.position.set(0, 0, -3);
spot2.castShadow = true;
lojaScene.add(spot2, spot2.target);

// Spot para o piso superior
const spot3 = new THREE.SpotLight(0xfff5e0, 40, 12, Math.PI * 0.35, 0.5, 1.5);
spot3.position.set(-4, 8, -2);
spot3.target.position.set(-4, 4, -2);
lojaScene.add(spot3, spot3.target);

// ---- carregamento do modelo ----
const loader = new GLTFLoader();
export let shopModel = null;
export let lojaColliders = [];

loader.load('../../assets/models/constructions/shop_interior.glb', (gltf) => {
    shopModel = gltf.scene;
    shopModel.position.set(0, 0, 0);
    shopModel.scale.setScalar(1.0); 

    shopModel.traverse(c => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            if (c.material) {
                c.material.side = THREE.DoubleSide;
                if (c.material.metalness !== undefined) c.material.metalness = 0.1;
                if (c.material.roughness !== undefined) c.material.roughness = 0.8;
                c.material.needsUpdate = true;
            }
        }
    });

    console.log(`[Loja] shop_interior.glb carregado.`);

    lojaScene.add(shopModel);
}, undefined, e => console.error('Erro shop_interior GLB:', e));

// ---- Mercador ----
export const MERCHANT_POS = new THREE.Vector3(-2.21, 0.81, -0.76);
export let merchantModel = null;
let _merchantBox = null;

loader.load('../../assets/models/npcs/merchant.glb', (gltf) => {
    merchantModel = gltf.scene;
    // X/Z um pouco maiores que Y para dar volume sem aumentar a altura
    merchantModel.scale.set(0.055, 0.035, 0.055);
    merchantModel.position.copy(MERCHANT_POS);
    merchantModel.rotation.y = 0;
    merchantModel.traverse(c => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
    lojaScene.add(merchantModel);

    // caixa de interação à volta do mercador
    _merchantBox = new THREE.Box3(
        new THREE.Vector3(MERCHANT_POS.x - 2.0, MERCHANT_POS.y - 0.5, MERCHANT_POS.z - 2.2),
        new THREE.Vector3(MERCHANT_POS.x + 2.0, MERCHANT_POS.y + 2.2, MERCHANT_POS.z + 2.2),
    );
}, undefined, e => console.error('Erro merchant GLB:', e));

export function getMerchantInteractBox() { return _merchantBox; }

export function updateMerchant(_dt, playerPos) {
    if (!merchantModel) return;
    // ligeira oscilação
    merchantModel.position.y = MERCHANT_POS.y + Math.sin(performance.now() * 0.002) * 0.02;
    // virar-se para o jogador quando perto
    if (playerPos) {
        const dx = playerPos.x - MERCHANT_POS.x;
        const dz = playerPos.z - MERCHANT_POS.z;
        if (dx * dx + dz * dz < 9) {
            const target = Math.atan2(dx, dz);
            let diff = target - merchantModel.rotation.y;
            while (diff > Math.PI)  diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            merchantModel.rotation.y += diff * 0.08;
        }
    }
}

// ---- parâmetros de movimento ----
export const LOJA_FLOOR_Y = 0.0;     
const RAY_START_Y = 10;              
export const STEP_MAX = 0.30;        
const DROP_MAX = 1.2;                

// Mantido por compatibilidade com o moderator (visualização) — vazio agora.
export const stairsZones = [];

// ---- zonas explicitamente bloqueadas ----
export const blockedZones = [
    // Parede de entrada (sul) — lado ESQUERDO da porta
    new THREE.Box3(
        new THREE.Vector3(-6.5, -1, 4.0),
        new THREE.Vector3(-1.5, 10, 6.5)
    ),
    // Parede de entrada (sul) — lado DIREITO da porta
    new THREE.Box3(
        new THREE.Vector3( 1.5, -1, 4.0),
        new THREE.Vector3( 6.5, 10, 6.5)
    ),
    // Parede OESTE — NORTE do corredor (atrás dele)
    new THREE.Box3(
        new THREE.Vector3(-6.5, -1, -5.5),
        new THREE.Vector3(-4.0, 10, -4.4)
    ),
    // Parede OESTE — SUL do corredor (à frente dele)
    new THREE.Box3(
        new THREE.Vector3(-6.5, -1, -2.5),
        new THREE.Vector3(-4.0, 10,  4.0)
    ),
];

// ---- zonas de altura fixa ----
export const fixedHeightZones = [
    // Ponte superior
    {
        box: new THREE.Box3(
            new THREE.Vector3(-5.5, -1, -4.4),
            new THREE.Vector3( 1.6, 10, -2.5)
        ),
        y: 4.0,
    },
    // Corredor oeste — NORTE
    {
        box: new THREE.Box3(
            new THREE.Vector3(-5.5, -1, -3.92),
            new THREE.Vector3(-4.0, 10, -1.19)
        ),
        y: 4.0,
    },
    // Corredor oeste — SUL
    {
        box: new THREE.Box3(
            new THREE.Vector3(-5.5,  -1, -1.19),
            new THREE.Vector3(-4.44, 10,  4.0)
        ),
        y: 4.0,
    },
];

const _tmpVec = new THREE.Vector3();
function _inBlocked(x, z) {
    _tmpVec.set(x, 1, z);
    for (const zone of blockedZones) {
        if (zone.containsPoint(_tmpVec)) return true;
    }
    return false;
}

function _fixedHeightAt(x, z) {
    _tmpVec.set(x, 1, z);
    for (const zone of fixedHeightZones) {
        if (zone.box.containsPoint(_tmpVec)) return zone.y;
    }
    return null;
}

const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);

// Devolve o Y da superfície (chão / degrau / balcão) em (x, z), ou null se nada por baixo.
export function getLojaHeight(x, z) {
    const fixedY = _fixedHeightAt(x, z);
    if (fixedY !== null) return fixedY;
    if (!shopModel) return null;
    raycaster.set(new THREE.Vector3(x, RAY_START_Y, z), downVector);
    const hits = raycaster.intersectObject(shopModel, true);
    return hits.length > 0 ? hits[0].point.y : null;
}

// ---- inflação da colisão (corpo do player) ----
const PLAYER_RADIUS = 0.25;   
const PLAYER_TORSO_Y = 0.9;   
const PLAYER_HEAD_Y = 1.55;   
const _wallStart = new THREE.Vector3();
const _wallDir = new THREE.Vector3();
function _wallBetween(cx, cy, cz, nx, nz) {
    if (!shopModel) return false;
    const dx = nx - cx;
    const dz = nz - cz;
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return false;
    _wallDir.set(dx / len, 0, dz / len);
    const probeYs = [PLAYER_TORSO_Y, PLAYER_HEAD_Y];
    for (const py of probeYs) {
        _wallStart.set(cx, cy + py, cz);
        raycaster.set(_wallStart, _wallDir);
        raycaster.far = len + PLAYER_RADIUS;
        const hits = raycaster.intersectObject(shopModel, true);
        if (hits.length > 0) {
            raycaster.far = Infinity;
            return true;
        }
    }
    raycaster.far = Infinity;
    return false;
}

// Tenta um passo de (currentX, currentY, currentZ) para (nextX, nextZ).
const _solidBoxes3D = [
    // Parede norte da ponte
    new THREE.Box3(new THREE.Vector3(-4, 3.0, -4.5), new THREE.Vector3(1.7, 6.0, -4.0)),
    // Parede sul da ponte
    new THREE.Box3(new THREE.Vector3(-4, 3.0, -2.5), new THREE.Vector3(1.7, 6.0, -2.0)),
    // Tapa o buraco no canto leste da ponte
    new THREE.Box3(new THREE.Vector3(-4.6, 2.5, -2.6), new THREE.Vector3(-3.4, 6.0, -1.0)),
    // Colisão tamanho player em X=0.65, Z=-0.68
    new THREE.Box3(new THREE.Vector3(0.40, 0.0, -0.93), new THREE.Vector3(1.10, 3.0, -0.43)),
    // Parede lateral da escada
    new THREE.Box3(new THREE.Vector3(1.26, 0.0, -1.75), new THREE.Vector3(1.50, 3.0, -0.31)),
];

// Devolve o Y do destino se for atravessável, ou null se bloqueado.
const _pb = new THREE.Box3();
export function tryMoveLoja(currentY, nextX, nextZ, currentX = nextX, currentZ = nextZ) {
    _pb.set(
        new THREE.Vector3(nextX - 0.25, currentY,        nextZ - 0.25),
        new THREE.Vector3(nextX + 0.25, currentY + 1.70, nextZ + 0.25)
    );
    const _chestBox = _bauLoja.getColliderBox();
    if (_chestBox && _pb.intersectsBox(_chestBox)) return null;
    for (const box of _solidBoxes3D) {
        if (_pb.intersectsBox(box)) return null;
    }

    if (_wallBetween(currentX, currentY, currentZ, nextX, nextZ)) return null;

    const fixedY = _fixedHeightAt(nextX, nextZ);
    if (fixedY !== null) {
        const dy = fixedY - currentY;
        if (-dy > DROP_MAX) return null;
        if (dy > STEP_MAX) return null;
        return fixedY;
    }
    if (_inBlocked(nextX, nextZ)) return null;
    const targetY = getLojaHeight(nextX, nextZ);
    if (targetY === null) return null;
    const dy = targetY - currentY;
    if (-dy > DROP_MAX) return null;
    if (dy > STEP_MAX) return null;
    return targetY;
}

// ---- zona de saída (Box3 para deteção) ----
export const lojaSaidaBox = new THREE.Box3(
    new THREE.Vector3(-1.5, 0, 4.5),
    new THREE.Vector3( 1.5, 2, 6.0)
);

// ---- posição inicial do jogador na loja ----
export const lojaSpawnPos = new THREE.Vector3(0, LOJA_FLOOR_Y, 4);

// ---- baú escondido no piso superior ----
const _bauLoja = new Bau(lojaScene, -5.0, 4.00, -1.54, 'pocao', Math.PI);

export function getBauLojaInteractBox()   { return _bauLoja.getInteractBox(); }
export function bauLojaJaAberto()         { return _bauLoja.jaAberto(); }
export function bauLojaJaColetado()       { return _bauLoja.jaColetado(); }
export function abrirBauLoja()            { return _bauLoja.abrir(); }
export function coletarBauLoja()          { return _bauLoja.coletar(); }
export function updateBauLoja(dt)         { _bauLoja.update(dt); }
