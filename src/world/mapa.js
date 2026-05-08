import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

export const mapBounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };

const colliders = [];
let bridgePassage = null;
export const grassZones = [];       // Box3[] — zonas onde há encontros
export const battleZoneObjects = []; // [{box, meshes[], scene}] — para limpar após vitória
export let shopDoorInteract = null;
export let guardianInteractBox = null;
let _guardianMesh = null;
let _guardianColliderBox = null;
let _guardianMoving = false;
let _guardianWalkTime = 0;
let _guardianPhase = 0; // 0: idle, 1: rotating to side, 2: walking, 3: rotating to front

export function updateGuardiao(deltaTime) {
    if (!_guardianMesh || !_guardianMoving) return;

    if (_guardianPhase === 0) _guardianPhase = 1;

    if (_guardianPhase === 1) {
        const targetRot = -Math.PI / 2; // Virado para a direita (-x do ponto de vista do mundo, mas é a direita do guarda)
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
        } else {
            _guardianMesh.rotation.y += Math.sign(diff) * rotSpeed;
        }
    }
}

let riverMesh = null;

// ---- texturas base ----
const loader3 = new THREE.TextureLoader();

function loadTex(path, rx, ry) {
    return loader3.load(path, t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry);
        t.anisotropy = 16;
    });
}

// escala de tile: 1 tile a cada 6 unidades de mundo
const TS = 6;
const W_MAP = 200, H_MAP_HALF = 95; // dimensões de cada metade

const grassTex = loadTex('../../assets/textures/relva.png', W_MAP/TS, H_MAP_HALF/TS);
const terraTex = loadTex('../../assets/textures/terra.png',    W_MAP/TS, H_MAP_HALF/TS);
const areiaTex = loadTex('../../assets/textures/areia.png',    W_MAP/TS, H_MAP_HALF/TS);
const madeiraTex = loader3.load('../../assets/textures/madeira.png', t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
});
const madeira2Tex = loader3.load('../../assets/textures/madeira2.png', t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
});

