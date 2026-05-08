import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ---- dimensões da sala do boss ----
const W = 22;   // largura
const D = 20;   // profundidade
const H = 8;    // pé-direito

export const caseloScene = new THREE.Scene();
caseloScene.background = new THREE.Color(0x0d0818);

// ---- iluminação ----
// ambient suficiente para ver tudo, com tinge roxo/azul
const ambient = new THREE.AmbientLight(0x8866cc, 1.4);
caseloScene.add(ambient);

// luz direcional suave de cima para iluminar o chão e paredes
const topLight = new THREE.DirectionalLight(0xaaaaff, 0.8);
topLight.position.set(0, 20, 0);
caseloScene.add(topLight);

// luz central avermelhada — o boss
const bossLight = new THREE.PointLight(0xff2200, 5, 40);
bossLight.position.set(0, H - 1, -D / 4);
bossLight.castShadow = true;
caseloScene.add(bossLight);

// tochas nas paredes laterais
const tochaPositions = [
    [-W / 2 + 0.8,  H * 0.45,  -D / 4],
    [ W / 2 - 0.8,  H * 0.45,  -D / 4],
    [-W / 2 + 0.8,  H * 0.45,   D / 4],
    [ W / 2 - 0.8,  H * 0.45,   D / 4],
];
for (const [tx, ty, tz] of tochaPositions) {
    const flame = new THREE.PointLight(0xff6600, 1.8, 10);
    flame.position.set(tx, ty, tz);
    caseloScene.add(flame);

    const torchBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c3d1e })
    );
    torchBody.position.set(tx, ty - 0.3, tz);
    caseloScene.add(torchBody);

    const fire = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.3, 6),
        new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 2 })
    );
    fire.position.set(tx, ty + 0.05, tz);
    caseloScene.add(fire);
}

// ---- materiais ----
const matStone    = new THREE.MeshStandardMaterial({ color: 0x55506a, roughness: 0.9, flatShading: true });
const matStoneDark= new THREE.MeshStandardMaterial({ color: 0x3a3550, roughness: 0.9, flatShading: true });
const matFloor    = new THREE.MeshStandardMaterial({ color: 0x3a3448, roughness: 0.95 });
const matCarpet   = new THREE.MeshStandardMaterial({ color: 0x7a1515, roughness: 1.0 });
const matPillar   = new THREE.MeshStandardMaterial({ color: 0x4a4560, roughness: 0.85, flatShading: true });
const matChain    = new THREE.MeshStandardMaterial({ color: 0x888090, metalness: 0.8, roughness: 0.4 });
const matAltar    = new THREE.MeshStandardMaterial({ color: 0x2a1245, roughness: 0.8 });
const matRune     = new THREE.MeshStandardMaterial({ color: 0xaa44ff, emissive: 0x8800cc, emissiveIntensity: 1.8 });


function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    caseloScene.add(m);
    return m;
}

// ---- chão com lajes ----
box(W, 0.12, D, matFloor, 0, 0, 0);
// tapete central com runas
box(W * 0.25, 0.02, D * 0.7, matCarpet, 0, 0.07, 0);

// runas no chão (esferas achatadas emissivas)
const runePos = [
    [0, -D * 0.28], [0, D * 0.28],
    [-W * 0.1, 0],  [W * 0.1, 0],
    [-W * 0.08, -D * 0.18], [W * 0.08, -D * 0.18],
];
for (const [rx, rz] of runePos) {
    const rune = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.04, 8),
        matRune
    );
    rune.position.set(rx, 0.1, rz);
    caseloScene.add(rune);
}

// ---- paredes ----
// fundo (norte)
box(W, H, 0.6, matStone,  0, H / 2, -D / 2);
// lateral esquerda
box(0.6, H, D, matStone, -W / 2, H / 2, 0);
// lateral direita
box(0.6, H, D, matStone,  W / 2, H / 2, 0);
// parede sul — sem malhas visuais; colisores em caseloColliders mantêm o gap da porta

