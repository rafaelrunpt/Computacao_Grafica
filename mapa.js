import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

export const mapBounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };

const colliders = [];
let bridgePassage = null;
export const grassZones = [];
export let shopDoorInteract = null;
export let riverMesh = null;

// ---- materiais reutilizáveis ----
const matGrass    = new THREE.MeshStandardMaterial({ color: 0x4a7c3f });

const matWater = new THREE.MeshStandardMaterial({ 
    color: 0x1ca3ec,         // Azul vibrante
    emissive: 0x004488,      // Brilho de fundo azul escuro
    emissiveIntensity: 0.4,
    roughness: 0.1,          
    metalness: 0.1,
    transparent: true,       
    opacity: 0.95,           
    flatShading: true        // Isto cria o efeito de facetas
});

const matSand     = new THREE.MeshStandardMaterial({ color: 0xc8b060, roughness: 0.9 });
const matTrunk    = new THREE.MeshStandardMaterial({ color: 0x5c3d1e });
const matLeaves   = new THREE.MeshStandardMaterial({ color: 0x2d6a1f });
const matWood     = new THREE.MeshStandardMaterial({ color: 0x8b6340 });
const matRailing  = new THREE.MeshStandardMaterial({ color: 0x5c3d1e });
const matPath     = new THREE.MeshStandardMaterial({ color: 0xb8965a, roughness: 0.95 });
const matRock     = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });

function addCollider(box, isRiver = false) {
    colliders.push({ box, isRiver });
}

function makeBox(w, h, d, mat, x, y, z, scene, solid = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) {
        const box = new THREE.Box3().setFromObject(mesh);
        addCollider(box);
    }
    return mesh;
}

// ---- árvore ----
function criarArvore(scene, x, z) {
    const trunkH = 1.8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, trunkH, 6), matTrunk);
    trunk.position.set(x, trunkH / 2, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 6), matLeaves);
    leaves.position.set(x, trunkH + 0.7, z);
    leaves.castShadow = true;
    scene.add(leaves);

    // hitbox só do tronco
    const hb = new THREE.Box3(
        new THREE.Vector3(x - 0.3, 0, z - 0.3),
        new THREE.Vector3(x + 0.3, trunkH, z + 0.3)
    );
    addCollider(hb);
}

// ---- SHOP 3D ----
function criarShop(scene, cx, cz) {
    const loader = new GLTFLoader();
    const modeloPath = './assets/shop.glb'; 

    // A tua escala perfeita para o visual
    const escalaVisual = 0.08; 

    const posX = cx - 4;
    const posZ = cz;+1;

    loader.load(modeloPath, function (gltf) {
        const shopModel = gltf.scene;
        
        // Posição ajustada
        shopModel.position.set(posX , 0, posZ);
        
        // Aplica a escala APENAS ao modelo 3D
        shopModel.scale.set(escalaVisual, escalaVisual, escalaVisual); 

        // Roda a loja 90 graus para a porta ficar a apontar para a direita (+X)
        shopModel.rotation.y = Math.PI / 2; 

        // Ativar sombras
        shopModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(shopModel);
    }, undefined, function (error) {
        console.error('Erro ao carregar o modelo da loja:', error);
    });

    // --- HITBOX INVISÍVEL (O teu Colisor real) ---
    const hitboxX = 6.5; // Largura do colisor
    const hitboxZ = 8.0; // Profundidade do colisor
    const hitboxH = 4.0; // Altura
    
    // Caixa invisível para barrar o jogador
    const matInvisivel = new THREE.MeshBasicMaterial({ visible: false });
    makeBox(hitboxX, hitboxH, hitboxZ, matInvisivel, posX, hitboxH / 2, posZ, scene, true);

    // --- ZONA DE INTERAÇÃO DA PORTA ---
    // A porta aponta para a direita (+X), por isso a interação fica nesse lado
    shopDoorInteract = new THREE.Box3(
        new THREE.Vector3(posX + (hitboxX / 2) - 0.5, 0, posZ - 2),          
        new THREE.Vector3(posX + (hitboxX / 2) + 3.0, 3.0, posZ + 2)         
    );
}

// ---- rio + margens + ponte ----
function criarRio(scene) {
    const RW = 6;    
    const RL = 110;  
    const RZ = 0;    

    // GEOMETRIA DA ÁGUA ATUALIZADA (Mais subdivisões = ondas mais suaves)
    const riverGeo = new THREE.PlaneGeometry(RL, RW, 60, 10); 
    
    riverMesh = new THREE.Mesh(riverGeo, matWater);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(0, 0.05, RZ);
    riverMesh.receiveShadow = true;
    scene.add(riverMesh);

    // margens de areia
    [-1, 1].forEach(side => {
        const sand = new THREE.Mesh(new THREE.PlaneGeometry(RL, 1.5), matSand);
        sand.rotation.x = -Math.PI / 2;
        sand.position.set(0, 0.02, RZ + side * (RW / 2 + 0.75));
        sand.receiveShadow = true;
        scene.add(sand);
    });

    // colisores do rio (dois blocos, um de cada margem)
    const riverBoxN = new THREE.Box3(
        new THREE.Vector3(-RL / 2, -1, RZ - RW / 2),
        new THREE.Vector3(RL / 2, 2, RZ + RW / 2)
    );
    addCollider(riverBoxN, true);

    // ponte
    const BX = 0;   // centro X da ponte
    const BW = 3.5; // largura da ponte
    const BL = RW + 1;

    // tábuas
    makeBox(BW, 0.2, BL, matWood, BX, 0.2, RZ, scene, false);

    // guardas
    [-1, 1].forEach(side => {
        makeBox(BW * 0.05, 0.6, BL, matRailing, BX + side * (BW / 2 - 0.1), 0.6, RZ, scene, false);
        for (let i = -2; i <= 2; i++) {
            makeBox(0.12, 0.7, 0.12, matRailing, BX + side * (BW / 2 - 0.1), 0.55, RZ + i * (BL / 4.5), scene, false);
        }
    });

    // passagem da ponte (zona onde o rio não bloqueia)
    bridgePassage = new THREE.Box3(
        new THREE.Vector3(BX - BW / 2, -1, RZ - BL / 2),
        new THREE.Vector3(BX + BW / 2, 3, RZ + BL / 2)
    );
}