// shader de terreno via onBeforeCompile — herda sombras/luzes do MeshStandardMaterial
function makeTerrainShader(grassCol, pathColor) {
    const mat = new THREE.MeshStandardMaterial({
        map: grassTex,   // textura base para o pipeline standard (sombras, etc.)
        color: new THREE.Color(grassCol),
        roughness: 0.9,
    });

    const extraUniforms = {
        uGrass:    { value: grassTex },
        uDirt:     { value: terraTex },
        uSand:     { value: areiaTex },
        uGrassCol: { value: new THREE.Color(grassCol) },
        uDirtCol:  { value: new THREE.Color(pathColor) },
        uRiverZ:   { value: 0.0 },
        // caminhos verticais (x fixo, correm ao longo de Z)
        uVPath0X: { value:  0.0 }, uVPath0W: { value: 3.2 }, uVPath0Z0: { value:-100.0 }, uVPath0Z1: { value: 100.0 },
        uVPath1X: { value:999.0 }, uVPath1W: { value: 3.2 }, uVPath1Z0: { value:   0.0 }, uVPath1Z1: { value:   0.0 },
        uVPath2X: { value:999.0 }, uVPath2W: { value: 3.2 }, uVPath2Z0: { value:   0.0 }, uVPath2Z1: { value:   0.0 },
        // caminhos horizontais (z fixo, correm ao longo de X)
        uHPath0Z: { value:999.0 }, uHPath0W: { value: 3.2 }, uHPath0X0: { value:  0.0 }, uHPath0X1: { value:   0.0 },
        uHPath1Z: { value:999.0 }, uHPath1W: { value: 3.2 }, uHPath1X0: { value:  0.0 }, uHPath1X1: { value:   0.0 },
        uHPath2Z: { value:999.0 }, uHPath2W: { value: 3.2 }, uHPath2X0: { value:  0.0 }, uHPath2X1: { value:   0.0 },
    };

    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, extraUniforms);

        // passa posição mundo ao fragment
        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
        ).replace(
            'void main() {',
            'varying vec3 vWorldPos;\nvoid main() {'
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            'void main() {',
            `varying vec3 vWorldPos;
            uniform sampler2D uGrass, uDirt, uSand;
            uniform vec3 uGrassCol, uDirtCol;
            uniform float uRiverZ;
            uniform float uVPath0X,uVPath0W,uVPath0Z0,uVPath0Z1;
            uniform float uVPath1X,uVPath1W,uVPath1Z0,uVPath1Z1;
            uniform float uVPath2X,uVPath2W,uVPath2Z0,uVPath2Z1;
            uniform float uHPath0Z,uHPath0W,uHPath0X0,uHPath0X1;
            uniform float uHPath1Z,uHPath1W,uHPath1X0,uHPath1X1;
            uniform float uHPath2Z,uHPath2W,uHPath2X0,uHPath2X1;

            float _hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
            float _sn(vec2 p){
                vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
                return mix(mix(_hash(i),_hash(i+vec2(1,0)),f.x),
                           mix(_hash(i+vec2(0,1)),_hash(i+vec2(1,1)),f.x),f.y);
            }
            float _fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*_sn(p);p=p*2.1+vec2(1.7,9.2);a*=0.5;} return v; }

            float vPathBlend(float wx, float wz, float cx, float hw, float z0, float z1) {
                if (wz < z0-1.0 || wz > z1+1.0) return 0.0;
                float d = abs(wx - cx);
                float n = _fbm(vec2(wz*0.18+cx*0.07, wx*0.11)) * hw * 0.8;
                float zf = smoothstep(z0-0.5,z0+3.0,wz)*smoothstep(z1+0.5,z1-3.0,wz);
                return (1.0 - smoothstep(hw*0.5-0.3, hw*1.1+n, d)) * zf;
            }
            float hPathBlend(float wz, float wx, float wz_c, float hw, float x0, float x1) {
                if (wx < x0-1.0 || wx > x1+1.0) return 0.0;
                float d = abs(wz - wz_c);
                float n = _fbm(vec2(wx*0.15+wz_c*0.09, wz*0.12)) * hw * 0.8;
                float xf = smoothstep(x0-0.5,x0+3.0,wx)*smoothstep(x1+0.5,x1-3.0,wx);
                return (1.0 - smoothstep(hw*0.5-0.3, hw*1.1+n, d)) * xf;
            }
            float sandBlend(float wz, float rz) {
                float d = abs(wz - rz);
                float n = _fbm(vec2(vWorldPos.x*0.12, wz*0.14+1.3)) * 2.5;
                return 1.0 - smoothstep(2.8, 6.5+n, d);
            }
            void main() {`
        ).replace(
            '#include <map_fragment>',
            `// blending das 3 texturas em coordenadas mundo
            vec2 tuv = vWorldPos.xz / 6.0;
            vec4 cGrass = texture2D(uGrass, tuv) * vec4(uGrassCol, 1.0);
            vec4 cDirt  = texture2D(uDirt,  tuv) * vec4(uDirtCol,  1.0);
            vec4 cSand  = texture2D(uSand,  tuv) * vec4(1.00, 0.87, 0.62, 1.0);

            float dirtMask = 0.0;
            float wx = vWorldPos.x, wz = vWorldPos.z;
            dirtMask = max(dirtMask, vPathBlend(wx,wz, uVPath0X,uVPath0W,uVPath0Z0,uVPath0Z1));
            dirtMask = max(dirtMask, vPathBlend(wx,wz, uVPath1X,uVPath1W,uVPath1Z0,uVPath1Z1));
            dirtMask = max(dirtMask, vPathBlend(wx,wz, uVPath2X,uVPath2W,uVPath2Z0,uVPath2Z1));
            dirtMask = max(dirtMask, hPathBlend(wz,wx, uHPath0Z,uHPath0W,uHPath0X0,uHPath0X1));
            dirtMask = max(dirtMask, hPathBlend(wz,wx, uHPath1Z,uHPath1W,uHPath1X0,uHPath1X1));
            dirtMask = max(dirtMask, hPathBlend(wz,wx, uHPath2Z,uHPath2W,uHPath2X0,uHPath2X1));
            float sandMask = sandBlend(vWorldPos.z, uRiverZ);

            vec4 blended = cGrass;
            blended = mix(blended, cSand, sandMask);
            blended = mix(blended, cDirt, dirtMask);
            diffuseColor = blended;`
        );

        // guardar ref para poder atualizar uniforms depois
        mat.userData.shader = shader;
    };

    // proxy para aceder a uniforms após compilação
    mat.uniforms = extraUniforms;
    return mat;
}