// ---- pilares nos cantos interiores ----
const pillarX = [-W / 2 + 1.5,  W / 2 - 1.5];
const pillarZ = [-D / 2 + 1.5,  D / 2 - 1.5];
for (const px of pillarX) {
    for (const pz of pillarZ) {
        // fuste
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.6, H, 8),
            matPillar
        );
        pillar.position.set(px, H / 2, pz);
        pillar.castShadow = true;
        caseloScene.add(pillar);
        // capitel
        box(1.3, 0.4, 1.3, matStoneDark, px, H - 0.2, pz);
        // base
        box(1.3, 0.4, 1.3, matStoneDark, px, 0.2, pz);
    }
}

// ---- altar do boss (fundo) ----
// plataforma escalonada
box(6, 0.5, 4, matAltar,  0, 0.25, -D / 2 + 3.5);
box(4.5, 0.5, 3, matAltar, 0, 0.75, -D / 2 + 3.2);
box(3, 0.5, 2.2, matAltar, 0, 1.25, -D / 2 + 3.0);

// cristal maligno no topo do altar
const crystalGeo = new THREE.OctahedronGeometry(0.7, 0);
const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x6600aa,
    emissive: 0x4400aa,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.85,
    flatShading: true,
});
const crystal = new THREE.Mesh(crystalGeo, crystalMat);
crystal.position.set(0, 2.2, -D / 2 + 3.0);
crystal.rotation.y = Math.PI / 4;
caseloScene.add(crystal);
export const bossCrystal = crystal; // animado no main.js

// correntes decorativas nas paredes
for (const cx of [-W / 2 + 1.5, W / 2 - 1.5]) {
    for (let ci = 0; ci < 3; ci++) {
        box(0.08, 0.5, 0.08, matChain, cx, 1.5 + ci * 0.6, -D / 4);
    }
}

// ---- zona de saída (perto da entrada) ----
export const caseloSaidaBox = new THREE.Box3(
    new THREE.Vector3(-2.2, 0,  D / 2 - 1.5),
    new THREE.Vector3( 2.2, 3,  D / 2 + 0.5)
);

// ---- colisores interiores ----
export const caseloColliders = [
    // paredes
    new THREE.Box3(new THREE.Vector3(-W/2-0.1, 0, -D/2-0.1), new THREE.Vector3(-W/2+0.7, H, D/2+0.1)),
    new THREE.Box3(new THREE.Vector3( W/2-0.7, 0, -D/2-0.1), new THREE.Vector3( W/2+0.1, H, D/2+0.1)),
    new THREE.Box3(new THREE.Vector3(-W/2, 0, -D/2-0.1),     new THREE.Vector3( W/2, H, -D/2+0.7)),
    // parede sul: gap central para a porta — saída só via interação E (caseloSaidaBox)
    new THREE.Box3(new THREE.Vector3(-W/2, 0, D/2-0.6),      new THREE.Vector3(-2.3, H, D/2+0.1)),
    new THREE.Box3(new THREE.Vector3( 2.3, 0, D/2-0.6),      new THREE.Vector3( W/2, H, D/2+0.1)),
    // altar
    new THREE.Box3(new THREE.Vector3(-3.1, 0, -D/2+1.5),     new THREE.Vector3( 3.1, 2, -D/2+5.5)),
    // pilares
    new THREE.Box3(new THREE.Vector3(-W/2+0.8, 0, -D/2+0.8), new THREE.Vector3(-W/2+2.2, H, -D/2+2.2)),
    new THREE.Box3(new THREE.Vector3( W/2-2.2, 0, -D/2+0.8), new THREE.Vector3( W/2-0.8, H, -D/2+2.2)),
    new THREE.Box3(new THREE.Vector3(-W/2+0.8, 0,  D/2-2.2), new THREE.Vector3(-W/2+2.2, H,  D/2-0.8)),
    new THREE.Box3(new THREE.Vector3( W/2-2.2, 0,  D/2-2.2), new THREE.Vector3( W/2-0.8, H,  D/2-0.8)),
];

// ---- posição de spawn dentro do castelo ----
export const caseloSpawnPos = new THREE.Vector3(0, 0, D / 2 - 1.3);

// ---- minimapa ortográfico ----
export const caseloMiniCam = new THREE.OrthographicCamera(
    -W / 2 - 1,  W / 2 + 1,
     D / 2 + 1, -D / 2 - 1,
    0.1, 60
);
caseloMiniCam.position.set(0, 25, 0);
caseloMiniCam.lookAt(0, 0, 0);
