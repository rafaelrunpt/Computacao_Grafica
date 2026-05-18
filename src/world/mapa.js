import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeTerrainShader, terraTex, matBattleGrass, matContRock, matCorruptHalo } from './shaders.js';
import { criarRio, getBridgePassage } from './rio.js';
import { Bau } from './bau.js';

export { matBattleGrass, matBattleSky, matWater, matContTrunk, matContLeaves, matContRock, matCorruptHalo } from './shaders.js';
export { getBridgeHeight } from './rio.js';

export const mapBounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };

const colliders = [];

// ---- Spatial grid de colisão ----
// Divide o mapa em células de 8×8 unidades. Em vez de testar todos os
// colliders (O(n)), só testamos os da célula em que o jogador está (O(k), k<<n).
const _CELL = 8;
const _grid = new Map();
let _gridDirty = true; // rebuild na próxima verificaColisao

export function invalidateColliderGrid() { _gridDirty = true; }

function _buildGrid() {
    _grid.clear();
    for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i].box;
        const x0 = Math.floor(b.min.x / _CELL), x1 = Math.floor(b.max.x / _CELL);
        const z0 = Math.floor(b.min.z / _CELL), z1 = Math.floor(b.max.z / _CELL);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cz = z0; cz <= z1; cz++) {
                const key = cx * 10000 + cz;
                let bucket = _grid.get(key);
                if (!bucket) { bucket = []; _grid.set(key, bucket); }
                bucket.push(i);
            }
        }
    }
    _gridDirty = false;
}

// Reutilizados em verificaColisao — sem alocações por frame
const _pb = new THREE.Box3();
const _pbMin = new THREE.Vector3();
const _pbMax = new THREE.Vector3();
const _bridgePt = new THREE.Vector3();
export const grassZones = [];       // Box3[] — zonas onde há encontros
export const battleZoneObjects = []; // [{box, meshes[], scene}] — para limpar após vitória
// objectos candidatos a fade-out quando tapam o jogador (assets sólidos — não
// árvores, que podem ficar opacas). Mantido aqui para evitar raycast recursivo
// contra toda a cena no loop principal.
export const fadeables = [];
// objectos para frontal culling — escondidos (visible=false) quando estão
// atrás da câmara, tirando-os do render E do shadow pass. Inclui tudo o que
// é pesado: árvores, rochas, montanhas, GLBs grandes, ponte, guardião.
export const cullables = [];
export let shopDoorInteract = null;
export let guardianInteractBox = null;
let _guardianMesh = null;
let _guardianColliderBox = null;
let _guardianMoving = false;
let _guardianWalkTime = 0;
let _guardianPhase = 0; // 0: idle, 1: rotating to side, 2: walking, 3: rotating to front
let _guardiaoPassou = false;
export function isGuardiaoPassagemConcedida() { return _guardiaoPassou; }

function _atualizarGuardianInteractBoxPos() {
    if (!_guardianMesh) return;
    const p = _guardianMesh.position;
    guardianInteractBox = new THREE.Box3(
        new THREE.Vector3(p.x - 1.4, 0, p.z - 1.4),
        new THREE.Vector3(p.x + 1.4, 2.5, p.z + 1.4)
    );
}

export function updateGuardiao(deltaTime) {
    if (!_guardianMesh || !_guardianMoving) return;

    if (_guardianPhase === 0) _guardianPhase = 1;

    if (_guardianPhase === 1) {
        const targetRot = Math.PI / 2; // Virado para a direita (X+) do ponto de vista do mundo
        let diff = targetRot - _guardianMesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;

        const rotSpeed = 5 * deltaTime;
        if (Math.abs(diff) < rotSpeed) {
            _guardianMesh.rotation.y = targetRot;
            _guardianPhase = 2;
        } else {
            _guardianMesh.rotation.y += Math.sign(diff) * rotSpeed;
        }
    }

    if (_guardianPhase === 2) {
        const targetX = 3.2; // Move para a direita (afasta-se da loja para dar vista)
        const speed = 1.5;

        if (_guardianMesh.position.x < targetX) {
            _guardianMesh.position.x += speed * deltaTime;

            // Animação simples de caminhar
            _guardianWalkTime += deltaTime * 20;
            const amp = 0.5;
            if (_guardianMesh.userData.lLeg) _guardianMesh.userData.lLeg.rotation.x = Math.sin(_guardianWalkTime) * amp;
            if (_guardianMesh.userData.rLeg) _guardianMesh.userData.rLeg.rotation.x = -Math.sin(_guardianWalkTime) * amp;
            if (_guardianMesh.userData.lArm) _guardianMesh.userData.lArm.rotation.x = -Math.sin(_guardianWalkTime) * amp * 0.5;
            if (_guardianMesh.userData.rArm) _guardianMesh.userData.rArm.rotation.x = Math.sin(_guardianWalkTime) * amp * 0.5;
            
            _guardianMesh.position.y = Math.abs(Math.sin(_guardianWalkTime)) * 0.05;
        } else {
            _guardianPhase = 3;
            // Reset poses de pernas
            if (_guardianMesh.userData.lLeg) _guardianMesh.userData.lLeg.rotation.x = 0;
            if (_guardianMesh.userData.rLeg) _guardianMesh.userData.rLeg.rotation.x = 0;
            if (_guardianMesh.userData.lArm) _guardianMesh.userData.lArm.rotation.x = 0;
            if (_guardianMesh.userData.rArm) _guardianMesh.userData.rArm.rotation.x = 0;
            _guardianMesh.position.y = 0;
        }
    }

    if (_guardianPhase === 3) {
        // Alvo: x=3, z=20.
        const targetX = 3;
        const targetZ = 20;
        // Ângulo em relação à frente (Z+)
        const dx = targetX - _guardianMesh.position.x;
        const dz = targetZ - _guardianMesh.position.z;
        const targetRot = Math.atan2(dx, dz); 

        let diff = targetRot - _guardianMesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;

        const rotSpeed = 4 * deltaTime;
        if (Math.abs(diff) < rotSpeed) {
            _guardianMesh.rotation.y = targetRot;
            _guardianMoving = false;
            _guardianPhase = 0;
            _atualizarGuardianInteractBoxPos();
        } else {
            _guardianMesh.rotation.y += Math.sign(diff) * rotSpeed;
        }
    }
}

