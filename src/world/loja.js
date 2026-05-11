import * as THREE from 'three';

// ---- dimensões do interior ----
const W = 14;   // largura
const D = 12;   // profundidade
const H = 4.5;  // pé-direito

export const lojaScene = new THREE.Scene();
lojaScene.background = new THREE.Color(0x1a120a);

// ---- iluminação interior ----
const ambient = new THREE.AmbientLight(0xffd580, 1.2);
lojaScene.add(ambient);

// candeeiros de teto (ponto de luz laranja quente)
const lampPositions = [
    [-W / 4, H - 0.3,  D / 4],
    [ W / 4, H - 0.3,  D / 4],
    [-W / 4, H - 0.3, -D / 4],
    [ W / 4, H - 0.3, -D / 4],
];
for (const [lx, ly, lz] of lampPositions) {
    const pt = new THREE.PointLight(0xffcc66, 4.5, 20);
    pt.position.set(lx, ly, lz);
    pt.castShadow = true;
    lojaScene.add(pt);

    // esfera que representa a lâmpada
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffaa33, emissiveIntensity: 2 })
    );
    bulb.position.set(lx, ly, lz);
    lojaScene.add(bulb);

    // fio do candeeiro
    const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, H - ly, 4),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    wire.position.set(lx, ly + (H - ly) / 2, lz);
    lojaScene.add(wire);
}

// ---- materiais ----
const matFloor   = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
const matWall    = new THREE.MeshStandardMaterial({ color: 0x8b6340, roughness: 0.85 });
const matCeiling = new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 1.0 });
const matShelf   = new THREE.MeshStandardMaterial({ color: 0x6b3f1e, roughness: 0.8 });
const matCounter = new THREE.MeshStandardMaterial({ color: 0x4a2a0e, roughness: 0.7 });
const matItem    = new THREE.MeshStandardMaterial({ color: 0xe8c840, roughness: 0.4, metalness: 0.3 });
const matPotion  = new THREE.MeshStandardMaterial({ color: 0xcc2244, roughness: 0.2, transparent: true, opacity: 0.85 });
const matPotionB = new THREE.MeshStandardMaterial({ color: 0x2244cc, roughness: 0.2, transparent: true, opacity: 0.85 });
const matRug     = new THREE.MeshStandardMaterial({ color: 0x7a2020, roughness: 1.0 });
const matDoor    = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
const matDoorFrame = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.8 });

function box(w, h, d, mat, x, y, z, castShadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    lojaScene.add(m);
    return m;
}

// ---- chão ----
box(W, 0.1, D, matFloor, 0, 0, 0, false);

// tapete central
box(W * 0.45, 0.02, D * 0.5, matRug, 0, 0.06, 0.5, false);

// ---- paredes ----
// parede de fundo (norte, z = -D/2)
box(W, H, 0.2, matWall, 0, H / 2, -D / 2, false);
// parede esquerda
box(0.2, H, D, matWall, -W / 2, H / 2, 0, false);
// parede direita
box(0.2, H, D, matWall,  W / 2, H / 2, 0, false);

// porta (visual — painel de madeira encostado)
box(2.0, 2.7, 0.12, matDoor, 0, 1.35, D / 2 - 0.05);
// marco da porta
box(0.15, 2.9, 0.25, matDoorFrame, -1.1, 1.45, D / 2);
box(0.15, 2.9, 0.25, matDoorFrame,  1.1, 1.45, D / 2);
box(2.4,  0.15, 0.25, matDoorFrame, 0, 2.87, D / 2);

// ---- balcão de atendimento (fundo esquerdo) ----
box(4.5, 1.0, 1.2, matCounter, -W / 2 + 2.5, 0.5, -D / 2 + 1.8);
// tampo do balcão
box(4.7, 0.08, 1.4, matShelf, -W / 2 + 2.5, 1.04, -D / 2 + 1.8);

// ---- prateleiras na parede de fundo ----
const shelfZ = -D / 2 + 0.15;
const shelfHeights = [1.0, 1.7, 2.4];
for (const sy of shelfHeights) {
    // prateleira esquerda
    box(4.5, 0.08, 0.35, matShelf, -W / 2 + 2.5, sy, shelfZ);
    // prateleira direita
    box(4.5, 0.08, 0.35, matShelf,  W / 2 - 2.5, sy, shelfZ);
}
// suportes verticais das prateleiras
for (const sx of [-W / 2 + 0.3, -W / 2 + 4.7,  W / 2 - 0.3,  W / 2 - 4.7]) {
    box(0.08, 2.5, 0.35, matShelf, sx, 1.25, shelfZ);
}