const matTerrainN = makeTerrainShader(0x9ec87a, 0xd4b882);
const matTerrainS = makeTerrainShader(0x9ec87a, 0xd4b882);

const matRock     = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
const matMountain  = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 1.0, flatShading: true });
const matSnow      = new THREE.MeshStandardMaterial({ color: 0xdde8f0, roughness: 0.8, flatShading: true });

export let castleEnterBox = null;

// ---- shader de batalha — solo roxo  ----
export const matBattleGrass = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying float vEdge; // 0=centro, 1=borda
        void main() {
            vUv = uv;
            // quanto mais longe do centro (0.5,0.5), mais perto da borda
            vEdge = length(uv - 0.5) * 2.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vEdge;

        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float sn(vec2 p){
            vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.5;
            for(int i=0;i<3;i++){v+=a*sn(p);p=p*2.1+vec2(3.1,1.7);a*=0.5;}
            return v;
        }

        void main(){
            // Máscara circular distorcida com FBM — torna a borda irregular
            vec2 centered = vUv - 0.5;
            float angle = atan(centered.y, centered.x);
            float dist  = length(centered);

            // distorção orgânica da borda com ruído
            float warp = fbm(vec2(angle * 2.0, uTime * 0.15) + 0.5) * 0.22;
            float mask = smoothstep(0.50 + warp, 0.38 + warp, dist);

            if (mask < 0.01) discard; // fora da zona — transparente

            // ruído base para textura interna
            float n  = fbm(vUv * 12.0 + vec2(uTime * 0.04, 0.0));
            float n2 = fbm(vUv *  6.0 - vec2(0.0, uTime * 0.03) + 5.3);

            // brilhos roxos que pulsam (indicam perigo)
            float sparkle = pow(sn(vUv * 35.0 + uTime * 0.5), 7.0);
            float pulse   = 0.5 + 0.5 * sin(uTime * 2.2);

            vec3 dark    = vec3(0.18, 0.04, 0.28); // roxo escuro
            vec3 mid     = vec3(0.38, 0.10, 0.55); // violeta
            vec3 bright  = vec3(0.65, 0.20, 0.90); // púrpura vivo
            vec3 spark   = vec3(0.85, 0.40, 1.00); // brilho mágico

            vec3 col = mix(dark, mid,   n  * 0.6 + n2 * 0.4);
            col      = mix(col, bright, sparkle * pulse * 0.7);
            col      = mix(col, spark,  sparkle * 0.4);

            // borda mais clara/brilhante para delimitar a zona
            float borderGlow = smoothstep(0.36 + warp, 0.50 + warp, dist) * mask;
            col = mix(col, vec3(0.80, 0.30, 1.00), borderGlow * 0.65 * (0.7 + 0.3 * pulse));

            gl_FragColor = vec4(col, mask * 0.95);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
});