const matTerrainN = makeTerrainShader(0x9ec87a, 0xd4b882);
const matTerrainS = makeTerrainShader(0x9ec87a, 0xd4b882);

const matRock     = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
const matMountain  = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 1.0, flatShading: true });
const matSnow      = new THREE.MeshStandardMaterial({ color: 0xdde8f0, roughness: 0.8, flatShading: true });

export let castleEnterBox = null;
export let tavernEnterBox = null;

let _bau = null;
export function getBauInteractBox()  { return _bau?.getInteractBox() ?? null; }
export function bauJaAberto()        { return _bau?.jaAberto()       ?? false; }
export function bauJaColetado()      { return _bau?.jaColetado()     ?? false; }
export function abrirBau()           { return _bau?.abrir()          ?? false; }
export function coletarBau()         { return _bau?.coletar()        ?? false; }
export function updateBau(dt)        { _bau?.update(dt); }
export function registarOnBauAbrir(fn) { _bau?.registarOnAbrir(fn); }

// Baú secreto da Máscara do Eclipse — escondido no sudoeste,
// longe das zonas de batalha visíveis, atrás das árvores.
let _bauMascara = null;
export function getBauMascaraInteractBox() { return _bauMascara?.getInteractBox() ?? null; }
export function bauMascaraJaAberto()       { return _bauMascara?.jaAberto()       ?? false; }
export function bauMascaraJaColetado()     { return _bauMascara?.jaColetado()     ?? false; }
export function abrirBauMascara()          { return _bauMascara?.abrir()          ?? false; }
export function coletarBauMascara()        { return _bauMascara?.coletar()        ?? false; }
export function updateBauMascara(dt)       { _bauMascara?.update(dt); }

// ---- utilitários ----
function addCollider(box, isRiver = false) { colliders.push({ box, isRiver }); _gridDirty = true; }

export function removerGuardiao() {
    if (_guardiaoPassou) return;
    if (_guardianColliderBox) {
        const i = colliders.findIndex(c => c.box === _guardianColliderBox);
        if (i !== -1) colliders.splice(i, 1);
        _guardianColliderBox = null;
    }
    _guardiaoPassou = true;
    _guardianMoving = true; // Ativa o movimento para o lado
    // mantém guardianInteractBox para permitir falar com ele depois;
    // a caixa é actualizada para a nova posição quando ele acabar de se mover.
}

function makeBox(w, h, d, mat, x, y, z, scene, solid = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addCollider(new THREE.Box3().setFromObject(mesh));
    return mesh;
}

// cria um segmento de caminho com textura terra repetida proporcionalmente
function makePath(w, d, x, z, scene) {
    const tileSize = 6;
    const t = terraTex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / tileSize, d / tileSize);
    t.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: t, color: 0xd4b882, roughness: 0.95 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), mat);
    mesh.position.set(x, 0.01, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
}

function seededRand(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ---- verifica se ponto está dentro de alguma zona de batalha ----
function emZonaBatalha(x, z) {
    for (const zone of grassZones) {
        if (x >= zone.min.x && x <= zone.max.x && z >= zone.min.z && z <= zone.max.z) return true;
    }
    return false;
}

// devolve o zoneObj (com .trees) que contém (x,z), ou null
function _findZoneAt(x, z, zones) {
    for (const zo of zones) {
        if (!zo) continue;
        if (x >= zo.box.min.x && x <= zo.box.max.x && z >= zo.box.min.z && z <= zo.box.max.z) return zo;
    }
    return null;
}

// ---- árvore GLB ----
let treeTemplate = null;       // THREE.Group clonável, preenchido após o load
const treePendingQueue = [];   // { scene, x, z, contaminada, zoneRef } — aguardam o load

const treeLoader = new GLTFLoader();
treeLoader.load('../../assets/models/ambiente/tree.glb', (gltf) => {
    treeTemplate = gltf.scene;
    for (const p of treePendingQueue) _spawnTree(p.scene, p.x, p.z, p.contaminada, p.zoneRef);
    treePendingQueue.length = 0;
}, undefined, e => console.error('Erro tree.glb:', e));

// coordenadas do castelo — usadas para corrupção progressiva por distância
const CASTLE_CX = 0, CASTLE_CZ = -80, CASTLE_CORRUPT_RADIUS = 78;

function _corruptionStrength(x, z) {
    const dx = x - CASTLE_CX, dz = z - CASTLE_CZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // 0 fora do raio, sobe até 1 no centro do castelo
    return Math.max(0, 1 - dist / CASTLE_CORRUPT_RADIUS);
}

function _spawnTree(scene, x, z, contaminada, zoneRef = null) {
    const tree = treeTemplate.clone(true);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    tree.scale.setScalar(1.5 + Math.random() * 0.25);

    const castleT = _corruptionStrength(x, z);
    const battleT = contaminada ? 0.55 : 0;
    const t = Math.min(1, Math.max(battleT, castleT));

    tree.traverse(c => {
        if (!c.isMesh) return;
        c.castShadow = true;
        c.receiveShadow = true;
        if (t > 0.01) {
            // guardar cor original antes de clonar/modificar
            const origColor = c.material.color.clone();
            c.material = c.material.clone();
            c.material.userData.cleanColor = origColor;
            const darken = 1 - t * 0.72;
            c.material.color.multiplyScalar(darken);
            c.material.color.r += t * 0.10;
            c.material.color.b += t * 0.18;
            if (c.material.emissive) {
                c.material.emissive.setRGB(t * 0.10, 0, t * 0.20);
            } else {
                c.material.emissive = new THREE.Color(t * 0.10, 0, t * 0.20);
            }
            c.material.emissiveIntensity = 0.3 + t * 0.5;
        }
    });
    scene.add(tree);
    cullables.push(tree);
    addCollider(new THREE.Box3(
        new THREE.Vector3(x - 0.3, 0, z - 0.3),
        new THREE.Vector3(x + 0.3, 1.8, z + 0.3)
    ));
    // registar árvore na zona de batalha para poder restaurar depois
    if (zoneRef && contaminada) zoneRef.trees.push(tree);
    return tree;
}

function criarArvore(scene, x, z, contaminada = false, zoneRef = null) {
    if (treeTemplate) {
        _spawnTree(scene, x, z, contaminada, zoneRef);
    } else {
        treePendingQueue.push({ scene, x, z, contaminada, zoneRef });
        addCollider(new THREE.Box3(
            new THREE.Vector3(x - 0.3, 0, z - 0.3),
            new THREE.Vector3(x + 0.3, 1.8, z + 0.3)
        ));
    }
}

// ---- rocha ----
function criarRocha(scene, x, z, r = 0.6, contaminada = false) {
    const mat = contaminada ? matContRock : matRock;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat);
    rock.position.set(x, r * 0.5, z);
    rock.rotation.y = Math.random() * Math.PI;
    rock.castShadow = true;
    scene.add(rock);
    fadeables.push(rock);
    cullables.push(rock);
    addCollider(new THREE.Box3().setFromObject(rock));
}