// ---- terreno base ----
function criarTerreno(scene) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), matGrass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // caminho vertical (liga norte/sul atravessando a ponte)
    makeBox(3.5, 0.03, 100, matPath, 0, 0.01, 0, scene, false);
    // caminho horizontal (liga loja)
    makeBox(30, 0.03, 3, matPath, -10, 0.01, 25, scene, false);

    // zona de relva esquerda — exclui área da loja (cx=-18, cz=25, margem=8 → X: -26 a -10, Z: 17 a 33)
    grassZones.push(new THREE.Box3(new THREE.Vector3(-45, 0,  5), new THREE.Vector3(-27, 1, 45))); // longe da loja
    grassZones.push(new THREE.Box3(new THREE.Vector3(-45, 0,  5), new THREE.Vector3(-8,  1, 16))); // sul da loja
    grassZones.push(new THREE.Box3(new THREE.Vector3(-45, 0, 34), new THREE.Vector3(-8,  1, 45))); // norte da loja
    grassZones.push(new THREE.Box3(new THREE.Vector3( -9, 0, 34), new THREE.Vector3(-8,  1, 45))); // margem dir loja
    // zona de relva direita
    grassZones.push(new THREE.Box3(new THREE.Vector3(8, 0, 5), new THREE.Vector3(45, 1, 45)));
}

// ---- rochas decorativas ----
function criarRocha(scene, x, z, r = 0.6) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), matRock);
    rock.position.set(x, r * 0.5, z);
    rock.rotation.y = Math.random() * Math.PI;
    rock.castShadow = true;
    scene.add(rock);
    const hb = new THREE.Box3().setFromObject(rock);
    addCollider(hb);
}

// zona livre de obstáculos (loja + área à volta)
const SHOP_CX = -18, SHOP_CZ = 25;
function zonaLivre(x, z, margem = 7) {
    return Math.abs(x - SHOP_CX) < margem && Math.abs(z - SHOP_CZ) < margem;
}
// zona do caminho central e ponte (faixa X estreita)
function naFaixaCaminho(x) {
    return Math.abs(x) < 3;
}

// gerador pseudo-aleatório determinístico (evita posições diferentes a cada reload)
function seededRand(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export function criarMapa(scene) {
    criarTerreno(scene);
    criarRio(scene);
    criarShop(scene, SHOP_CX, SHOP_CZ);

    const rand = seededRand(42);

    // árvores — distribuição aleatória em toda a área, evitando zonas proibidas
    const arvoresTentativas = 80;
    let arvoresColocadas = 0;
    for (let i = 0; i < arvoresTentativas && arvoresColocadas < 55; i++) {
        const x = (rand() * 2 - 1) * 46;
        const z = (rand() * 2 - 1) * 46;
        // não colocar na faixa do caminho, no rio, nem perto da loja
        if (naFaixaCaminho(x)) continue;
        if (z > -4 && z < 4) continue;      // margem do rio
        if (zonaLivre(x, z, 8)) continue;
        arvoresColocadas++;
        criarArvore(scene, x, z);
    }

    // rochas — espalhadas pelo mapa, longe da loja e do caminho
    const rochasTentativas = 40;
    let rochasColocadas = 0;
    for (let i = 0; i < rochasTentativas && rochasColocadas < 18; i++) {
        const x = (rand() * 2 - 1) * 44;
        const z = (rand() * 2 - 1) * 44;
        if (naFaixaCaminho(x)) continue;
        if (z > -5 && z < 5) continue;
        if (zonaLivre(x, z, 9)) continue;
        const r = 0.3 + rand() * 0.5;
        rochasColocadas++;
        criarRocha(scene, x, z, r);
    }

    console.log(`Mapa criado: ${arvoresColocadas} árvores, ${rochasColocadas} rochas.`);
}

export function verificaColisao(futuroX, futuroZ) {
    if (futuroX < mapBounds.minX || futuroX > mapBounds.maxX ||
        futuroZ < mapBounds.minZ || futuroZ > mapBounds.maxZ) {
        return true;
    }

    const playerRadius = 0.25;
    const playerBox = new THREE.Box3(
        new THREE.Vector3(futuroX - playerRadius, 0, futuroZ - playerRadius),
        new THREE.Vector3(futuroX + playerRadius, 1.7, futuroZ + playerRadius)
    );

    for (const collider of colliders) {
        if (!playerBox.intersectsBox(collider.box)) continue;
        if (collider.isRiver) {
            const pt = new THREE.Vector3(futuroX, 0, futuroZ);
            if (bridgePassage && bridgePassage.containsPoint(pt)) continue;
        }
        return true;
    }
    return false;
}