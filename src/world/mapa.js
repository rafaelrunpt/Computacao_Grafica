import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTerrainShader, terraTex, matBattleGrass, matContRock, matCorruptHalo, rockTex, rockNormal, rockRough, grassTex, madeiraTex } from './shaders.js';
import { criarRio, getBridgePassage } from './rio.js';
import { Bau } from './bau.js';
import { criarGuardiao as _criarGuardiao, removerGuardiao as _removerGuardiao } from '../entities/guardiao.js';
import { renderer } from '../core/renderer.js';

import { criarBruxa, updateBruxa } from '../entities/bruxa.js';
import { criarSantuarios } from './santuarios.js';
import { criarCogumelos } from './cogumelos.js';
import { criarVegetacao, updateVegetacao, setVegetacaoZonas, atualizarVegetacaoZonas } from './vegetacao.js';

export { getSantuarios, ativarSantuario, updateSantuarios } from './santuarios.js';
export { updateCogumelos } from './cogumelos.js';
export { updateVegetacao, setVegetacaoZonas, atualizarVegetacaoZonas } from './vegetacao.js';

export { matBattleGrass, matBattleSky, matWater, matContTrunk, matContLeaves, matContRock, matCorruptHalo } from './shaders.js';
export { getBridgeHeight } from './rio.js';
export { guardianInteractBox, isGuardiaoPassagemConcedida, updateGuardiao } from '../entities/guardiao.js';
export let bruxaInteractBox = null;
export function updateBruxaMapa(dt, playerPos) { updateBruxa(dt, playerPos); }

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
export const worldParticles = [];    // THREE.Points[] — mantido por compat. (cleanup)