// ---- zona de batalha ----
// Geometria: PlaneGeometry com bordas distorcidas por ruído → forma orgânica
function criarZonaBatalha(scene, cx, cz, raio, seed) {
    const rand = seededRand(seed);
    const segs = 32; // polígono com 32 segmentos de borda
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const uvs = [];
    const indices = [];

    // ponto central
    verts.push(0, 0, 0);
    uvs.push(0.5, 0.5);

    // pontos da borda — raio variável com ruído
    for (let i = 0; i <= segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        // variação orgânica: entre 60% e 100% do raio
        const r = raio * (0.60 + 0.40 * rand());
        const bx = Math.cos(angle) * r;
        const bz = Math.sin(angle) * r;
        verts.push(bx, 0, bz);
        uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
    }

    // triângulos: centro + cada par de pontos da borda
    for (let i = 1; i <= segs; i++) {
        indices.push(0, i, i + 1 <= segs ? i + 1 : 1);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, matBattleGrass);
    mesh.position.set(cx, 0.04, cz);
    scene.add(mesh);

    const zoneMeshes = [mesh];

    // tufos roxos espalhados dentro da zona
    const nTufos = Math.floor(raio * raio * 0.8);
    for (let i = 0; i < nTufos; i++) {
        const angle = rand() * Math.PI * 2;
        const r2 = rand() * raio * 0.85;
        const tx = cx + Math.cos(angle) * r2;
        const tz = cz + Math.sin(angle) * r2;
        const h  = 0.2 + rand() * 0.25;
        const tufo = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.07, h, 4),
            new THREE.MeshStandardMaterial({
                color: 0x5a0090,
                emissive: 0x3a006a,
                emissiveIntensity: 0.5,
            })
        );
        tufo.position.set(tx, h / 2, tz);
        tufo.rotation.y = rand() * Math.PI;
        scene.add(tufo);
        zoneMeshes.push(tufo);
    }

    // AABB aproximada para deteção de encontros
    const box = new THREE.Box3(
        new THREE.Vector3(cx - raio, 0, cz - raio),
        new THREE.Vector3(cx + raio, 1, cz + raio)
    );
    grassZones.push(box);
    const zoneObj = { box, meshes: zoneMeshes, trees: [], scene };
    battleZoneObjects.push(zoneObj);
    return zoneObj;
}

// ---- zona corrupta (visual roxo, sem encontros) ----
function criarZonaCorrupta(scene, cx, cz, raio, seed) {
    const rand = seededRand(seed);

    // --- halo externo: cobertura escura-roxa que mancha o terreno à volta ---
    const haloR = raio * 2.8;  // raio muito maior que a zona central
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(haloR * 2, haloR * 2), matCorruptHalo);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(cx, 0.03, cz);
    scene.add(halo);

    // --- zona central densa (matBattleGrass original) ---
    const segs = 40;
    const geo = new THREE.BufferGeometry();
    const verts = [], uvs = [], indices = [];

    verts.push(0, 0, 0);
    uvs.push(0.5, 0.5);

    for (let i = 0; i <= segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        const r = raio * (0.72 + 0.28 * rand());
        verts.push(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
    }
    for (let i = 1; i <= segs; i++) {
        indices.push(0, i, i + 1 <= segs ? i + 1 : 1);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, matBattleGrass);
    mesh.position.set(cx, 0.05, cz);
    scene.add(mesh);

    // tufos roxos densos
    const nTufos = Math.floor(raio * raio * 1.2);
    for (let i = 0; i < nTufos; i++) {
        const angle = rand() * Math.PI * 2;
        const r2 = rand() * raio * 0.92;
        const tx = cx + Math.cos(angle) * r2;
        const tz = cz + Math.sin(angle) * r2;
        const h  = 0.2 + rand() * 0.3;
        const tufo = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.08, h, 4),
            new THREE.MeshStandardMaterial({ color: 0x5a0090, emissive: 0x3a006a, emissiveIntensity: 0.6 })
        );
        tufo.position.set(tx, h / 2, tz);
        tufo.rotation.y = rand() * Math.PI;
        scene.add(tufo);
    }
    // sem grassZones.push — não gera encontros
}

