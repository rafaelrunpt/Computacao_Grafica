import * as THREE from 'three';
import { matBattleGrass, matBattleSky, matBattleDark } from './shaders.js';
import { criarAcessorio } from './acessorios.js';

// ---- dimensões da sala do boss ----
const W = 22;   // largura
const D = 20;   // profundidade
const H = 8;    // pé-direito

export const caseloScene = new THREE.Scene();
caseloScene.background = new THREE.Color(0x0d0818);

// ---- iluminação ----
// A sala é iluminada UNICAMENTE pelas 4 tochas das paredes (PointLights,
// criadas abaixo). Foram retiradas a luz ambiente, a direccional do tecto
// e o holofote do prisma — os cantos longe das tochas ficam de propósito
// na penumbra, para um ambiente de masmorra só à luz do fogo. As 2 tochas
// das diagonais (NW/SE) continuam a projectar as sombras dinâmicas da sala.

// tochas nas paredes laterais (4 PointLights, TODAS com castShadow —
// cube-shadow em sala apertada com poucos objectos é viável).
const tochaPositions = [
    [-W / 2 + 0.8,  H * 0.45,  -D / 4],   // NW (com sombra)
    [ W / 2 - 0.8,  H * 0.45,  -D / 4],   // NE
    [-W / 2 + 0.8,  H * 0.45,   D / 4],   // SW
    [ W / 2 - 0.8,  H * 0.45,   D / 4],   // SE (com sombra)
];
const _torches = [];
const _fireMat = new THREE.MeshStandardMaterial({
    color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 2,
});
for (let ti = 0; ti < tochaPositions.length; ti++) {
    const [tx, ty, tz] = tochaPositions[ti];
    // Intensidade alta + alcance largo: estas tochas são a ÚNICA fonte de
    // luz da sala, têm de a iluminar por inteiro. (Eram fracas — 1.8/11 —
    // quando a ambiente e a direccional ainda faziam o grosso do trabalho.)
    const flame = new THREE.PointLight(0xff6600, 75, 22, 1.4);
    flame.position.set(tx, ty, tz);
    // TODAS as 4 tochas projectam sombra. Com só 2 (as diagonais), os
    // pilares lançavam sombras assimétricas — umas para um lado, outras
    // para o outro — e parecia um bug. Com as 4 fontes ficam simétricas
    // e intencionais. Custo: 4 cube-shadows, mas a sala é pequena.
    flame.castShadow = true;
    flame.shadow.mapSize.set(256, 256);
    flame.shadow.camera.near = 0.2;
    flame.shadow.camera.far  = 15;
    flame.shadow.bias = -0.001;
    caseloScene.add(flame);

    const torchBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c3d1e })
    );
    torchBody.position.set(tx, ty - 0.3, tz);
    torchBody.castShadow = false;   // não auto-sombrear: a luz da tocha está mesmo por cima dele
    caseloScene.add(torchBody);

    // Cada chama tem o seu próprio material clonado para o flicker animar
    // emissiveIntensity de forma independente.
    const fireMat = _fireMat.clone();
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), fireMat);
    fire.position.set(tx, ty + 0.05, tz);
    caseloScene.add(fire);

    _torches.push({
        light: flame, fire, fireMat,
        baseIntensity: 75,   // tem de acompanhar a intensidade da PointLight acima
        phase: Math.random() * Math.PI * 2,
    });
}

// ---- materiais ----
const matStone    = new THREE.MeshStandardMaterial({ color: 0x55506a, roughness: 0.9, flatShading: true });
const matStoneDark= new THREE.MeshStandardMaterial({ color: 0x3a3550, roughness: 0.9, flatShading: true });
const matFloor    = new THREE.MeshStandardMaterial({ color: 0x3a3448, roughness: 0.95 });
const matCarpet   = new THREE.MeshStandardMaterial({ color: 0x7a1515, roughness: 1.0 });
const matPillar   = new THREE.MeshStandardMaterial({ color: 0x4a4560, roughness: 0.85, flatShading: true });
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