// ---- itens nas prateleiras ----
// poções (cápsulas)
function addPotion(mat, x, y, z) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 8), mat);
    body.position.set(x, y + 0.16, z);
    lojaScene.add(body);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.07, 6), matShelf);
    cork.position.set(x, y + 0.35, z);
    lojaScene.add(cork);
}

// prateleira esquerda
addPotion(matPotion,  -W/2+1.2, 1.0, shelfZ + 0.05);
addPotion(matPotionB, -W/2+1.7, 1.0, shelfZ + 0.05);
addPotion(matPotion,  -W/2+2.2, 1.0, shelfZ + 0.05);
addPotion(matPotionB, -W/2+1.0, 1.7, shelfZ + 0.05);
addPotion(matPotion,  -W/2+1.5, 1.7, shelfZ + 0.05);
addPotion(matPotionB, -W/2+2.0, 1.7, shelfZ + 0.05);
addPotion(matPotion,  -W/2+2.5, 1.7, shelfZ + 0.05);

// itens dourados (esferas) na prateleira esquerda topo
for (let i = 0; i < 4; i++) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), matItem);
    orb.position.set(-W/2 + 0.9 + i * 0.75, 2.45, shelfZ + 0.05);
    lojaScene.add(orb);
}

// prateleira direita
addPotion(matPotion,   W/2-1.2, 1.0, shelfZ + 0.05);
addPotion(matPotionB,  W/2-1.7, 1.0, shelfZ + 0.05);
addPotion(matPotion,   W/2-2.2, 1.0, shelfZ + 0.05);
addPotion(matPotionB,  W/2-1.0, 1.7, shelfZ + 0.05);
addPotion(matPotion,   W/2-1.5, 1.7, shelfZ + 0.05);
addPotion(matPotionB,  W/2-2.0, 1.7, shelfZ + 0.05);

// baús no balcão
for (const bx of [-W/2+1.2, -W/2+2.0, -W/2+3.2]) {
    box(0.5, 0.35, 0.35, matShelf, bx, 1.25, -D/2 + 1.8);
    // tampa do baú
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.35), matCounter);
    lid.position.set(bx, 1.48, -D/2 + 1.8);
    lid.rotation.x = -0.25;
    lojaScene.add(lid);
}

// ---- prateleiras laterais (meio da loja) ----
// prateleira esquerda intermédia
box(0.15, 2.0, 3.0, matShelf, -W/2 + 0.12, 1.0, 0);
box(1.8,  0.08, 2.8, matShelf, -W/2 + 1.1, 0.8, 0);
box(1.8,  0.08, 2.8, matShelf, -W/2 + 1.1, 1.4, 0);

// poções na prateleira lateral
for (let i = 0; i < 3; i++) {
    addPotion(i % 2 === 0 ? matPotion : matPotionB, -W/2 + 0.8, 0.8, -0.8 + i * 0.8);
    addPotion(i % 2 === 0 ? matPotionB : matPotion, -W/2 + 0.8, 1.4, -0.6 + i * 0.8);
}

// ---- zona de saída (Box3 para deteção) ----
export const lojaSaidaBox = new THREE.Box3(
    new THREE.Vector3(-2.0, 0, D / 2 - 1.2), // Mais larga e profunda
    new THREE.Vector3( 2.0, 2, D / 2 + 0.5)
);

// ---- colisores interiores ----
export const lojaColliders = [
    // paredes
    new THREE.Box3(new THREE.Vector3(-W/2-0.1, 0, -D/2-0.1), new THREE.Vector3(-W/2+0.3, H, D/2+0.1)), // esquerda
    new THREE.Box3(new THREE.Vector3( W/2-0.3, 0, -D/2-0.1), new THREE.Vector3( W/2+0.1, H, D/2+0.1)), // direita
    new THREE.Box3(new THREE.Vector3(-W/2, 0, -D/2-0.1),     new THREE.Vector3( W/2, H, -D/2+0.3)),     // fundo
    // parede sul: fechada — saída só via interação E (lojaSaidaBox)
    new THREE.Box3(new THREE.Vector3(-W/2, 0, D/2-0.3),      new THREE.Vector3( W/2, H, D/2+0.1)),
    // balcão
    new THREE.Box3(new THREE.Vector3(-W/2+0.2, 0, -D/2+0.8), new THREE.Vector3(-W/2+4.9, 1.1, -D/2+2.5)),
    // prateleira lateral esquerda
    new THREE.Box3(new THREE.Vector3(-W/2+0.0, 0, -1.6),     new THREE.Vector3(-W/2+2.1, 2.0, 1.6)),
];

// ---- posição inicial do jogador na loja ----
export const lojaSpawnPos = new THREE.Vector3(0, 0, D / 2 - 1.0);