// ---- SHOP ----
function criarShop(scene, cx, cz) {
    const loader = new GLTFLoader();
    const posX = cx , posZ = cz;
    loader.load('../../assets/models/constructions/shop.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(posX , 8.95, posZ);
        m.scale.setScalar(0.5);
        m.rotation.y = Math.PI / 0.000001;
        m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(m);
        fadeables.push(m);
        cullables.push(m);
    }, undefined, e => console.error('Erro loja:', e));

    const hx = 6.5, hz = 8.0, hy = 4.0;
    makeBox(hx, hy, hz, new THREE.MeshBasicMaterial({ visible: false }), posX, hy / 2, posZ, scene, true);
    shopDoorInteract = new THREE.Box3(
        new THREE.Vector3(posX + hx / 2 - 0.5, 0, posZ - 2),
        new THREE.Vector3(posX + hx / 2 + 3.0, 3.0, posZ + 2)
    );
}

// ---- INN (Gobble Inn) — segunda construção da vila ----
function criarInn(scene, cx, cz, scale = 0.1, rotationY = 0, yOffset = 0) {
    const loader = new GLTFLoader();
    const posX = cx, posZ = cz;
    loader.load('../../assets/models/constructions/gobble-inn.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(posX, 0, posZ);
        m.scale.setScalar(scale);
        m.rotation.y = rotationY;
        m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

        // alinhar o fundo ao chão e aplicar offset Y opcional (negativo afunda)
        m.updateMatrixWorld(true);
        const bb0 = new THREE.Box3().setFromObject(m);
        m.position.y -= bb0.min.y;
        m.position.y += yOffset;
        m.updateMatrixWorld(true);

        scene.add(m);
        fadeables.push(m);
        cullables.push(m);

        // bbox total apenas para referência (não usado para colisão)
        const bboxFull = new THREE.Box3().setFromObject(m);
        console.log('[Inn] bbox total (referência):',
            `x:[${bboxFull.min.x.toFixed(2)}, ${bboxFull.max.x.toFixed(2)}]`,
            `z:[${bboxFull.min.z.toFixed(2)}, ${bboxFull.max.z.toFixed(2)}]`,
            `y:[${bboxFull.min.y.toFixed(2)}, ${bboxFull.max.y.toFixed(2)}]`,
        );

        // ---- Colisões manuais do Gobble Inn ----
        const wallH = 3;     // altura das paredes
        const wallT = 0.40;  // espessura das paredes
        const postR = 0.15;  // raio (meia-largura) dos postes da entrada

        // Parede ESTE (lado da entrada) — face em x=-43.53, espessura para dentro (-x)
        addCollider(new THREE.Box3(
            new THREE.Vector3(-43.53 - wallT, 0,     32.40),
            new THREE.Vector3(-43.53,         wallH, 41.12),
        ));
        // Parede NORTE — face em z=41.49, espessura para dentro (-z)
        addCollider(new THREE.Box3(
            new THREE.Vector3(-49.80, 0,     41.49 - wallT),
            new THREE.Vector3(-43.93, wallH, 41.49),
        ));
        // Parede OESTE (fundo) — face em x=-49.81, espessura para dentro (+x)
        addCollider(new THREE.Box3(
            new THREE.Vector3(-49.81,         0,     32.10),
            new THREE.Vector3(-49.81 + wallT, wallH, 41.27),
        ));
        // Parede SUL — face em z=32.10, espessura para dentro (+z)
        addCollider(new THREE.Box3(
            new THREE.Vector3(-49.79, 0,     32.10),
            new THREE.Vector3(-44.01, wallH, 32.10 + wallT),
        ));

        // Postes da entrada (mais finos que o jogador)
        addCollider(new THREE.Box3(
            new THREE.Vector3(-39.95 - postR, 0,     38.37 - postR),
            new THREE.Vector3(-39.95 + postR, wallH, 38.37 + postR),
        ));
        addCollider(new THREE.Box3(
            new THREE.Vector3(-40.21 - postR, 0,     35.38 - postR),
            new THREE.Vector3(-40.21 + postR, wallH, 35.38 + postR),
        ));

        // Parede diagonal — aproximada por segmentos AABB
        // de (X:-42.40, Z:25.54) a (X:-44.25, Z:28.27)
        {
            const ax = -42.40, az = 25.54;
            const bx = -44.25, bz = 28.27;
            const segments = 6;
            const halfT    = 0.22; // meia-espessura de cada segmento
            for (let i = 0; i < segments; i++) {
                const t  = (i + 0.5) / segments;
                const cx = ax + (bx - ax) * t;
                const cz = az + (bz - az) * t;
                addCollider(new THREE.Box3(
                    new THREE.Vector3(cx - halfT, 0,     cz - halfT),
                    new THREE.Vector3(cx + halfT, wallH, cz + halfT),
                ));
            }
        }

        invalidateColliderGrid();
        console.log('[Inn] 12 colisores manuais adicionados (4 paredes + 2 postes + 6 segmentos diagonal).');

        // Caixa de interação para entrar na taverna — área do alpendre entre
        // os postes e a parede este. Ajusta se a porta do modelo estiver noutro sítio.
        tavernEnterBox = new THREE.Box3(
            new THREE.Vector3(-43.30, 0,   35.00),
            new THREE.Vector3(-38.50, 2.5, 39.00),
        );
    }, undefined, e => console.error('Erro gobble-inn:', e));
}

// ---- terrenos ----
// Caminhos norte:
//   - Vertical central:  x≈0,  z: 4→99
//   - Horizontal loja:   z≈25, x: -30→0
// Caminhos sul:
//   - Vertical central:  x≈0,  z: -4→-99
//   - Horizontal bifurc: z≈-30, x: -50→50
//   - Vertical leste:    x≈40, z: -30→-70
//   - Vertical oeste:    x≈-40, z: -30→-70