// ---- 5 pedestais com runas ----
// Cada pedestal tem: posição, item esperado, pista (texto), runa no chão,
// cilindro escondido que sobe quando o item é colocado e o "troféu" do
// item colocado a rodar no topo. O visual do troféu vem de
// `criarAcessorio(itemId)` (módulo acessorios.js), partilhado com o boss.
// Posições têm de ficar no tapete acessível: x ∈ [-2.7, 2.7] e
// z > -4.5 (a frente do altar bloqueia tudo acima disso).
export const PEDESTAIS = [
    {
        pos: [0, 5.5],                // junto à entrada, no tapete (coroa)
        itemId: 'coroa_magica',
        pista: 'No extremo nordeste do mapa, atrás dos campos, um baú selado por uma fechadura guarda a Coroa da Pedra Mágica. Terás de a forçar.',
    },
    {
        pos: [-2.0, -1.5],            // norte-oeste (brincos)
        itemId: 'brincos_vida',
        pista: 'Cinco batalhas vencidas trarão à luz uns brincos da aurora — apenas os que enfrentam o mal os recebem.',
    },
    {
        pos: [ 2.0, -1.5],            // norte-este (óculos)
        itemId: 'oculos_carga',
        pista: 'Na loja, o mercador guarda uns óculos do vidente. Por 20 ✦ serão teus.',
    },
    {
        pos: [-2.0,  3.5],            // sul-oeste (auréola)
        itemId: 'aureola_caidos',
        pista: 'Na taverna há um estalajadeiro com um pedido. Limpa todas as zonas corruptas do mapa e ele dar-te-á a Auréola dos Caídos.',
    },
    {
        pos: [ 2.0,  3.5],            // sul-este (máscara)
        itemId: 'mascara_eclipse',
        pista: 'Procura no canto mais distante a sudoeste do mapa, longe dos caminhos. Um baú esquecido esconde a Máscara do Eclipse — terás de forçar a fechadura.',
    },
];

// Constrói o visual completo de cada pedestal.
for (let i = 0; i < PEDESTAIS.length; i++) {
    const p = PEDESTAIS[i];
    const [rx, rz] = p.pos;

    // runa no chão (existente)
    const rune = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.04, 8),
        matBattleDark
    );
    rune.position.set(rx, 0.1, rz);
    caseloScene.add(rune);
    p._rune = rune;

    // cilindro que sobe (escondido inicialmente)
    const colunaH = 0.9;
    const colunaRTopo = 0.32, colunaRBase = 0.42;
    const coluna = new THREE.Mesh(
        new THREE.CylinderGeometry(colunaRTopo, colunaRBase, colunaH, 16),
        // material de corrupção sombria nas laterais (mesmo shader das runas)
        matBattleDark
    );
    coluna.position.set(rx, -colunaH / 2 - 0.01, rz);  // começa enterrada
    coluna.visible = false;
    coluna.castShadow = true;
    caseloScene.add(coluna);
    p._coluna = coluna;
    p._colunaTargetY = colunaH / 2 + 0.12;             // y final quando subido
    p._colunaH = colunaH;
    // topo: um pequeno disco para o troféu não "flutuar" sobre a corrupção
    const topo = new THREE.Mesh(
        new THREE.CylinderGeometry(colunaRTopo, colunaRTopo, 0.05, 16),
        new THREE.MeshStandardMaterial({
            color: 0x1a1428, emissive: 0x5040aa, emissiveIntensity: 0.8,
            roughness: 0.4, metalness: 0.7,
        })
    );
    topo.position.y = colunaH / 2 + 0.025;
    topo.castShadow = true;
    coluna.add(topo);

    // suporte para o troféu (rotativo) — fica como filho da coluna
    const trofeuPivot = new THREE.Group();
    trofeuPivot.position.y = colunaH / 2 + 0.18;       // em cima do topo
    coluna.add(trofeuPivot);
    p._trofeuPivot = trofeuPivot;

    p.placed = false;
    p._anim = 0;     // progresso (0..1) da animação de subida
}

