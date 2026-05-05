import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

export const mapBounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };

const colliders = [];
let bridgePassage = null;
export const grassZones = [];   // Box3[] — zonas onde há encontros
export let shopDoorInteract = null;
let riverMesh = null;

// ---- materiais base ----
const matGrass    = new THREE.MeshStandardMaterial({ color: 0x4a7c3f });
const matGrassSul = new THREE.MeshStandardMaterial({ color: 0x3a6b2f });
const matSand     = new THREE.MeshStandardMaterial({ color: 0xc8b060, roughness: 0.9 });
const matTrunk    = new THREE.MeshStandardMaterial({ color: 0x5c3d1e });
const matLeaves   = new THREE.MeshStandardMaterial({ color: 0x2d6a1f });
const matLeavesDark = new THREE.MeshStandardMaterial({ color: 0x1a4a10 });
const matWood     = new THREE.MeshStandardMaterial({ color: 0x8b6340 });
const matRailing  = new THREE.MeshStandardMaterial({ color: 0x5c3d1e });
const matPath     = new THREE.MeshStandardMaterial({ color: 0xb8965a, roughness: 0.95 });
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

// ---- shader de água (não esta bom)----
export const matWater = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float sn(vec2 p){
            vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*sn(p);p=p*2.1+vec2(1.7,9.2);a*=0.5;}return v;}
        void main(){
            vec2 uv1=vec2(vUv.x*3.0-uTime*0.22,vUv.y*10.0);
            vec2 uv2=vec2(vUv.x*5.0-uTime*0.30+4.7,vUv.y*14.0+2.3);
            float streak=pow(sn(vec2(vUv.x*2.0-uTime*0.25,vUv.y*28.0)),2.5);
            float w=fbm(uv1)*0.55+fbm(uv2)*0.30+streak*0.15;
            w+=sin(vUv.y*60.0+vUv.x*4.0-uTime*2.5)*0.025+sin(vUv.y*38.0-vUv.x*6.0-uTime*1.8)*0.015;
            w=clamp(w,0.0,1.0);
            vec3 col=mix(vec3(0.03,0.20,0.48),vec3(0.10,0.48,0.82),smoothstep(0.2,0.55,w));
            col=mix(col,vec3(0.30,0.72,0.95),smoothstep(0.55,0.80,w));
            col=mix(col,vec3(0.82,0.94,1.00),smoothstep(0.80,0.96,w)*0.65);
            gl_FragColor=vec4(col,0.90);
        }
    `,
});

// ---- utilitários ----
function addCollider(box, isRiver = false) { colliders.push({ box, isRiver }); }

function makeBox(w, h, d, mat, x, y, z, scene, solid = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addCollider(new THREE.Box3().setFromObject(mesh));
    return mesh;
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

// ---- materiais contaminados — cor natural escurecida com tinge roxo subtil ----
export const matContTrunk  = new THREE.MeshStandardMaterial({ color: 0x3a2830, emissive: 0x220033, emissiveIntensity: 0.3, roughness: 0.85 });
export const matContLeaves = new THREE.MeshStandardMaterial({ color: 0x1e3020, emissive: 0x1a0028, emissiveIntensity: 0.35, roughness: 0.85 });
export const matContRock   = new THREE.MeshStandardMaterial({ color: 0x5a5060, emissive: 0x1a0030, emissiveIntensity: 0.25, roughness: 0.95 });

// ---- árvore ----
function criarArvore(scene, x, z, contaminada = false, leaveMat = null) {
    const trunkH = 1.8;
    const tMat = contaminada ? matContTrunk : matTrunk;
    const lMat = leaveMat ?? (contaminada ? matContLeaves : matLeaves);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, trunkH, 6), tMat);
    trunk.position.set(x, trunkH / 2, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 6), lMat);
    leaves.position.set(x, trunkH + 0.7, z);
    leaves.castShadow = true;
    scene.add(leaves);

    addCollider(new THREE.Box3(
        new THREE.Vector3(x - 0.3, 0, z - 0.3),
        new THREE.Vector3(x + 0.3, trunkH, z + 0.3)
    ));
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
    }

    // AABB aproximada para deteção de encontros
    grassZones.push(new THREE.Box3(
        new THREE.Vector3(cx - raio, 0, cz - raio),
        new THREE.Vector3(cx + raio, 1, cz + raio)
    ));
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
    loader.load('./assets/shop.glb', (gltf) => {
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
function criarRio(scene) {
    const RW = 6, RL = 210, RZ = 0;
    riverMesh = new THREE.Mesh(new THREE.PlaneGeometry(RL, RW, 60, 10), matWater);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(0, 0.05, RZ);
    riverMesh.receiveShadow = true;
    scene.add(riverMesh);

    [-1, 1].forEach(s => {
        const sand = new THREE.Mesh(new THREE.PlaneGeometry(RL, 1.5), matSand);
        sand.rotation.x = -Math.PI / 2;
        sand.position.set(0, 0.02, RZ + s * (RW / 2 + 0.75));
        scene.add(sand);
    });
    addCollider(new THREE.Box3(
        new THREE.Vector3(-RL / 2, -1, RZ - RW / 2),
        new THREE.Vector3(RL / 2, 2, RZ + RW / 2)
    ), true);

    const BX = 0, BW = 3.5, BL = RW + 1;
    makeBox(BW, 0.2, BL, matWood, BX, 0.2, RZ, scene, false);
    [-1, 1].forEach(s => {
        makeBox(BW * 0.05, 0.6, BL, matRailing, BX + s * (BW / 2 - 0.1), 0.6, RZ, scene, false);
        for (let i = -2; i <= 2; i++)
            makeBox(0.12, 0.7, 0.12, matRailing, BX + s * (BW / 2 - 0.1), 0.55, RZ + i * (BL / 4.5), scene, false);
    });
    bridgePassage = new THREE.Box3(
        new THREE.Vector3(BX - BW / 2, -1, RZ - BL / 2),
        new THREE.Vector3(BX + BW / 2, 3, RZ + BL / 2)
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
    const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 95), matGrass);
    g.rotation.x = -Math.PI / 2; g.position.set(0, 0, 52); g.receiveShadow = true; scene.add(g);
    // caminho central norte
    makeBox(3, 0.03, 95, matPath,  0, 0.01, 52, scene, false);
    // caminho horizontal para a loja
    makeBox(32, 0.03, 3, matPath, -16, 0.01, 25, scene, false);
}

function criarTerrenoSul(scene) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 95), matGrassSul);
    g.rotation.x = -Math.PI / 2; g.position.set(0, 0, -52); g.receiveShadow = true; scene.add(g);
    // central sul
    makeBox(3,  0.03, 95, matPath,   0,  0.01, -52, scene, false);
    // bifurcação horizontal a z=-30
    makeBox(100, 0.03,  3, matPath,  0,  0.01, -30, scene, false);
    // caminhos verticais leste e oeste
    makeBox(3,  0.03, 42, matPath,  40,  0.01, -51, scene, false);
    makeBox(3,  0.03, 42, matPath, -40,  0.01, -51, scene, false);
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
// margem de exclusão de árvores nos caminhos
const PATH_W = 3.5;
function naFaixaCaminho(x, z) {
    // central vertical (norte e sul)
    if (Math.abs(x) < PATH_W) return true;
    // horizontal para a loja (z≈25, x: -32→0)
    if (z > 23 && z < 27 && x > -34 && x < 2) return true;
    // bifurcação sul (z≈-30)
    if (z > -32 && z < -28) return true;
    // vertical leste sul (x≈40, z: -28→-72)
    if (z < -28 && z > -72 && Math.abs(x - 40) < PATH_W) return true;
    // vertical oeste sul (x≈-40, z: -28→-72)
    if (z < -28 && z > -72 && Math.abs(x + 40) < PATH_W) return true;
    return false;
}

// ---- castelo exterior — GLB ----
function criarCastelo(scene) {
    const CX = 0, CZ = -80 ,CY =-1;
    const SCALE = 0.03;
    // dimensões aproximadas do modelo em unidades de jogo (após scale)
    const W = 18, D = 16, H = 7;

    const loader = new GLTFLoader();
    loader.load('./assets/casttle.glb', (gltf) => {
        const m = gltf.scene;
        m.position.set(CX, 0, CZ);
        m.scale.setScalar(SCALE);
        m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(m);
    }, undefined, e => console.error('Erro castelo GLB:', e));

    // caminho de acesso ao portão
    makeBox(3.5, 0.03, 12, matPath, CX, 0.01, CZ + D/2 + 5.5, scene, false);

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

// ---- mapa principal ----
export function criarMapa(scene) {
    criarTerrenoNorte(scene);
    criarTerrenoSul(scene);
    criarRio(scene);
    criarShop(scene, SHOP_CX, SHOP_CZ);
    criarCastelo(scene);
    // zona corrupta ao redor do castelo (z=-80) — visual roxo, sem encontros
    criarZonaCorrupta(scene, 0, -80, 28, 111);

    // zonas de batalha norte
    criarZonaBatalha(scene,  28,  28, 12, 202);
    criarZonaBatalha(scene,  28,  60, 10, 303);
    criarZonaBatalha(scene, -28,  65,  9, 404);

    // zonas de batalha sul
    criarZonaBatalha(scene, -28, -20, 11, 505);
    criarZonaBatalha(scene,  28, -20, 12, 606);
    criarZonaBatalha(scene, -50, -50, 13, 707);
    criarZonaBatalha(scene,  50, -50, 13, 808);

    const rand = seededRand(42);

    // árvores norte — densa, cobre toda a área afastada dos caminhos
    let placed = 0;
    for (let i = 0; i < 600 && placed < 200; i++) {
        const x = (rand() * 2 - 1) * 94;
        const z = 5 + rand() * 90;
        if (naFaixaCaminho(x, z) || zonaLivre(x, z, 8)) continue;
        criarArvore(scene, x, z, emZonaBatalha(x, z));
        placed++;
    }

    // árvores sul — ainda mais densas e escuras
    placed = 0;
    for (let i = 0; i < 700 && placed < 250; i++) {
        const x = (rand() * 2 - 1) * 94;
        const z = -(5 + rand() * 90);
        if (naFaixaCaminho(x, z)) continue;
        const cont = emZonaBatalha(x, z);
        criarArvore(scene, x, z, cont, cont ? null : matLeavesDark);
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