function criarTerrenoNorte(scene) {
    const u = matTerrainN.uniforms;
    // caminho central vertical: cobre todo o norte
    u.uVPath0X.value = 0;   u.uVPath0W.value = 3.2; u.uVPath0Z0.value = -100; u.uVPath0Z1.value = 100;
    // ramificação para a shop: horizontal z=25, x: -32→2
    u.uHPath0Z.value = 25;  u.uHPath0W.value = 3.2; u.uHPath0X0.value = -32; u.uHPath0X1.value = 2;
    // sem outros caminhos
    u.uVPath1X.value = 999; u.uVPath2X.value = 999;
    u.uHPath1Z.value = 999; u.uHPath2Z.value = 999;

    const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 110, 1, 1), matTerrainN);
    g.rotation.x = -Math.PI / 2; g.position.set(0, 0.002, 45); g.receiveShadow = true; scene.add(g);
}

function criarTerrenoSul(scene) {
    const u = matTerrainS.uniforms;
    // caminho central vertical: cobre todo o sul
    u.uVPath0X.value = 0;   u.uVPath0W.value = 3.2; u.uVPath0Z0.value = -100; u.uVPath0Z1.value = 10;
    // ramificação horizontal a z=-35: vai para a esquerda (zona de batalha oeste)
    u.uHPath0Z.value = -35; u.uHPath0W.value = 3.0; u.uHPath0X0.value = -55;  u.uHPath0X1.value = 0;
    // ramificação horizontal a z=-55: vai para a direita (zona de batalha leste)
    u.uHPath1Z.value = -55; u.uHPath1W.value = 3.0; u.uHPath1X0.value = 0;    u.uHPath1X1.value = 55;
    // caminho vertical que desce a partir da ramificação oeste (x=-45, z: -35→-80)
    u.uVPath1X.value = -45; u.uVPath1W.value = 3.0; u.uVPath1Z0.value = -80;  u.uVPath1Z1.value = -35;
    // caminho vertical que desce a partir da ramificação leste (x=45, z: -55→-85)
    u.uVPath2X.value = 45;  u.uVPath2W.value = 3.0; u.uVPath2Z0.value = -85;  u.uVPath2Z1.value = -55;
    u.uHPath2Z.value = 999;

    const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 110, 1, 1), matTerrainS);
    g.rotation.x = -Math.PI / 2; g.position.set(0, 0, -45); g.receiveShadow = true; scene.add(g);
}

// ---- montanhas de perímetro ----
function criarPico(scene, x, z, h, r, rand) {
    // corpo principal — cone facetado
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 7 + Math.floor(rand() * 3), 1),
        matMountain
    );
    cone.position.set(x, h / 2, z);
    cone.rotation.y = rand() * Math.PI;
    cone.castShadow = true;
    cone.receiveShadow = true;
    scene.add(cone);
    fadeables.push(cone);
    cullables.push(cone);

    // neve no topo (cone menor branco)
    const snowH = h * 0.28;
    const snow = new THREE.Mesh(
        new THREE.ConeGeometry(r * 0.38, snowH, 7, 1),
        matSnow
    );
    snow.position.set(x, h - snowH * 0.35, z);
    snow.rotation.y = rand() * Math.PI;
    snow.castShadow = true;
    scene.add(snow);
    fadeables.push(snow);
    cullables.push(snow);

    // colisor — caixa larga o suficiente para bloquear o jogador
    addCollider(new THREE.Box3(
        new THREE.Vector3(x - r * 0.75, 0, z - r * 0.75),
        new THREE.Vector3(x + r * 0.75, h, z + r * 0.75)
    ));
}

function criarMontanhas(scene) {
    const rand = seededRand(777);
    const BORDA = 98;   // onde começam as montanhas
    const PASSO = 9;    // espaçamento base entre picos
    const JITTER = 3.5; // variação aleatória de posição

    const pontos = [];

    // lado norte (z = +BORDA)
    for (let x = -BORDA; x <= BORDA; x += PASSO)
        pontos.push([x + (rand() - 0.5) * JITTER, BORDA + rand() * 4]);

    // lado sul (z = -BORDA)
    for (let x = -BORDA; x <= BORDA; x += PASSO)
        pontos.push([x + (rand() - 0.5) * JITTER, -BORDA - rand() * 4]);

    // lado este (x = +BORDA)
    for (let z = -BORDA + PASSO; z < BORDA; z += PASSO)
        pontos.push([BORDA + rand() * 4, z + (rand() - 0.5) * JITTER]);

    // lado oeste (x = -BORDA)
    for (let z = -BORDA + PASSO; z < BORDA; z += PASSO)
        pontos.push([-BORDA - rand() * 4, z + (rand() - 0.5) * JITTER]);

    for (const [px, pz] of pontos) {
        const h = 10 + rand() * 16;   // altura entre 10 e 26
        const r = 6  + rand() * 6;    // raio entre 6 e 12
        criarPico(scene, px, pz, h, r, rand);

        // pico secundário menor ao lado para dar volume irregular
        if (rand() > 0.4) {
            const ox = (rand() - 0.5) * r * 1.2;
            const oz = (rand() - 0.5) * r * 1.2;
            const h2 = h * (0.45 + rand() * 0.35);
            const r2 = r * (0.4 + rand() * 0.3);
            criarPico(scene, px + ox, pz + oz, h2, r2, rand);
        }
    }
}

const SHOP_CX = -30, SHOP_CZ = 25;
function zonaLivre(x, z, m = 7) {
    return Math.abs(x - SHOP_CX) < m && Math.abs(z - SHOP_CZ) < m;
}