// ---- API exposta para o gameplay ----
export function getPedestais() { return PEDESTAIS; }

export function pedestalProximoDe(x, z, raio = 1.4) {
    const r2 = raio * raio;
    for (let i = 0; i < PEDESTAIS.length; i++) {
        const [px, pz] = PEDESTAIS[i].pos;
        const dx = x - px, dz = z - pz;
        if (dx * dx + dz * dz <= r2) return i;
    }
    return -1;
}

export function colocarItemPedestal(idx) {
    const p = PEDESTAIS[idx];
    if (!p || p.placed || !p.itemId) return false;
    const trofeu = criarAcessorio(p.itemId);
    if (!trofeu) return false;
    // troféu lança sombra como os restantes objectos dos pedestais
    trofeu.traverse(o => { if (o.isMesh) o.castShadow = true; });
    p.placed = true;
    p._coluna.visible = true;
    p._trofeuPivot.add(trofeu);
    p._trofeu = trofeu;
    // adiciona o pilar como colisor — bloqueia o jogador
    const [rx, rz] = p.pos;
    const r = 0.45;
    p._colliderBox = new THREE.Box3(
        new THREE.Vector3(rx - r, 0,           rz - r),
        new THREE.Vector3(rx + r, p._colunaTargetY + p._colunaH / 2, rz + r)
    );
    caseloColliders.push(p._colliderBox);
    return true;
}

export function todosPedestaisCheios() {
    return PEDESTAIS.every(p => p.placed);
}

// ---- animação dos pedestais (subida do cilindro + rotação do troféu) ----
export function atualizarPedestais(deltaTime) {
    for (const p of PEDESTAIS) {
        if (!p.placed) continue;
        // anima a subida da coluna (0 → 1 em ~0.8s)
        if (p._anim < 1) {
            p._anim = Math.min(1, p._anim + deltaTime / 0.8);
            const eased = 1 - Math.pow(1 - p._anim, 3); // easeOutCubic
            p._coluna.position.y = -p._colunaH / 2 - 0.01
                + eased * (p._colunaTargetY - (-p._colunaH / 2 - 0.01));
        }
        // troféu a rodar sempre
        p._trofeuPivot.rotation.y += deltaTime * 1.4;
        p._trofeuPivot.position.y = (p._colunaH / 2 + 0.18)
            + Math.sin(performance.now() * 0.0025) * 0.04;
    }
}

// ---- paredes ----
// Paredes de pedra com a altura útil H — a câmara aponta para cima
// com FOV largo, mas o "céu" acima vai ser preenchido pela abóbada
// de corrupção (matBattleSky) logo a seguir.
// fundo (norte)
box(W, H, 0.6, matStone,  0, H / 2, -D / 2);
// lateral esquerda
box(0.6, H, D, matStone, -W / 2, H / 2, 0);
// lateral direita
box(0.6, H, D, matStone,  W / 2, H / 2, 0);
// parede sul — sem malhas visuais; colisores em caseloColliders mantêm o gap da porta

// ---- "céu" corrupto — mesmo visual das zonas de confronto ----
// Plano horizontal grande exactamente à altura do topo das paredes.
// matBattleSky usa coordenadas world-space em XZ, por isso o padrão
// varia naturalmente sobre o plano (sem esticamento). É grande o
// suficiente para cobrir toda a área que a câmara vê para cima.
{
    const tetoSize = Math.max(W, D) * 6;
    const teto = new THREE.Mesh(
        new THREE.PlaneGeometry(tetoSize, tetoSize),
        matBattleSky
    );
    teto.rotation.x = Math.PI / 2;          // virado para baixo
    teto.position.set(0, H - 0.02, 0);      // mesmo nível do topo das paredes
    caseloScene.add(teto);
}

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
        pillar.castShadow = true;    // sombras simétricas — as 4 tochas projectam
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