// ---- shader de água: ondas vertex, FBM em camadas, brilho do sol, espuma nas margens ----
export const matWater = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying float vWave;
        uniform float uTime;
        void main() {
            vUv = uv;
            vec3 pos = position;
            // O plano está na xy local; após a rotação -PI/2 em x, z local vira y mundo.
            // Vagas SÓ SOBEM a partir da base (sin*0.5+0.5 → 0..1) — assim nunca descem abaixo da areia.
            float a = (sin(pos.x * 0.45 + uTime * 1.4) * 0.5 + 0.5) * 0.050;
            float b = (sin(pos.x * 0.85 - pos.y * 0.6 + uTime * 1.9) * 0.5 + 0.5) * 0.030;
            float c = (sin(pos.y * 1.6 + uTime * 0.8) * 0.5 + 0.5) * 0.018;
            float wave = a + b + c;
            pos.z += wave;
            vWave = wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sn(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
            return mix(mix(hash(i),           hash(i + vec2(1, 0)), f.x),
                       mix(hash(i + vec2(0,1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 5; i++) { v += a * sn(p); p = p * 2.05 + vec2(1.7, 9.2); a *= 0.5; }
            return v;
        }

        void main() {
            // Coordenadas esticadas para a forma do rio (longo em x, estreito em y)
            vec2 p = vec2(vUv.x * 14.0, vUv.y * 3.0);

            // Duas camadas FBM em direções opostas → textura caótica de água
            float n1 = fbm(p + vec2(-uTime * 0.45, sin(uTime * 0.3) * 0.4));
            float n2 = fbm(p * 1.7 + vec2(-uTime * 0.65 + 4.7, uTime * 0.18));
            float w = mix(n1, n2, 0.5);

            // Cintilações finas perpendiculares ao fluxo
            float ripple = sin((vUv.x * 90.0 + n1 * 6.0) - uTime * 4.2) * 0.5 + 0.5;
            ripple = pow(ripple, 16.0);

            // Brilho do sol — banda lenta a deslocar-se ao longo do rio
            float glint = pow(sn(vec2(vUv.x * 5.0 - uTime * 0.4, vUv.y * 2.5)), 8.0);

            // Gradiente de cor com profundidade
            vec3 deep    = vec3(0.02, 0.10, 0.30);
            vec3 mid     = vec3(0.08, 0.40, 0.72);
            vec3 surface = vec3(0.35, 0.78, 0.96);
            vec3 col = mix(deep, mid, smoothstep(0.20, 0.55, w));
            col = mix(col, surface, smoothstep(0.55, 0.85, w));

            // Cintilações + brilho do sol
            col += vec3(0.65, 0.88, 1.0) * ripple * 0.55;
            col += vec3(1.0, 0.95, 0.7) * glint * 0.30;

            // Sombra suave nos vales das vagas
            col *= 1.0 + vWave * 4.0;

            // Espuma nas margens (vUv.y perto de 0 ou 1)
            float bankDist = 1.0 - abs(vUv.y - 0.5) * 2.0;
            float foamMask = smoothstep(0.20, 0.0, bankDist);
            float foamBreak = sn(vec2(vUv.x * 30.0 + uTime * 1.8, vUv.y * 8.0 + uTime * 0.4));
            float foam = clamp(foamMask * (0.5 + foamBreak * 0.6), 0.0, 1.0);
            col = mix(col, vec3(0.94, 0.98, 1.0), foam * 0.55);

            gl_FragColor = vec4(col, 0.93);
        }
    `,
});

// ---- utilitários ----
function addCollider(box, isRiver = false) { colliders.push({ box, isRiver }); }

export function removerGuardiao() {
    if (!_guardianColliderBox) return;
    const i = colliders.findIndex(c => c.box === _guardianColliderBox);
    if (i !== -1) colliders.splice(i, 1);
    _guardianColliderBox = null;
    guardianInteractBox = null;
    _guardianMoving = true; // Ativa o movimento para o lado
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

// ---- materiais contaminados — cor natural escurecida com tinge roxo subtil ----
export const matContTrunk  = new THREE.MeshStandardMaterial({ color: 0x3a2830, emissive: 0x220033, emissiveIntensity: 0.3, roughness: 0.85 });
export const matContLeaves = new THREE.MeshStandardMaterial({ color: 0x1e3020, emissive: 0x1a0028, emissiveIntensity: 0.35, roughness: 0.85 });
export const matContRock   = new THREE.MeshStandardMaterial({ color: 0x5a5060, emissive: 0x1a0030, emissiveIntensity: 0.25, roughness: 0.95 });

// ---- árvore GLB ----
let treeTemplate = null;       // THREE.Group clonável, preenchido após o load
const treePendingQueue = [];   // { scene, x, z, contaminada, zoneRef } — aguardam o load

const treeLoader = new GLTFLoader();
treeLoader.load('../../assets/models/tree.glb', (gltf) => {
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
// matCorruptHalo: tonalidade roxa-escura que se espalha pelo terreno circundante
const matCorruptHalo = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sn(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
        }
        float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*sn(p);p=p*2.1+vec2(1.7,9.2);a*=0.5;} return v; }

        void main() {
            vec2 c = vUv - 0.5;
            float dist = length(c);

            // distorção orgânica da borda
            float angle = atan(c.y, c.x);
            float warp = fbm(vec2(angle * 1.5, uTime * 0.06) + 3.7) * 0.18;

            // máscara: forte no centro, desvanece suavemente até à borda
            float innerEdge = 0.18 + warp;
            float outerEdge = 0.50 + warp * 0.5;
            float mask = smoothstep(outerEdge, innerEdge, dist);

            if (mask < 0.005) discard;

            // ruído de textura para não parecer plano
            float n = fbm(vUv * 8.0 + vec2(uTime * 0.02, 0.0));
            float pulse = 0.5 + 0.5 * sin(uTime * 1.4);

            // cor: preto com tinge roxa; mais escuro no centro
            vec3 black  = vec3(0.02, 0.00, 0.04);
            vec3 purple = vec3(0.22, 0.04, 0.32);
            vec3 col = mix(black, purple, n * 0.5 + 0.15 * pulse);

            // brilho subtil na borda de transição
            float borderGlow = smoothstep(innerEdge + 0.04, outerEdge, dist) * mask;
            col = mix(col, vec3(0.50, 0.10, 0.65), borderGlow * 0.4 * (0.6 + 0.4 * pulse));

            gl_FragColor = vec4(col, mask * 0.82);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
});

export { matCorruptHalo };

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
    loader.load('../../assets/models/shop.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(posX , 0, posZ);
        m.scale.setScalar(0.08);
        m.rotation.y = Math.PI / 2;
        m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(m);
    }, undefined, e => console.error('Erro loja:', e));

    const hx = 6.5, hz = 8.0, hy = 4.0;
    makeBox(hx, hy, hz, new THREE.MeshBasicMaterial({ visible: false }), posX, hy / 2, posZ, scene, true);
    shopDoorInteract = new THREE.Box3(
        new THREE.Vector3(posX + hx / 2 - 0.5, 0, posZ - 2),
        new THREE.Vector3(posX + hx / 2 + 3.0, 3.0, posZ + 2)
    );
}

// ---- rio ----
const BRIDGE_WIDTH = 5.2;
const BRIDGE_ARC_WIDTH = 7.4;
const BRIDGE_ARC_HEIGHT = 0.6;
const BRIDGE_Z = 0;

export function getBridgeHeight(x, z) {
    const dx = Math.abs(x);
    const dz = Math.abs(z - BRIDGE_Z);
    // Se estiver fora da largura da ponte ou fora do comprimento do arco
    if (dx > BRIDGE_WIDTH / 2 || dz > BRIDGE_ARC_WIDTH / 2) return 0;
    
    // Mesma fórmula da criação: h = arcHeight * (1 - (2*z/W)^2) - 0.05
    const h = BRIDGE_ARC_HEIGHT * (1 - Math.pow((2 * dz) / BRIDGE_ARC_WIDTH, 2)) - 0.05;
    return Math.max(0, h + 0.15); // +0.15 para ficar sobre o tabuleiro
}

function criarRio(scene) {
    const RW = 6, RL = 210, RZ = BRIDGE_Z;
    riverMesh = new THREE.Mesh(new THREE.PlaneGeometry(RL, RW, 140, 16), matWater);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(0, 0.05, RZ);
    riverMesh.receiveShadow = true;
    scene.add(riverMesh);

    addCollider(new THREE.Box3(
        new THREE.Vector3(-RL / 2, -1, RZ - RW / 2),
        new THREE.Vector3(RL / 2, 2, RZ + RW / 2)
    ), true);

    const BX = 0;
    const BW = BRIDGE_WIDTH;
    
    // Materiais com a nova textura de madeira
    const matWood = new THREE.MeshStandardMaterial({ 
        map: madeiraTex, 
        color: 0xffffff, 
        roughness: 0.9,
        side: THREE.DoubleSide
    });
    const matWoodDark = new THREE.MeshStandardMaterial({ 
        map: madeira2Tex, 
        color: 0x888888, 
        roughness: 0.95,
        side: THREE.DoubleSide
    });
    const matStone = new THREE.MeshStandardMaterial({ color: 0x888078, roughness: 0.95 });

    // --- Tabuleiro em arco ---
    const bridgeGroup = new THREE.Group();
    const arcSegments = 10;
    const arcWidth = BRIDGE_ARC_WIDTH;
    const arcHeight = BRIDGE_ARC_HEIGHT;

    for (let i = 0; i < arcSegments; i++) {
        const t0 = i / arcSegments;
        const t1 = (i + 1) / arcSegments;
        
        const z0 = (t0 - 0.5) * arcWidth;
        const z1 = (t1 - 0.5) * arcWidth;
        const zCenter = (z0 + z1) / 2;
        
        const hCenter = arcHeight * (1 - Math.pow((2 * zCenter) / arcWidth, 2)) - 0.05;
        
        const segLen = (arcWidth / arcSegments) + 0.05;
        
        // Clonar materiais para ajustar o repeat da textura em cada parte
        const mWoodSeg = matWood.clone();
        mWoodSeg.map = madeiraTex.clone();
        mWoodSeg.map.wrapS = mWoodSeg.map.wrapT = THREE.RepeatWrapping;
        mWoodSeg.map.repeat.set(BW / 2, segLen / 2);
        mWoodSeg.map.needsUpdate = true;

        const seg = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.25, segLen), mWoodSeg);
        seg.position.set(0, hCenter, zCenter);
        const angle = -Math.atan2(arcHeight * -8 * zCenter / (arcWidth * arcWidth), 1);
        seg.rotation.x = angle;
        seg.castShadow = true; seg.receiveShadow = true;
        bridgeGroup.add(seg);

        for (const side of [-1, 1]) {
            const mWoodDarkBeam = matWoodDark.clone();
            mWoodDarkBeam.map = madeira2Tex.clone();
            mWoodDarkBeam.map.wrapS = mWoodDarkBeam.map.wrapT = THREE.RepeatWrapping;
            mWoodDarkBeam.map.repeat.set(0.5, segLen / 2);
            mWoodDarkBeam.map.needsUpdate = true;

            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, segLen), mWoodDarkBeam);
            beam.position.set(side * (BW / 2 - 0.2), hCenter - 0.3, zCenter);
            beam.rotation.x = angle;
            bridgeGroup.add(beam);
        }

        const nPlanks = 2;
        for (let j = 0; j < nPlanks; j++) {
            const pz = z0 + (j + 0.5) * (segLen / nPlanks);
            const ph = arcHeight * (1 - Math.pow((2 * pz) / arcWidth, 2)) + 0.08;
            
            const mWoodPlank = matWood.clone();
            mWoodPlank.map = madeiraTex.clone();
            mWoodPlank.map.wrapS = mWoodPlank.map.wrapT = THREE.RepeatWrapping;
            mWoodPlank.map.repeat.set(BW / 2, 0.2);
            mWoodPlank.map.needsUpdate = true;

            const plank = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.2, 0.08, 0.25), mWoodPlank);
            plank.position.set((Math.random() - 0.5) * 0.1, ph, pz);
            plank.rotation.x = angle;
            plank.rotation.y = (Math.random() - 0.5) * 0.05;
            plank.castShadow = true;
            bridgeGroup.add(plank);
        }
    }
    bridgeGroup.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(bridgeGroup);

    // --- Parapeitos e Postes ---
    for (const sx of [-BW / 2 + 0.1, BW / 2 - 0.1]) {
        const nPosts = 5;
        const posts = [];
        for (let i = 0; i < nPosts; i++) {
            const t = i / (nPosts - 1);
            const pz = (t - 0.5) * arcWidth;
            const ph = arcHeight * (1 - Math.pow((2 * pz) / arcWidth, 2)) + 0.4;
            
            const mPost = matWoodDark.clone();
            mPost.map = madeira2Tex.clone();
            mPost.map.wrapS = mPost.map.wrapT = THREE.RepeatWrapping;
            mPost.map.repeat.set(0.2, 1);
            mPost.map.needsUpdate = true;

            const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), mPost);
            post.position.set(sx, ph, pz);
            post.rotation.y = Math.random() * 0.2;
            post.castShadow = true; post.receiveShadow = true;
            scene.add(post);
            posts.push(post);

            // Colisor individual para cada poste — muito mais preciso
            addCollider(new THREE.Box3(
                new THREE.Vector3(BX + sx - 0.2, ph - 0.75, pz - 0.11),
                new THREE.Vector3(BX + sx + 0.2, ph + 0.75, pz + 0.11)
            ));
        }

        for (let i = 0; i < nPosts - 1; i++) {
            const p1 = posts[i].position;
            const p2 = posts[i+1].position;
            const dist = p1.distanceTo(p2);
            
            const mRail = matWood.clone();
            mRail.map = madeiraTex.clone();
            mRail.map.wrapS = mRail.map.wrapT = THREE.RepeatWrapping;
            mRail.map.repeat.set(dist / 2, 0.2);
            mRail.map.needsUpdate = true;

            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, dist + 0.1), mRail);
            rail.position.set(sx, (p1.y + p2.y) / 2 + 0.35, (p1.z + p2.z) / 2);
            rail.lookAt(sx, (p1.y + p2.y) / 2 + 0.35, p2.z);
            rail.castShadow = true; rail.receiveShadow = true;
            scene.add(rail);

            const mRailMid = matWoodDark.clone();
            mRailMid.map = madeira2Tex.clone();
            mRailMid.map.wrapS = mRailMid.map.wrapT = THREE.RepeatWrapping;
            mRailMid.map.repeat.set(dist / 2, 0.1);
            mRailMid.map.needsUpdate = true;

            const railMid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, dist + 0.1), mRailMid);
            railMid.position.set(sx, (p1.y + p2.y) / 2 - 0.1, (p1.z + p2.z) / 2);
            railMid.lookAt(sx, (p1.y + p2.y) / 2 - 0.1, p2.z);
            railMid.castShadow = true; railMid.receiveShadow = true;
            scene.add(railMid);


            // Colisor para o corrimão entre postes
            addCollider(new THREE.Box3(
                new THREE.Vector3(BX + sx - 0.1, Math.min(p1.y, p2.y) - 0.2, Math.min(p1.z, p2.z)),
                new THREE.Vector3(BX + sx + 0.1, Math.max(p1.y, p2.y) + 0.6, Math.max(p1.z, p2.z))
            ));
        }
    }

    bridgePassage = new THREE.Box3(
        new THREE.Vector3(BX - BW / 2 + 0.4, -2, RZ - arcWidth / 2 - 0.8),
        new THREE.Vector3(BX + BW / 2 - 0.4,  4, RZ + arcWidth / 2 + 0.8)
    );
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
    loader.load('../../assets/models/casttle.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(CX, 0, CZ);
        m.scale.setScalar(SCALE);
        m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(m);
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
export function criarMapa(scene) {
    criarTerrenoNorte(scene);
    criarTerrenoSul(scene);
    criarRio(scene);
    criarGuardiao(scene);
    criarShop(scene, SHOP_CX, SHOP_CZ);
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
    for (let i = 0; i < 600 && placed < 200; i++) {
        const x = (rand() * 2 - 1) * 94;
        const z = 5 + rand() * 90;
        if (naFaixaCaminho(x, z) || zonaLivre(x, z, 8)) continue;
        const zoneRef = _findZoneAt(x, z, [znB1, znB2, znB3]);
        criarArvore(scene, x, z, !!zoneRef, zoneRef);
        placed++;
    }

    // árvores sul — ainda mais densas e escuras
    placed = 0;
    for (let i = 0; i < 700 && placed < 250; i++) {
        const x = (rand() * 2 - 1) * 94;
        const z = -(5 + rand() * 90);
        if (naFaixaCaminho(x, z)) continue;
        const zoneRef = _findZoneAt(x, z, [zsB1, zsB2, zsB3, zsB4]);
        criarArvore(scene, x, z, !!zoneRef, zoneRef);
        placed++;
    }

    // rochas norte
    placed = 0;
    for (let i = 0; i < 150 && placed < 50; i++) {
        const x = (rand() * 2 - 1) * 90;
        const z = 5 + rand() * 88;
        if (naFaixaCaminho(x, z) || zonaLivre(x, z, 9)) continue;
        criarRocha(scene, x, z, 0.3 + rand() * 0.5, emZonaBatalha(x, z));
        placed++;
    }

    // rochas sul
    placed = 0;
    for (let i = 0; i < 150 && placed < 50; i++) {
        const x = (rand() * 2 - 1) * 90;
        const z = -(5 + rand() * 88);
        if (naFaixaCaminho(x, z)) continue;
        criarRocha(scene, x, z, 0.3 + rand() * 0.6, emZonaBatalha(x, z));
        placed++;
    }

    criarMontanhas(scene);
    console.log('Mapa criado.');
}

// remove visualmente uma zona de batalha e retira-a dos encontros
export function limparZonaBatalha(playerX, playerZ) {
    const pt = new THREE.Vector3(playerX, 0.5, playerZ);
    for (let i = 0; i < battleZoneObjects.length; i++) {
        const zo = battleZoneObjects[i];
        if (!zo.box.containsPoint(pt)) continue;
        // remove meshes roxos da zona (solo + tufos)
        for (const m of zo.meshes) zo.scene.remove(m);
        // restaura cor natural das árvores contaminadas desta zona
        for (const tree of zo.trees) {
            tree.traverse(c => {
                if (!c.isMesh || !c.material.userData.cleanColor) return;
                c.material.color.copy(c.material.userData.cleanColor);
                c.material.emissive.setRGB(0, 0, 0);
                c.material.emissiveIntensity = 0;
            });
        }
        // retira do array de encontros
        const gi = grassZones.indexOf(zo.box);
        if (gi !== -1) grassZones.splice(gi, 1);
        battleZoneObjects.splice(i, 1);
        return true;
    }
    return false;
}

// zonas sul: z > 0 (áreas iniciais e loja)
export function zonasSulLimpas() {
    return !battleZoneObjects.some(zo => zo.box.min.z > 0);
}

export function verificaColisao(futuroX, futuroZ) {
    if (futuroX < mapBounds.minX || futuroX > mapBounds.maxX ||
        futuroZ < mapBounds.minZ || futuroZ > mapBounds.maxZ) return true;
    const r = 0.25;
    const pb = new THREE.Box3(
        new THREE.Vector3(futuroX - r, 0, futuroZ - r),
        new THREE.Vector3(futuroX + r, 1.7, futuroZ + r)
    );
    for (const c of colliders) {
        if (!pb.intersectsBox(c.box)) continue;
        if (c.isRiver && bridgePassage?.containsPoint(new THREE.Vector3(futuroX, 0, futuroZ))) continue;
        return true;
    }
    return false;
}