// Vila do mercador — área limpa à volta da loja, reservada para o jogador
// colocar assets (casas, lanternas, banca, fonte, etc.).
// Limites em coordenadas de mundo: rectângulo XZ.
export const VILLAGE_BOUNDS = {
    minX: -48, maxX: -12,
    minZ:   9, maxZ:  41,
};
export function naVila(x, z) {
    return x >= VILLAGE_BOUNDS.minX && x <= VILLAGE_BOUNDS.maxX
        && z >= VILLAGE_BOUNDS.minZ && z <= VILLAGE_BOUNDS.maxZ;
}
// margem de exclusão de árvores nos caminhos (alargada para caminhos sinuosos)
const PATH_W = 5.0;
function naFaixaCaminho(x, z) {
    // caminho central vertical (norte e sul)
    if (Math.abs(x) < PATH_W) return true;
    // caminho horizontal para a shop (z≈25, x: -34→2)
    if (z > 21 && z < 29 && x > -36 && x < 3) return true;
    // ramificação horizontal sul a z=-35 (x: -55→0)
    if (z > -39 && z < -31 && x > -58 && x < 3) return true;
    // ramificação horizontal sul a z=-55 (x: 0→55)
    if (z > -59 && z < -51 && x > -3 && x < 58) return true;
    // vertical oeste (x≈-45, z: -80→-35)
    if (z < -31 && z > -83 && Math.abs(x + 45) < PATH_W) return true;
    // vertical leste (x≈45, z: -85→-55)
    if (z < -51 && z > -88 && Math.abs(x - 45) < PATH_W) return true;
    return false;
}

// ---- castelo exterior — GLB ----
function criarCastelo(scene) {
    const CX = 0, CZ = -80 ,CY =-1;
    const SCALE = 0.03;
    // dimensões aproximadas do modelo em unidades de jogo (após scale)
    const W = 18, D = 16, H = 7;

    const loader = new GLTFLoader();
    loader.load('../../assets/models/constructions/casttle.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(CX, 0, CZ);
        m.scale.setScalar(SCALE);
        m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(m);
        fadeables.push(m);
        cullables.push(m);
    }, undefined, e => console.error('Erro castelo GLB:', e));

    // caminho de acesso ao portão
    makePath(3.5, 12, CX, CZ + D/2 + 5.5, scene);

    // zona de interação do portão (frente sul do castelo, fora das muralhas)
    castleEnterBox = new THREE.Box3(
        new THREE.Vector3(CX - 2, 0, CZ + D/2),
        new THREE.Vector3(CX + 2, 3, CZ + D/2 + 3)
    );

    // colisores das muralhas exteriores
    addCollider(new THREE.Box3(new THREE.Vector3(CX-W/2-2, 0, CZ-D/2-2), new THREE.Vector3(CX+W/2+2, H, CZ-D/2+1)));
    addCollider(new THREE.Box3(new THREE.Vector3(CX-W/2-2, 0, CZ+D/2-1), new THREE.Vector3(CX-2,     H, CZ+D/2+1)));
    addCollider(new THREE.Box3(new THREE.Vector3(CX+2,     0, CZ+D/2-1), new THREE.Vector3(CX+W/2+2, H, CZ+D/2+1)));
    addCollider(new THREE.Box3(new THREE.Vector3(CX-W/2-2, 0, CZ-D/2-2), new THREE.Vector3(CX-W/2+1, H, CZ+D/2+2)));
    addCollider(new THREE.Box3(new THREE.Vector3(CX+W/2-1, 0, CZ-D/2-2), new THREE.Vector3(CX+W/2+2, H, CZ+D/2+2)));

    // barreira no vão da porta — bloqueia entrada por colisão (só passa via interacção E)
    addCollider(new THREE.Box3(
        new THREE.Vector3(CX - 2, 0, CZ + D/2 - 0.4),
        new THREE.Vector3(CX + 2, H, CZ + D/2 + 0.4)
    ));
}

// ---- guardião da ponte ----
function criarGuardiao(scene) {
    const GX = 0, GZ = 4.5; // saída norte da ponte, centro do caminho

    const matArmor = new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 0.6, metalness: 0.4 });
    const matHelm  = new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 0.5, metalness: 0.6 });
    const matCloak = new THREE.MeshStandardMaterial({ color: 0x7a1a1a, roughness: 0.85 });
    const matEye   = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.8 });

    const g = new THREE.Group();

    // pernas
    const legGeo = new THREE.CapsuleGeometry(0.11, 0.28, 8, 8);
    legGeo.translate(0, -0.24, 0);
    const lLeg = new THREE.Mesh(legGeo, matArmor); lLeg.position.set(-0.13, 0.52, 0);
    const rLeg = new THREE.Mesh(legGeo, matArmor); rLeg.position.set( 0.13, 0.52, 0);
    g.add(lLeg, rLeg);
    g.userData.lLeg = lLeg; g.userData.rLeg = rLeg;

    // tronco
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.50, 16), matArmor);
    torso.position.set(0, 0.77, 0);
    g.add(torso);

    // capa
    const capeGeo = new THREE.CylinderGeometry(0.24, 0.35, 0.52, 12, 1, true, Math.PI * 0.1, Math.PI * 1.8);
    const cape = new THREE.Mesh(capeGeo, matCloak);
    cape.position.set(0, 0.77, 0); // Centralizada, mas com abertura frontal
    g.add(cape);

    // braços
    const armGeo = new THREE.CapsuleGeometry(0.08, 0.22, 8, 8);
    armGeo.translate(0, -0.19, 0);
    const lArm = new THREE.Mesh(armGeo, matArmor); lArm.position.set(-0.32, 0.97, 0); lArm.rotation.z =  0.3;
    const rArm = new THREE.Mesh(armGeo, matArmor); rArm.position.set( 0.32, 0.97, 0); rArm.rotation.z = -0.3;
    g.add(lArm, rArm);
    g.userData.lArm = lArm; g.userData.rArm = rArm;

    // lança
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), matArmor);
    spear.position.set(0.45, 1.1, -0.1); // Recuada ligeiramente para não bater na capa
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), matHelm);
    tip.position.set(0.45, 2.25, -0.1);
    g.add(spear, tip);

    // cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 16), matArmor);
    head.position.set(0, 1.40, 0);
    g.add(head);

    // elmo
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 0.22, 16), matHelm);
    helm.position.set(0, 1.56, 0);
    const helmTop = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matHelm);
    helmTop.position.set(0, 1.56, 0);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.55), matCloak);
    crest.position.set(0, 1.82, 0);
    g.add(helm, helmTop, crest);

    // olhos brilhantes (Z positivo é a FRENTE)
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matEye);
    lEye.position.set(-0.10, 1.42, 0.27);
    const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matEye);
    rEye.position.set( 0.10, 1.42, 0.27);
    g.add(lEye, rEye);

    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    g.position.set(GX, 0, GZ);
    g.rotation.y = 0; // Virado para SUL (frente)
    scene.add(g);
    fadeables.push(g);
    cullables.push(g);
    _guardianMesh = g; // Guarda referência para animação

    // barreira invisível que cobre toda a largura da ponte (BW=5, parapeitos em ±2.3)
    // fica mesmo na saída norte, z=3.2 — impede qualquer passagem
    _guardianColliderBox = new THREE.Box3(
        new THREE.Vector3(-2.2, -1, 3.0),
        new THREE.Vector3( 2.2,  4, 3.6)
    );
    addCollider(_guardianColliderBox);

    // interact box do lado sul (o jogador aproxima-se vindo de z positivo)
    guardianInteractBox = new THREE.Box3(
        new THREE.Vector3(GX - 1.5, 0, GZ),
        new THREE.Vector3(GX + 1.5, 2.5, GZ + 3.0)
    );
}