// ---- prisma do boss — agora em cima da pirâmide do altar ----
// A própria pirâmide escalonada (3 patamares, topo em y=1.5) substitui a
// coluna/base antiga. O prisma roda no ponto mais alto. O jogador interage
// por baixo, em frente ao altar (não pode subir — o colisor do altar
// bloqueia).
const TOTEM_X = 0;
const TOTEM_Z = -D / 2 + 3.5;   // = centro da pirâmide (~-6.5 em D=20)
const TOTEM_TOP_Y = 1.5;        // topo da pirâmide (altar mais alto = y 1.0..1.5)

// runa de glifo a brilhar no topo da pirâmide, debaixo do prisma
const totemRune = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.04, 24),
    new THREE.MeshStandardMaterial({
        color: 0x2a0a3a, emissive: 0xaa30ff, emissiveIntensity: 1.8,
        roughness: 0.5, metalness: 0.3,
    })
);
totemRune.position.set(TOTEM_X, TOTEM_TOP_Y + 0.04, TOTEM_Z);
caseloScene.add(totemRune);

// cristal maligno a flutuar acima da pirâmide
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
crystal.position.set(TOTEM_X, TOTEM_TOP_Y + 0.95, TOTEM_Z);
crystal.rotation.y = Math.PI / 4;
// IMPORTANTE: NÃO activar castShadow no cristal. O material é transparente
// (`opacity: 0.85`) e three.js renderiza shadow maps a partir da silhueta
// opaca da geometria — daria um "diamante fantasma" no chão em sítios
// onde a sombra escapasse aos limites do altar.
crystal.castShadow = false;
caseloScene.add(crystal);
export const bossCrystal = crystal;
// Altura "base" da animação de bobbing — exportada para o main.js usar.
export const bossCrystalRestY = TOTEM_TOP_Y + 0.95;

// Caixa de interacção: o jogador não pode subir à pirâmide (collider do
// altar bloqueia z<=-4.5). A interacção fica em frente à pirâmide, na
// faixa entre o degrau da frente e ~1.5m a sul, centrada em x.
export const bossCrystalInteractBox = new THREE.Box3(
    new THREE.Vector3(TOTEM_X - 1.8, 0, -4.5),
    new THREE.Vector3(TOTEM_X + 1.8, 4, -2.5),
);
// posição segura — bem em frente à pirâmide, fora de qualquer colisor.
export const bossCrystalSafePos = new THREE.Vector3(TOTEM_X, 0, -3.0);

// ---- zona de saída (perto da entrada) ----
export const caseloSaidaBox = new THREE.Box3(
    new THREE.Vector3(-2.2, 0,  D / 2 - 1.5),
    new THREE.Vector3( 2.2, 3,  D / 2 + 0.5)
);