// ---- Partículas Corrompidas (vertex-shader, sem upload CPU) ----
// Antes: 40 verts × N zonas × pos.needsUpdate=true a 30Hz = upload contínuo.
// Agora: posição base + fase animadas no vertex shader; só uTime é actualizado.
const _zoneParticlesMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime:       { value: 0 },
        uMaxY:       { value: 4.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
    },
    vertexShader: `
        attribute float aPhase;
        attribute float aSpeed;
        uniform float uTime;
        uniform float uMaxY;
        uniform float uPixelRatio;
        void main() {
            vec3 p = position;
            p.y = mod(position.y + uTime * aSpeed + aPhase, uMaxY);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uPixelRatio * 6.0 * (35.0 / max(-mv.z, 1.0));
        }
    `,
    fragmentShader: `
        void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            if (d > 0.5) discard;
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(0.75, 0.56, 1.0, a * 0.7);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

export function updateZoneParticles(dt) {
    _zoneParticlesMat.uniforms.uTime.value += dt * 0.35;
}

function criarParticulasZona(scene, cx, cz, raio) {
    const partCount = 40;
    const geo = new THREE.BufferGeometry();
    const pos    = new Float32Array(partCount * 3);
    const phase  = new Float32Array(partCount);
    const speed  = new Float32Array(partCount);
    for (let i = 0; i < partCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const rd = Math.random() * raio;
        pos[i * 3 + 0] = Math.cos(a) * rd;
        pos[i * 3 + 1] = Math.random() * 4.0;
        pos[i * 3 + 2] = Math.sin(a) * rd;
        phase[i] = Math.random() * 4.0;
        speed[i] = 0.8 + Math.random() * 0.6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speed, 1));
    const pts = new THREE.Points(geo, _zoneParticlesMat);
    pts.position.set(cx, 0, cz);
    scene.add(pts);
    worldParticles.push(pts);
    return pts;
}
// objectos candidatos a fade-out quando tapam o jogador (assets sólidos — não
// árvores, que podem ficar opacas). Mantido aqui para evitar raycast recursivo
// contra toda a cena no loop principal.
export const fadeables = [];
// objectos para frontal culling — escondidos (visible=false) quando estão
// atrás da câmara, tirando-os do render E do shadow pass. Inclui tudo o que
// é pesado: árvores, rochas, montanhas, GLBs grandes, ponte, guardião.
export const cullables = [];
export let shopDoorInteract = null;

const matTerrainN = makeTerrainShader(0x9ec87a, 0xd4b882);
const matTerrainS = makeTerrainShader(0x9ec87a, 0xd4b882);

const matRock     = new THREE.MeshStandardMaterial({ 
    map: rockTex,
    normalMap: rockNormal,
    roughnessMap: rockRough,
    color: 0xffffff, 
    roughness: 0.9 
});

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
    _removerGuardiao((box) => {
        const i = colliders.findIndex(c => c.box === box);
        if (i !== -1) { colliders.splice(i, 1); _gridDirty = true; }
    });
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

// ---- árvore GLB → InstancedMesh ----
// As ~330 árvores são renderizadas como InstancedMesh em vez de Object3D
// clonado por árvore. Antes eram ~660+ draw-calls (2 sub-meshes × 330
// árvores) + outro tanto no shadow pass — gargalo de CPU em Firefox/Windows
// que mantinha a NVIDIA capada a ~10%. Com InstancedMesh ficamos com 1
// draw-call por (sub-mesh, bucket de corrupção) — tipicamente 10-20 no
// total, redução de ~30-60×.
let treeTemplate = null;
const _treeSpawnList = []; // { scene, x, z, contaminada, zoneRef }
let _criarMapaDone = false;
let _forestBuilt = false;
let _treeBboxLocal = null;

const treeLoader = new GLTFLoader();
treeLoader.load('assets/models/ambiente/handpainted_pine_tree.glb', (gltf) => {
    treeTemplate = gltf.scene;
    treeTemplate.updateMatrixWorld(true);
    _treeBboxLocal = new THREE.Box3().setFromObject(treeTemplate);
    _tryBuildForest();
}, undefined, e => console.error('Erro tree.glb:', e));

// coordenadas do castelo — usadas para corrupção progressiva por distância
const CASTLE_CX = 0, CASTLE_CZ = -80, CASTLE_CORRUPT_RADIUS = 78;

function _corruptionStrength(x, z) {
    const dx = x - CASTLE_CX, dz = z - CASTLE_CZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // 0 fora do raio, sobe até 1 no centro do castelo
    return Math.max(0, 1 - dist / CASTLE_CORRUPT_RADIUS);
}

// Hitbox das árvores — calculada a partir do bbox do template (em escala 1)
// transformado pela matriz da instância. TREE_HITBOX_SCALE encolhe a largura
// para o tronco (1 = visual completo, <1 mais apertado).
const TREE_HITBOX_SCALE = 0.2;

// hash determinístico 2D → [0,1): a rotação/escala das árvores dependem
// só da posição (não de Math.random), por isso ficam SEMPRE iguais em
// cada arranque do jogo.
function _hash2(x, z) {
    const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return s - Math.floor(s);
}

const _treeMatCache = new Map(); // key: baseMat.uuid + "_" + t_rounded
function _getCorruptedMaterial(baseMat, t_round) {
    if (t_round <= 0.01) return baseMat;
    const key = baseMat.uuid + "_" + t_round;
    if (_treeMatCache.has(key)) return _treeMatCache.get(key);
    const origColor = baseMat.color.clone();
    const newMat = baseMat.clone();
    newMat.userData.cleanColor = origColor;
    const darken = 1 - t_round * 0.20;
    newMat.color.multiplyScalar(darken);
    newMat.color.r += t_round * 0.05;
    newMat.color.b += t_round * 0.10;
    if (newMat.emissive) {
        newMat.emissive.setRGB(t_round * 0.08, 0, t_round * 0.15);
    } else {
        newMat.emissive = new THREE.Color(t_round * 0.08, 0, t_round * 0.15);
    }
    newMat.emissiveIntensity = 0.2 + t_round * 0.30;
    _treeMatCache.set(key, newMat);
    return newMat;
}

function criarArvore(scene, x, z, contaminada = false, zoneRef = null) {
    // Só enfileira — o build do forest é feito uma vez, em batch,
    // depois de criarMapa terminar E o GLB ter carregado.
    _treeSpawnList.push({ scene, x, z, contaminada, zoneRef });
}

function _tryBuildForest() {
    if (_forestBuilt) return;
    if (!treeTemplate || !_criarMapaDone) return;
    _forestBuilt = true;
    if (_treeSpawnList.length === 0) return;
    _buildInstancedForest();
    _treeSpawnList.length = 0;
}

function _buildInstancedForest() {
    // Enumera sub-meshes do template (tronco, copa, …) com a matriz local
    // relativa ao root do template (o template está com identidade, então
    // matrixWorld é local-to-root directamente).
    const submeshes = []; // { geometry, baseMaterial, localToRoot }
    treeTemplate.traverse(c => {
        if (!c.isMesh) return;
        submeshes.push({
            geometry: c.geometry,
            baseMaterial: Array.isArray(c.material) ? c.material[0] : c.material,
            localToRoot: c.matrixWorld.clone(),
        });
    });
    if (submeshes.length === 0) return;

    // Foliage fix: com árvores instanciadas, o Three.js já não pode ordenar
    // árvore-a-árvore por distância — todas as instâncias desenham num só
    // draw-call. Materiais transparentes (folhas com alpha) deixam de ter
    // sort entre instâncias e folhas de uma árvore "comem" as folhas da
    // árvore atrás. Convertemos transparency → alphaTest (cutout binário),
    // que escreve no z-buffer e dispensa ordenação. Os clones criados depois
    // em _getCorruptedMaterial herdam estas flags.
    for (const sm of submeshes) {
        const m = sm.baseMaterial;
        if (m.transparent || (m.alphaTest && m.alphaTest > 0) || m.alphaMap || (m.map && m.map.format === THREE.RGBAFormat)) {
            m.transparent = false;
            m.alphaTest = m.alphaTest > 0 ? Math.max(m.alphaTest, 0.5) : 0.5;
            m.depthWrite = true;
            m.side = THREE.DoubleSide; // folhas vistas de ambos os lados
            m.needsUpdate = true;
        }
    }

    const templateMinY = _treeBboxLocal ? _treeBboxLocal.min.y : 0;
    const _yAxis = new THREE.Vector3(0, 1, 0);

    // Agrupar matrizes de instância por (sub-mesh, bucket de corrupção).
    const groups = new Map(); // key="i_t" -> { submeshIdx, t_round, matrices[], scene }

    const treeMat = new THREE.Matrix4();
    const instMat = new THREE.Matrix4();
    const quat    = new THREE.Quaternion();
    const pos     = new THREE.Vector3();
    const scl     = new THREE.Vector3();
    const colSize = new THREE.Vector3();
    const colCen  = new THREE.Vector3();
    const _colBox = new THREE.Box3();

    for (const spawn of _treeSpawnList) {
        const { x, z, contaminada, zoneRef, scene } = spawn;
        const rotY  = _hash2(x, z) * Math.PI * 2;
        const scale = (0.006 + _hash2(z, x) * 0.0015) * 1.2;
        // yOffset assenta o pé da árvore no chão (igual ao código antigo).
        // Rotação Y não altera bbox.min.y; só a escala importa.
        const yOff  = -templateMinY * scale + 0.03;

        quat.setFromAxisAngle(_yAxis, rotY);
        pos.set(x, yOff, z);
        scl.set(scale, scale, scale);
        treeMat.compose(pos, quat, scl);

        const castleT = _corruptionStrength(x, z);
        const battleT = contaminada ? 0.55 : 0;
        const t = Math.min(1, Math.max(battleT, castleT));
        const t_round = t > 0.01 ? Math.round(t * 10) / 10 : 0;

        for (let i = 0; i < submeshes.length; i++) {
            const key = i + '_' + t_round;
            let g = groups.get(key);
            if (!g) {
                g = { submeshIdx: i, t_round, matrices: [], scene };
                groups.set(key, g);
            }
            instMat.multiplyMatrices(treeMat, submeshes[i].localToRoot);
            g.matrices.push(instMat.clone());
        }

        // Collider: bbox do template transformado pela matriz da instância,
        // depois encolhido em XZ para a hitbox do tronco.
        if (_treeBboxLocal) {
            _colBox.copy(_treeBboxLocal).applyMatrix4(treeMat);
            _colBox.getCenter(colCen);
            _colBox.getSize(colSize);
            const hx = colSize.x * 0.5 * TREE_HITBOX_SCALE;
            const hz = colSize.z * 0.5 * TREE_HITBOX_SCALE;
            addCollider(new THREE.Box3(
                new THREE.Vector3(colCen.x - hx, _colBox.min.y, colCen.z - hz),
                new THREE.Vector3(colCen.x + hx, _colBox.max.y, colCen.z + hz)
            ));
        }

        // Tracking de materiais por zona para a limpeza visual quando a
        // zona é purificada (limparZonaBatalha). Cada zona acumula a lista
        // de materiais corrompidos que as suas árvores usam.
        if (zoneRef && contaminada && t_round > 0.01) {
            if (!zoneRef.materials) zoneRef.materials = new Set();
            for (let i = 0; i < submeshes.length; i++) {
                const mat = _getCorruptedMaterial(submeshes[i].baseMaterial, t_round);
                zoneRef.materials.add(mat);
            }
        }
    }

    // Constrói um InstancedMesh por grupo.
    let totalInstances = 0;
    for (const g of groups.values()) {
        const sm  = submeshes[g.submeshIdx];
        const mat = _getCorruptedMaterial(sm.baseMaterial, g.t_round);
        // Força recompilação do shader: quando o material original do GLB era
        // usado pelo template (não renderizado), o Three.js pode ter-lhe
        // associado um program não-instanciado. Marcamos needsUpdate para
        // o próximo render gerar a variante INSTANCED — sem isto, o Safari
        // não desenhava as sombras das árvores (Chrome também tinha o sintoma
        // de "sombras só aparecem após toggle dia/noite").
        mat.needsUpdate = true;
        const im  = new THREE.InstancedMesh(sm.geometry, mat, g.matrices.length);
        for (let i = 0; i < g.matrices.length; i++) im.setMatrixAt(i, g.matrices[i]);
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = true;
        im.receiveShadow = true;
        // Bounding sphere explícita das instâncias — alguns browsers (notado
        // em Safari) saltavam o shadow pass quando a sphere ficava por
        // calcular. frustumCulled=false evita o teste para o main render,
        // mas o shadow renderer ainda pode usar a sphere para early-out.
        im.computeBoundingSphere?.();
        im.frustumCulled = false;
        g.scene.add(im);
        totalInstances += g.matrices.length;
    }
    // Força um re-bake da shadow map agora que as árvores existem na cena.
    // A bake inicial (renderer.js) e o force-bake da mudança de cena podem
    // ter acontecido ANTES do GLB carregar; sem este disparo, as sombras das
    // árvores só apareciam quando o player se mexesse o suficiente para o
    // throttle de distância disparar (o que dava o sintoma de "as sombras
    // só aparecem se eu clicar dia/noite no menu").
    renderer.shadowMap.needsUpdate = true;
    console.log(`[Floresta] ${totalInstances} árvores em ${groups.size} InstancedMesh(es).`);
}

// ---- rocha ----
// Antes: 1 Mesh + 1 DodecahedronGeometry por rocha (~100 draw-calls + outro
// tanto no shadow pass). Agora: enfileiramos os spawns e construimos
// InstancedMesh por (chunk N/S, clean/contaminated). Geometria partilhada
// (raio = 1), a escala vai na matriz da instância.
const _rockSpawnList = []; // { scene, x, z, r, contaminada, chunk }
const _rockGeoBase = new THREE.DodecahedronGeometry(1, 0);

/**
 * Utilitário para fundir todas as meshes de um modelo estático que partilham
 * o mesmo material. Reduz centenas de draw-calls para meia dúzia.
 */
function mergeStaticGLB(root) {
    const meshesByMat = new Map();
    root.updateMatrixWorld(true);
    root.traverse(c => {
        if (c.isMesh && c.geometry) {
            const mat = Array.isArray(c.material) ? c.material[0] : c.material;
            if (!mat) return;
            let entry = meshesByMat.get(mat.uuid);
            if (!entry) {
                entry = { material: mat, geos: [] };
                meshesByMat.set(mat.uuid, entry);
            }
            
            // Otimização: des-intercalar atributos do GLTF (InterleavedBufferAttributes não são suportados pelo mergeGeometries)
            // e remover morphTargets/skinning que não são suportados em merge estático.
            let g = c.geometry.clone();
            
            // Se for indexada e tiver atributos intercalados, a forma mais simples de "limpar"
            // para o BufferGeometryUtils é converter para não-indexada e voltar a indexar (opcional).
            // No entanto, toNonIndexed() é pesado. Tentamos apenas de-interleave se detectado.
            // Para segurança total com GLTFLoader, usamos toNonIndexed().
            g = g.toNonIndexed();
            
            g.applyMatrix4(c.matrixWorld);
            entry.geos.push(g);
        }
    });

    const mergedGroup = new THREE.Group();
    for (const entry of meshesByMat.values()) {
        if (entry.geos.length === 0) continue;
        try {
            const mergedGeo = BufferGeometryUtils.mergeGeometries(entry.geos, true);
            if (mergedGeo) {
                const mesh = new THREE.Mesh(mergedGeo, entry.material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mergedGroup.add(mesh);
            }
        } catch (err) {
            console.warn('[mergeStaticGLB] Falha ao fundir geometrias para um material:', err);
        }
    }
    return mergedGroup;
}

function criarRocha(scene, x, z, r = 0.6, contaminada = false) {
    _rockSpawnList.push({ scene, x, z, r, contaminada, chunk: z >= 0 ? 'N' : 'S' });
    // Collider individual (a hitbox usa o raio real)
    addCollider(new THREE.Box3(
        new THREE.Vector3(x - r * 0.75, 0, z - r * 0.75),
        new THREE.Vector3(x + r * 0.75, r, z + r * 0.75)
    ));
}

function _buildInstancedRocks() {
    if (_rockSpawnList.length === 0) return;
    // key = chunk + "_" + (contaminada ? 'c' : 'n')
    const groups = new Map();
    for (const s of _rockSpawnList) {
        const key = s.chunk + (s.contaminada ? '_c' : '_n');
        let g = groups.get(key);
        if (!g) {
            g = { items: [], contaminada: s.contaminada, scene: s.scene, cx: 0, cz: 0 };
            groups.set(key, g);
        }
        g.items.push(s);
        g.cx += s.x; g.cz += s.z;
    }
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion();
    const pos  = new THREE.Vector3();
    const scl  = new THREE.Vector3();
    const m4   = new THREE.Matrix4();
    for (const g of groups.values()) {
        const mat = g.contaminada ? matContRock : matRock;
        const im = new THREE.InstancedMesh(_rockGeoBase, mat, g.items.length);
        for (let i = 0; i < g.items.length; i++) {
            const it = g.items[i];
            quat.setFromAxisAngle(_yAxis, _hash2(it.x, it.z) * Math.PI * 2);
            pos.set(it.x, it.r * 0.5, it.z);
            scl.set(it.r, it.r, it.r);
            m4.compose(pos, quat, scl);
            im.setMatrixAt(i, m4);
        }
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = true;
        im.receiveShadow = true;
        im.computeBoundingSphere?.();
        // NÃO entra em cullables: o frontal-cull à granularidade do chunk
        // estava a fazer o chunk inteiro piscar quando o seu centróide
        // (a meio do mapa) cruzava o limiar do dot-product. Com 4 InstancedMesh
        // no total o ganho de cull manual é negligível; o three.js continua a
        // aplicar frustum culling pela bounding sphere do InstancedMesh.
        g.scene.add(im);
    }
    _rockSpawnList.length = 0;
}

// ---- zona de batalha ----
// Geometria: PlaneGeometry com bordas distorcidas por ruído → forma orgânica
function criarZonaBatalha(scene, cx, cz, raio, seed, tipo = 'wraith') {
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
    mesh.position.set(cx, 0.015, cz);
    mesh.renderOrder = -1;
    scene.add(mesh);

    const part = criarParticulasZona(scene, cx, cz, raio);
    const zoneMeshes = [mesh, part];

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
    box.tipo = tipo;
    grassZones.push(box);
    const zoneObj = { box, meshes: zoneMeshes, trees: [], scene, tipo };
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
    halo.position.set(cx, 0.010, cz);
    halo.renderOrder = -2;
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
    mesh.position.set(cx, 0.018, cz);
    mesh.renderOrder = -1;
    scene.add(mesh);

    criarParticulasZona(scene, cx, cz, raio);

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
    loader.load('assets/models/constructions/shop.glb', (gltf) => {
        gltf.scene.position.set(0, 0, 0);
        gltf.scene.scale.setScalar(0.5);
        gltf.scene.rotation.y = 0;
        gltf.scene.updateMatrixWorld(true);

        const optimized = mergeStaticGLB(gltf.scene);
        optimized.position.set(posX, 8.95, posZ);
        
        scene.add(optimized);
        fadeables.push(optimized);
        cullables.push(optimized);
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
    loader.load('assets/models/constructions/gobble-inn.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(0, 0, 0);
        m.scale.setScalar(scale);
        m.rotation.y = rotationY;
        m.updateMatrixWorld(true);

        // alinhar o fundo ao chão e aplicar offset Y opcional (negativo afunda)
        const bb0 = new THREE.Box3().setFromObject(m);
        m.position.y -= bb0.min.y;
        m.position.y += yOffset;
        m.updateMatrixWorld(true);

        const optimized = mergeStaticGLB(m);
        optimized.position.set(posX, 0, posZ);

        scene.add(optimized);
        fadeables.push(optimized);
        cullables.push(optimized);

        // bbox total apenas para referência (não usado para colisão)
        const bboxFull = new THREE.Box3().setFromObject(optimized);
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

        // Caixa de interação para entrar na taverna — pequena área junto à
        // porta real (X: -41.94, Z: 37.08) para o prompt "E" só aparecer perto.
        tavernEnterBox = new THREE.Box3(
            new THREE.Vector3(-42.80, 0,   36.20),
            new THREE.Vector3(-41.05, 2.5, 37.95),
        );
    }, undefined, e => console.error('Erro gobble-inn:', e));
}

// ---- POTION SHOP (Nova Construção) ----
function criarPotionShop(scene, cx, cz) {
    const loader = new GLTFLoader();
    const posX = cx, posZ = cz;
    loader.load('assets/models/constructions/potion.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(0, 0, 0);
        m.scale.setScalar(0.01);
        m.rotation.y = 0;
        m.traverse(c => {
            if (c.isMesh) {
                const name = c.name.toLowerCase();
                const isLantern = name.includes('latern001') || name.includes('latern003');
                c.castShadow = true;
                c.receiveShadow = true;
                if (c.material) {
                    const mats = Array.isArray(c.material) ? c.material : [c.material];
                    for (const mat of mats) {
                        const n = mat.name.toLowerCase();
                        if (isLantern || n.includes('lamp') || n.includes('yellow') || n.includes('light') || n.includes('glow') || n.includes('glass')) {
                            mat.emissive = new THREE.Color(0xffaa00);
                            mat.emissiveIntensity = 5.0;
                        }
                    }
                }
            }
        });

        m.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(m);
        m.position.y -= bb.min.y;
        m.position.y -= 2.1;
        m.updateMatrixWorld(true);

        const optimized = mergeStaticGLB(m);
        optimized.position.set(posX, 0, posZ);
        scene.add(optimized);

        // Chão interior (x:-21 a -15, z:-46 a -39) - Agora com profundidade 7
        const floorGeo = new THREE.PlaneGeometry(6, 7);
        const floorMat = new THREE.MeshStandardMaterial({ 
            map: madeiraTex, 
            color: 0xa08060, // Tom de madeira quente
            roughness: 0.7
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set(-18, 0.015, -42.5); // Centro ajustado para o novo tamanho (7/2)
        floorMesh.receiveShadow = true;
        scene.add(floorMesh);

        fadeables.push(optimized);
        cullables.push(optimized);
    }, undefined, e => console.error('Erro potion GLB:', e));

    // Paredes de colisão precisas solicitadas (x:-21 a -15, z:-46 a -39)
    const wallH = 4;
    const wallT = 0.2;
    // Norte (z=-39)
    addCollider(new THREE.Box3(new THREE.Vector3(-21, 0, -39 - wallT), new THREE.Vector3(-15, wallH, -39)));
    // Sul (z=-46)
    addCollider(new THREE.Box3(new THREE.Vector3(-21, 0, -46), new THREE.Vector3(-15, wallH, -46 + wallT)));
    // Oeste (x=-21)
    addCollider(new THREE.Box3(new THREE.Vector3(-21 - wallT, 0, -46), new THREE.Vector3(-21, wallH, -39)));
    // Este (x=-15)
    addCollider(new THREE.Box3(new THREE.Vector3(-15, 0, -46), new THREE.Vector3(-15 + wallT, wallH, -39)));
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
// Anel de cones-montanha à volta do mapa (versão original restaurada).
// Lambert em vez de Standard: as montanhas enchem grande parte do horizonte
// e PBR custa caro em pixels distantes onde a iluminação especular nem se
// vê. Lambert mantém aspecto facetado e poupa fragment work.
const matMountain = new THREE.MeshLambertMaterial({
    map: rockTex,
    color: 0x4a4a52, // Pedra escura
    flatShading: true
});
const matSnow = new THREE.MeshLambertMaterial({
    map: rockTex,
    color: 0xffffff, // Pedra clara (topo)
    flatShading: true
});

function criarPico(scene, x, z, h, r, rand) {
    const rotY = rand() * Math.PI;
    // corpo principal — cone facetado (6 lados, baixo poly mas estiliza bem)
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 6, 1),
        matMountain
    );
    cone.position.set(x, h / 2, z);
    cone.rotation.y = rotY;
    // Montanhas no perímetro do mapa: as sombras delas caem fora da área
    // de jogo. Desligar castShadow tira ~280 meshes do shadow pass.
    cone.castShadow = false;
    cone.receiveShadow = false;
    scene.add(cone);
    fadeables.push(cone);
    cullables.push(cone);

    // neve no topo: como na realidade, é só uma fina camada sobre o cume e
    // acompanha o afunilamento da montanha (NÃO pode ser mais larga que a
    // rocha por baixo). Como o cone tapera linearmente, o raio da montanha à
    // cota da base da neve é r*snowFrac; usamos uma margem mínima (1.06) só
    // para a neve assentar por cima sem z-fighting com a vertente.
    const snowFrac = 0.30;                 // fracção da altura coberta por neve
    const snowH = h * snowFrac;
    const snow = new THREE.Mesh(
        // mesmos 6 lados e mesma rotação que a montanha → facetas alinhadas
        new THREE.ConeGeometry(r * snowFrac * 1.06, snowH, 6, 1),
        matSnow
    );
    // ápice da neve coincide com o ápice da montanha
    snow.position.set(x, h - snowH / 2, z);
    snow.rotation.y = rotY;
    snow.castShadow = false;
    scene.add(snow);
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
    const RIO_GAP = 6;  // não coloca picos em |z| < RIO_GAP nos lados E/W (passagem do rio)

    const pontos = [];

    // lado norte (z = +BORDA)
    for (let x = -BORDA; x <= BORDA; x += PASSO)
        pontos.push([x + (rand() - 0.5) * JITTER, BORDA + rand() * 4]);

    // lado sul (z = -BORDA)
    for (let x = -BORDA; x <= BORDA; x += PASSO)
        pontos.push([x + (rand() - 0.5) * JITTER, -BORDA - rand() * 4]);

    // lado este (x = +BORDA) — salta os picos que tapariam o rio
    for (let z = -BORDA + PASSO; z < BORDA; z += PASSO) {
        if (Math.abs(z) < RIO_GAP) continue;
        pontos.push([BORDA + rand() * 4, z + (rand() - 0.5) * JITTER]);
    }

    // lado oeste (x = -BORDA) — salta os picos que tapariam o rio
    for (let z = -BORDA + PASSO; z < BORDA; z += PASSO) {
        if (Math.abs(z) < RIO_GAP) continue;
        pontos.push([-BORDA - rand() * 4, z + (rand() - 0.5) * JITTER]);
    }

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
// Margem de exclusão de árvores nos caminhos. O shader do terreno alarga
// a borda do caminho com ruído até ~1.9× a largura base (hw≈3.2 → ~6 u);
// a exclusão tem de ser MAIS larga (~7) para nenhuma árvore nascer sobre
// as lajes (textura PavingStones) do caminho.
const PATH_W = 7.0;
function naFaixaCaminho(x, z) {
    // caminho central vertical (norte e sul)
    if (Math.abs(x) < PATH_W) return true;
    // caminho horizontal para a shop (z≈25)
    if (z > 18 && z < 32 && x > -37 && x < 6) return true;
    // ramificação horizontal sul a z=-35
    if (z > -42 && z < -28 && x > -60 && x < 6) return true;
    // ramificação horizontal sul a z=-55
    if (z > -62 && z < -48 && x > -6 && x < 60) return true;
    // vertical oeste (x≈-45, z: -80→-35)
    if (z < -29 && z > -85 && Math.abs(x + 45) < PATH_W) return true;
    // vertical leste (x≈45, z: -85→-55)
    if (z < -49 && z > -90 && Math.abs(x - 45) < PATH_W) return true;
    return false;
}

// banda do rio + ponte (rio horizontal em z≈0): nenhuma árvore nasce na
// água, na ponte, nas bocas do rio nem na margem imediata — só relva.
// 10 cobre o sandBlend do shader do terreno (2.8 → 6.5+2.5 de noise ≈ 9.0),
// evitando árvores plantadas na faixa de areia da margem.
const RIO_BANDA = 10;
function naFaixaRio(z) {
    return Math.abs(z) < RIO_BANDA;
}

// ---- castelo exterior — GLB ----
function criarCastelo(scene) {
    const CX = 0, CZ = -80 ,CY =-1;
    const SCALE = 0.03;
    // dimensões aproximadas do modelo em unidades de jogo (após scale)
    const W = 18, D = 16, H = 7;

    const loader = new GLTFLoader();
    loader.load('assets/models/constructions/casttle.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(0, 0, 0);
        m.scale.setScalar(SCALE);
        m.updateMatrixWorld(true);

        const optimized = mergeStaticGLB(m);
        optimized.position.set(CX, 0, CZ);
        
        scene.add(optimized);
        fadeables.push(optimized);
        cullables.push(optimized);
    }, undefined, e => console.error('Erro castelo GLB:', e));

    // caminho de acesso ao portão (agora corrompido)
    const pathW = 3.5, pathD = 12;
    const pathGeo = new THREE.PlaneGeometry(pathW, pathD);
    const pathMat = matBattleGrass.clone();
    pathMat.uniforms.uTime = matBattleGrass.uniforms.uTime; // Partilha o tempo para animar
    pathMat.uniforms.uCenter = { value: new THREE.Vector2(0.5, 1.0) }; // Centro na porta (topo do rectângulo)
    
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    pathMesh.rotation.x = -Math.PI / 2;
    pathMesh.position.set(CX, 0.02, CZ + D/2 + 5.5);
    pathMesh.receiveShadow = true;
    scene.add(pathMesh);

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
    _criarGuardiao(scene, { addCollider, fadeables, cullables });
}

// ---- mapa principal ----
// estruturas grandes do mapa que NUNCA devem ter árvores/rochas em cima
const _estruturas = [
    { x: SHOP_CX, z: SHOP_CZ, r: 9 },   // loja
    { x: -44.9,   z: 33.5,    r: 12 },  // Gobble Inn (taverna)
    { x: 0,       z: -80,     r: 16 },  // castelo + muralhas
    { x: -18,     z: -42.5,   r: 7 },   // Potion Shop (6×7 em x:-21..-15, z:-46..-39)
    { x: 0,       z: 4.5,     r: 4 },   // guardião / saída da ponte
    { x: 70,      z: 70,      r: 4 },   // baú da coroa
    { x: -78,     z: 78,      r: 4 },   // baú da máscara
    // Santuários — sincronizados com src/world/santuarios.js
    { x:  62,     z:  52,     r: 3 },
    { x:  54,     z: -72,     r: 3 },
    { x: -68,     z: -64,     r: 3 },
    { x: -68,     z:  58,     r: 3 },
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
    criarPotionShop(scene, -18, -43);

    // --- Bruxa na Potion Shop (Coord Mundo) ---
    const BRUXA_WORLD_POS = new THREE.Vector3(-18, 0.81, -41);
    criarBruxa(scene, BRUXA_WORLD_POS);
    bruxaInteractBox = new THREE.Box3(
        new THREE.Vector3(BRUXA_WORLD_POS.x - 3.5, 0, BRUXA_WORLD_POS.z - 3.5),
        new THREE.Vector3(BRUXA_WORLD_POS.x + 3.5, 4, BRUXA_WORLD_POS.z + 3.5)
    );

    criarCastelo(scene);
    // zona corrupta ao redor do castelo (z=-80) — visual roxo, sem encontros
    criarZonaCorrupta(scene, 0, -80, 28, 111);

    // zonas de batalha norte do rio (perto da loja e da taverna) — NÚCLEO CORROMPIDO
    // (inimigo fraco, drops reduzidos, ideal para o início da aventura).
    const znB1 = criarZonaBatalha(scene,  28,  28, 12, 202, 'nucleo');
    const znB2 = criarZonaBatalha(scene,  28,  60, 10, 303, 'nucleo');
    const znB3 = criarZonaBatalha(scene, -28,  65,  9, 404, 'nucleo');

    // zonas de batalha sul (depois da ponte) — WRAITH ("SHACO CORROMPIDO"),
    // inimigo duro com HP e drops aumentados.
    const zsB1 = criarZonaBatalha(scene, -28, -20, 11, 505, 'wraith');
    const zsB2 = criarZonaBatalha(scene,  28, -20, 12, 606, 'wraith');
    const zsB3 = criarZonaBatalha(scene, -50, -50, 13, 707, 'wraith');
    const zsB4 = criarZonaBatalha(scene,  50, -50, 13, 808, 'wraith');

    const rand = seededRand(1);

    // árvores norte — densa, cobre toda a área afastada dos caminhos
    let placed = 0;
    for (let i = 0; i < 2000 && placed < 180; i++) {
        const x = (rand() * 2 - 1) * 94;
        const z = 5 + rand() * 90;
        if (naFaixaCaminho(x, z)) continue;
        if (naFaixaRio(z)) continue;
        // Na vila (onde estão a shop e a taverna), permitimos árvores mas com margem maior das estruturas
        const margemExtra = naVila(x, z) ? 2.5 : 0; 
        if (!_longeDeEstruturas(x, z, margemExtra)) continue;
        if (!_longeDeProps(x, z, MIN_DIST_ARVORES / 2)) continue;
        const zoneRef = _findZoneAt(x, z, [znB1, znB2, znB3]);
        criarArvore(scene, x, z, !!zoneRef, zoneRef);
        _registaProp(x, z, MIN_DIST_ARVORES / 2);
        placed++;
    }

    // árvores sul — ainda mais densas e escuras
    placed = 0;
    for (let i = 0; i < 1800 && placed < 150; i++) {
        const x = (rand() * 2 - 1) * 94;
        const z = -(5 + rand() * 90);
        if (naFaixaCaminho(x, z)) continue;
        if (naFaixaRio(z)) continue;
        if (naVila(x, z)) continue;
        if (!_longeDeEstruturas(x, z)) continue;
        if (!_longeDeProps(x, z, MIN_DIST_ARVORES / 2)) continue;
        const zoneRef = _findZoneAt(x, z, [zsB1, zsB2, zsB3, zsB4]);
        criarArvore(scene, x, z, !!zoneRef, zoneRef);
        _registaProp(x, z, MIN_DIST_ARVORES / 2);
        placed++;
    }

    // Remove uma árvore duplicada perto de (-15, -12): havia duas demasiado
    // próximas que o filtro de distância não apanhou. Mantém só a primeira.
    {
        const ALVO_X = -15, ALVO_Z = -12, R2 = 2.5 * 2.5;
        let mantida = false;
        for (let i = _treeSpawnList.length - 1; i >= 0; i--) {
            const t = _treeSpawnList[i];
            const dx = t.x - ALVO_X, dz = t.z - ALVO_Z;
            if (dx * dx + dz * dz < R2) {
                if (mantida) _treeSpawnList.splice(i, 1);
                else mantida = true;
            }
        }
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

    // Santuários e cogumelos brilhantes — decoração + buff permanente.
    // Os santuários têm colisão (pedestal sólido).
    criarSantuarios(scene, addCollider);
    criarCogumelos(scene);

    // baú escondido (canto do mapa, longe dos caminhos e da zona corrupta)
    _bau = new Bau(scene, 70, 0, 70, 'coroa_magica');
    colliders.push({ box: _bau.getColliderBox(), isRiver: false }); _gridDirty = true;

    // baú secreto da Máscara do Eclipse — canto sudoeste, profundo
    _bauMascara = new Bau(scene, -78, 0, 78, 'mascara_eclipse', Math.PI * 0.25);
    colliders.push({ box: _bauMascara.getColliderBox(), isRiver: false }); _gridDirty = true;

    // Sinaliza ao builder de árvores que pode construir o forest (se o GLB
    // já carregou) ou marcar para construir assim que o load terminar.
    _criarMapaDone = true;
    _tryBuildForest();
    _buildInstancedRocks();
    criarVegetacao(scene);
    setVegetacaoZonas(grassZones);
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
        // Restaura cor natural dos materiais corrompidos desta zona. Com o
        // sistema instanciado, as árvores partilham materiais por bucket
        // de corrupção — operamos directamente sobre o conjunto registado
        // em zoneRef.materials durante o build do forest.
        const matSnaps = [];
        if (zo.materials) {
            for (const mat of zo.materials) {
                if (!mat.userData.cleanColor) continue;
                matSnaps.push({
                    mat,
                    corruptColor:    mat.color.clone(),
                    corruptEmissive: mat.emissive.clone(),
                    corruptIntensity: mat.emissiveIntensity,
                });
                mat.color.copy(mat.userData.cleanColor);
                mat.emissive.setRGB(0, 0, 0);
                mat.emissiveIntensity = 0;
            }
        }
        // retira do array de encontros
        const gi = grassZones.indexOf(zo.box);
        if (gi !== -1) grassZones.splice(gi, 1);
        
        // Atualiza vegetação instanciada para aparecer nesta zona
        atualizarVegetacaoZonas(grassZones);
        battleZoneObjects.splice(i, 1);

        _clearedZones.push({ zoneObj: zo, matSnaps });
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
        const { zoneObj, matSnaps } = _clearedZones.pop();
        for (const m of zoneObj.meshes) zoneObj.scene.add(m);
        for (const s of (matSnaps || [])) {
            s.mat.color.copy(s.corruptColor);
            s.mat.emissive.copy(s.corruptEmissive);
            s.mat.emissiveIntensity = s.corruptIntensity;
        }
        grassZones.push(zoneObj.box);
        battleZoneObjects.push(zoneObj);
        restored++;
    }
    if (restored > 0) atualizarVegetacaoZonas(grassZones);
    // Santuários NÃO resetam ao dormir — bênção é permanente.
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