// ---- mapa principal ----
// estruturas grandes do mapa que NUNCA devem ter árvores/rochas em cima
const _estruturas = [
    { x: SHOP_CX, z: SHOP_CZ, r: 9 },   // loja
    { x: 0,       z: -80,     r: 16 },  // castelo + muralhas
    { x: 0,       z: 4.5,     r: 4 },   // guardião / saída da ponte
    { x: 70,      z: 70,      r: 4 },   // baú
    ];const _propsColocadas = []; // {x,z,r}
const MIN_DIST_ARVORES   = 3.2; // distância mínima entre árvores
const MIN_DIST_ROCHA_ARV = 2.2; // árvore→rocha
function _longeDeEstruturas(x, z, margem = 0) {
    for (const e of _estruturas) {
        const dx = x - e.x, dz = z - e.z;
        if (dx*dx + dz*dz < (e.r + margem) * (e.r + margem)) return false;
    }
    return true;
}
function _longeDeProps(x, z, raioProprio) {
    for (const p of _propsColocadas) {
        const dx = x - p.x, dz = z - p.z;
        const min = p.r + raioProprio;
        if (dx*dx + dz*dz < min * min) return false;
    }
    return true;
}
function _registaProp(x, z, r) { _propsColocadas.push({ x, z, r }); }

export function criarMapa(scene) {
    criarTerrenoNorte(scene);
    criarTerrenoSul(scene);
    criarRio(scene, colliders, fadeables, cullables);
    criarGuardiao(scene);
    criarShop(scene, SHOP_CX, SHOP_CZ);
    // Gobble Inn na vila — norte da loja, dentro de VILLAGE_BOUNDS
    criarInn(scene, -45, 35, 0.01, 0, -2);
    criarCastelo(scene);
    // zona corrupta ao redor do castelo (z=-80) — visual roxo, sem encontros
    criarZonaCorrupta(scene, 0, -80, 28, 111);

    // zonas de batalha norte
    const znB1 = criarZonaBatalha(scene,  28,  28, 12, 202);
    const znB2 = criarZonaBatalha(scene,  28,  60, 10, 303);
    const znB3 = criarZonaBatalha(scene, -28,  65,  9, 404);

    // zonas de batalha sul
    const zsB1 = criarZonaBatalha(scene, -28, -20, 11, 505);
    const zsB2 = criarZonaBatalha(scene,  28, -20, 12, 606);
    const zsB3 = criarZonaBatalha(scene, -50, -50, 13, 707);
    const zsB4 = criarZonaBatalha(scene,  50, -50, 13, 808);

    const rand = seededRand(1);

    // árvores norte — densa, cobre toda a área afastada dos caminhos
    let placed = 0;
    for (let i = 0; i < 1500 && placed < 200; i++) {
        const x = (rand() * 2 - 1) * 94;
        const z = 5 + rand() * 90;
        if (naFaixaCaminho(x, z)) continue;
        if (naVila(x, z)) continue;
        if (!_longeDeEstruturas(x, z)) continue;
        if (!_longeDeProps(x, z, MIN_DIST_ARVORES / 2)) continue;
        const zoneRef = _findZoneAt(x, z, [znB1, znB2, znB3]);
        criarArvore(scene, x, z, !!zoneRef, zoneRef);
        _registaProp(x, z, MIN_DIST_ARVORES / 2);
        placed++;
    }

    // árvores sul — ainda mais densas e escuras
    placed = 0;
    for (let i = 0; i < 1800 && placed < 250; i++) {
        const x = (rand() * 2 - 1) * 94;
        const z = -(5 + rand() * 90);
        if (naFaixaCaminho(x, z)) continue;
        if (naVila(x, z)) continue;
        if (!_longeDeEstruturas(x, z)) continue;
        if (!_longeDeProps(x, z, MIN_DIST_ARVORES / 2)) continue;
        const zoneRef = _findZoneAt(x, z, [zsB1, zsB2, zsB3, zsB4]);
        criarArvore(scene, x, z, !!zoneRef, zoneRef);
        _registaProp(x, z, MIN_DIST_ARVORES / 2);
        placed++;
    }

    // rochas norte
    placed = 0;
    for (let i = 0; i < 400 && placed < 50; i++) {
        const x = (rand() * 2 - 1) * 90;
        const z = 5 + rand() * 88;
        if (naFaixaCaminho(x, z)) continue;
        if (naVila(x, z)) continue;
        if (!_longeDeEstruturas(x, z)) continue;
        if (!_longeDeProps(x, z, MIN_DIST_ROCHA_ARV / 2)) continue;
        const r = 0.3 + rand() * 0.5;
        criarRocha(scene, x, z, r, emZonaBatalha(x, z));
        _registaProp(x, z, Math.max(r, MIN_DIST_ROCHA_ARV / 2));
        placed++;
    }

    // rochas sul
    placed = 0;
    for (let i = 0; i < 400 && placed < 50; i++) {
        const x = (rand() * 2 - 1) * 90;
        const z = -(5 + rand() * 88);
        if (naFaixaCaminho(x, z)) continue;
        if (naVila(x, z)) continue;
        if (!_longeDeEstruturas(x, z)) continue;
        if (!_longeDeProps(x, z, MIN_DIST_ROCHA_ARV / 2)) continue;
        const r = 0.3 + rand() * 0.6;
        criarRocha(scene, x, z, r, emZonaBatalha(x, z));
        _registaProp(x, z, Math.max(r, MIN_DIST_ROCHA_ARV / 2));
        placed++;
    }

    criarMontanhas(scene);

    // baú escondido (canto do mapa, longe dos caminhos e da zona corrupta)
    _bau = new Bau(scene, 70, 0, 70, 'coroa_magica');
    colliders.push({ box: _bau.getColliderBox(), isRiver: false }); _gridDirty = true;

    // baú secreto da Máscara do Eclipse — canto sudoeste, profundo
    _bauMascara = new Bau(scene, -78, 0, 78, 'mascara_eclipse', Math.PI * 0.25);
    colliders.push({ box: _bauMascara.getColliderBox(), isRiver: false }); _gridDirty = true;

    console.log('Mapa criado.');
}