// ---- colisores interiores ----
export const caseloColliders = [
    // paredes (ajustadas para bater certo com os 0.6 de espessura visual)
    new THREE.Box3(new THREE.Vector3(-W/2-0.1, 0, -D/2-0.1), new THREE.Vector3(-W/2+0.3, H, D/2+0.1)),
    new THREE.Box3(new THREE.Vector3( W/2-0.3, 0, -D/2-0.1), new THREE.Vector3( W/2+0.1, H, D/2+0.1)),
    new THREE.Box3(new THREE.Vector3(-W/2, 0, -D/2-0.1),     new THREE.Vector3( W/2, H, -D/2+0.3)),
    // parede sul: fechada para movimento — saída só via interação E (caseloSaidaBox)
    new THREE.Box3(new THREE.Vector3(-W/2, 0, D/2-0.5),      new THREE.Vector3( W/2, H, D/2+0.5)),
    // altar (pirâmide escalonada — agora também serve de pedestal do cristal)
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

// ============================================================
// ATMOSFERA — partículas, feixes e flicker para benchmark visual
// ============================================================
// Nenhum dos elementos abaixo toca em colliders, pedestais ou no totem.
// Tudo é decorativo + animado por shader; o custo CPU em update é trivial.

const _atmosTime = { t: 0 };

// ---- 1) Brasas a subir das 4 tochas (THREE.Points + vertex shader) ----
function _criarEmbers() {
    const PER = 14;
    const N   = _torches.length * PER;
    const positions = new Float32Array(N * 3);
    const origins   = new Float32Array(N * 3);
    const phases    = new Float32Array(N);

    let idx = 0;
    for (const t of _torches) {
        for (let i = 0; i < PER; i++) {
            origins[idx*3]   = t.light.position.x;
            origins[idx*3+1] = t.light.position.y + 0.05;
            origins[idx*3+2] = t.light.position.z;
            positions[idx*3]   = t.light.position.x;
            positions[idx*3+1] = t.light.position.y;
            positions[idx*3+2] = t.light.position.z;
            phases[idx] = Math.random() * Math.PI * 2;
            idx++;
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aOrigin',  new THREE.BufferAttribute(origins, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio || 1 },
        },
        vertexShader: `
            attribute vec3 aOrigin;
            attribute float aPhase;
            varying float vLife;
            uniform float uTime;
            uniform float uPixelRatio;
            void main() {
                float life = mod(uTime * 0.6 + aPhase, 1.0);
                float y = aOrigin.y + life * 2.2;
                float x = aOrigin.x + sin(uTime * 2.5 + aPhase * 5.0) * 0.10 * life;
                float z = aOrigin.z + cos(uTime * 1.9 + aPhase * 3.0) * 0.10 * life;
                vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
                gl_Position = projectionMatrix * mv;
                float d = -mv.z;
                gl_PointSize = uPixelRatio * (3.0 + 5.0 * (1.0 - life)) * (35.0 / max(d, 1.0));
                vLife = life;
            }
        `,
        fragmentShader: `
            varying float vLife;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                vec3 col = mix(vec3(1.0, 0.65, 0.15), vec3(0.6, 0.15, 0.05), vLife);
                float a = smoothstep(0.0, 0.08, vLife) * smoothstep(1.0, 0.55, vLife);
                gl_FragColor = vec4(col * (0.5 + 1.6 * core), core * a * 0.9);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    caseloScene.add(pts);
    return mat;
}
const _embersMat = _criarEmbers();

// ---- 2) Motes de pó/luz a flutuar pela sala (lilás suave) ----
function _criarMotes() {
    const N = 90;
    const positions = new Float32Array(N * 3);
    const phases    = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        positions[i*3]   = (Math.random() - 0.5) * (W - 3);
        positions[i*3+1] = 0.6 + Math.random() * (H - 1.6);
        positions[i*3+2] = (Math.random() - 0.5) * (D - 3);
        phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio || 1 },
        },
        vertexShader: `
            attribute float aPhase;
            uniform float uTime;
            uniform float uPixelRatio;
            varying float vGlow;
            void main() {
                vec3 p = position;
                p.x += sin(uTime * 0.30 + aPhase) * 0.45;
                p.y += sin(uTime * 0.50 + aPhase * 1.3) * 0.22;
                p.z += cos(uTime * 0.42 + aPhase * 0.7) * 0.45;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                float d = -mv.z;
                gl_PointSize = uPixelRatio * 2.8 * (35.0 / max(d, 1.0));
                vGlow = 0.4 + 0.6 * sin(uTime * 1.4 + aPhase * 2.0);
            }
        `,
        fragmentShader: `
            varying float vGlow;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                vec3 col = vec3(0.65, 0.45, 0.95);
                gl_FragColor = vec4(col, core * (0.10 + 0.28 * vGlow));
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    caseloScene.add(pts);
    return mat;
}
const _motesMat = _criarMotes();

// ---- 3) Espirais de corrupção à volta do cristal central ----
function _criarMistCristal() {
    const N = 50;
    const positions = new Float32Array(N * 3);
    const phases    = new Float32Array(N);
    const radii     = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        positions[i*3]   = TOTEM_X;
        positions[i*3+1] = TOTEM_TOP_Y + 0.1 + Math.random() * 2.4;
        positions[i*3+2] = TOTEM_Z;
        phases[i] = Math.random() * Math.PI * 2;
        radii[i]  = 0.55 + Math.random() * 1.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aRadius',  new THREE.BufferAttribute(radii, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio || 1 },
        },
        vertexShader: `
            attribute float aPhase;
            attribute float aRadius;
            uniform float uTime;
            uniform float uPixelRatio;
            varying float vPulse;
            void main() {
                float ang = uTime * (0.45 + aRadius * 0.18) + aPhase;
                vec3 p = position;
                p.x += cos(ang) * aRadius;
                p.z += sin(ang) * aRadius;
                p.y += sin(uTime * 0.6 + aPhase) * 0.35;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                float d = -mv.z;
                gl_PointSize = uPixelRatio * (4.5 + 1.5 * aRadius) * (35.0 / max(d, 1.0));
                vPulse = 0.5 + 0.5 * sin(uTime * 1.3 + aPhase);
            }
        `,
        fragmentShader: `
            varying float vPulse;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                vec3 col = vec3(0.55, 0.10, 0.85);
                gl_FragColor = vec4(col, core * (0.25 + 0.35 * vPulse));
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    caseloScene.add(pts);
    return mat;
}
const _mistMat = _criarMistCristal();

// ---- 4) Feixe volumétrico a descer da abóbada sobre o cristal ----
function _criarFeixeCristal() {
    // Apex (ponto estreito) no tecto; base (aberta) sobre o topo da pirâmide.
    const bottomY = TOTEM_TOP_Y + 0.05;   // logo acima do topo do altar
    const topY    = H - 0.15;
    const beamH   = topY - bottomY;
    const baseR   = 1.4;

    const geo = new THREE.ConeGeometry(baseR, beamH, 28, 1, true);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            varying float vNorm;
            void main() {
                // position.y em object-space vai de -h/2 (base, abaixo)
                // a +h/2 (apex, no topo). vNorm em 0..1 (0 = base, 1 = apex)
                vNorm = position.y / ` + (beamH / 2).toFixed(4) + ` * 0.5 + 0.5;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying float vNorm;
            void main() {
                // mais brilho perto do topo (fonte)
                float fade = pow(vNorm, 1.6);
                fade *= 0.55 + 0.25 * sin(uTime * 1.5);
                vec3 col = vec3(0.50, 0.15, 0.85);
                gl_FragColor = vec4(col * fade, fade * 0.45);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.set(TOTEM_X, (bottomY + topY) / 2, TOTEM_Z);
    caseloScene.add(cone);
    return mat;
}
const _feixeMat = _criarFeixeCristal();

// ---- 5) Atmosfera/animação — chamado pelo main.js a cada frame ----
export function atualizarAtmosferaCastelo(deltaTime) {
    _atmosTime.t += deltaTime;
    const t = _atmosTime.t;

    // flicker independente por tocha (intensidade da luz + emissive da chama)
    for (const tch of _torches) {
        const f = 0.80
                + 0.30 * Math.sin(t * 12 + tch.phase)
                + 0.15 * Math.sin(t * 23 + tch.phase * 1.7);
        tch.light.intensity = tch.baseIntensity * f;
        tch.fireMat.emissiveIntensity = 1.6 + 1.0 * f * 0.5;
        tch.fire.scale.y = 0.9 + 0.20 * Math.cos(t * 11 + tch.phase);
        tch.fire.scale.x = 0.95 + 0.10 * Math.sin(t * 15 + tch.phase);
    }

    // uniforms dos shaders de partículas / feixe
    _embersMat.uniforms.uTime.value = t;
    _motesMat .uniforms.uTime.value = t;
    _mistMat  .uniforms.uTime.value = t;
    _feixeMat .uniforms.uTime.value = t;
}