// zonas previamente limpas — guardadas para poderem ser repostas pelo
// reset do quarto (dormir na cama). Cada item guarda o zoneObj e as
// "cleanColors" das árvores corrompidas associadas, para restaurar
// fielmente o estado original.
const _clearedZones = [];

// remove visualmente uma zona de batalha e retira-a dos encontros
export function limparZonaBatalha(playerX, playerZ) {
    const pt = new THREE.Vector3(playerX, 0.5, playerZ);
    for (let i = 0; i < battleZoneObjects.length; i++) {
        const zo = battleZoneObjects[i];
        if (!zo.box.containsPoint(pt)) continue;
        // remove meshes roxos da zona (solo + tufos)
        for (const m of zo.meshes) zo.scene.remove(m);
        // restaura cor natural das árvores contaminadas desta zona
        const treeSnapshots = [];
        for (const tree of zo.trees) {
            const matSnap = [];
            tree.traverse(c => {
                if (!c.isMesh || !c.material.userData.cleanColor) return;
                matSnap.push({
                    mat: c.material,
                    corruptColor:    c.material.color.clone(),
                    corruptEmissive: c.material.emissive.clone(),
                    corruptIntensity: c.material.emissiveIntensity,
                });
                c.material.color.copy(c.material.userData.cleanColor);
                c.material.emissive.setRGB(0, 0, 0);
                c.material.emissiveIntensity = 0;
            });
            treeSnapshots.push(matSnap);
        }
        // retira do array de encontros
        const gi = grassZones.indexOf(zo.box);
        if (gi !== -1) grassZones.splice(gi, 1);
        battleZoneObjects.splice(i, 1);

        _clearedZones.push({ zoneObj: zo, treeSnapshots });
        return true;
    }
    return false;
}

// Restaura todas as zonas de batalha que tinham sido limpas — repõe os
// monstros (encontros), os meshes roxos e a coloração corrompida das
// árvores. Usado pela cama do quarto inicial.
export function resetZonasBatalha() {
    let restored = 0;
    while (_clearedZones.length) {
        const { zoneObj, treeSnapshots } = _clearedZones.pop();
        for (const m of zoneObj.meshes) zoneObj.scene.add(m);
        for (let k = 0; k < zoneObj.trees.length; k++) {
            const snap = treeSnapshots[k] || [];
            for (const s of snap) {
                s.mat.color.copy(s.corruptColor);
                s.mat.emissive.copy(s.corruptEmissive);
                s.mat.emissiveIntensity = s.corruptIntensity;
            }
        }
        grassZones.push(zoneObj.box);
        battleZoneObjects.push(zoneObj);
        restored++;
    }
    return restored;
}

// flag persistente: assim que o sul foi limpo pela primeira vez, a loja
// fica aberta para sempre (mesmo após reset das zonas pela cama).
let _shopDesbloqueada = false;
export function isShopDesbloqueada() { return _shopDesbloqueada; }

// zonas sul: z > 0 (áreas iniciais e loja)
export function zonasSulLimpas() {
    const limpas = !battleZoneObjects.some(zo => zo.box.min.z > 0);
    if (limpas) _shopDesbloqueada = true;
    return limpas;
}

// todas as zonas: mapa inteiro limpo
export function todasZonasLimpas() {
    return battleZoneObjects.length === 0;
}

export function verificaColisao(futuroX, futuroZ) {
    if (futuroX < mapBounds.minX || futuroX > mapBounds.maxX ||
        futuroZ < mapBounds.minZ || futuroZ > mapBounds.maxZ) return true;

    if (_gridDirty) _buildGrid();

    const r = 0.25;
    _pbMin.set(futuroX - r, 0, futuroZ - r);
    _pbMax.set(futuroX + r, 1.7, futuroZ + r);
    _pb.min = _pbMin; _pb.max = _pbMax;

    const cx = Math.floor(futuroX / _CELL);
    const cz = Math.floor(futuroZ / _CELL);

    // Verifica célula atual e 8 vizinhas (raio de player < célula, 1 vizinho chega)
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const bucket = _grid.get((cx + dx) * 10000 + (cz + dz));
            if (!bucket) continue;
            for (const i of bucket) {
                const c = colliders[i];
                if (!_pb.intersectsBox(c.box)) continue;
                if (c.isRiver) {
                    _bridgePt.set(futuroX, 0, futuroZ);
                    if (getBridgePassage()?.containsPoint(_bridgePt)) continue;
                }
                return true;
            }
        }
    }
    return false;
}
