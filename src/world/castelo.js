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

// ---- totem/cristal do boss ----
// Anteriormente ficava em cima do altar (z = -D/2 + 3.0). Foi mudado para
// o meio da sala (z = -3.5) — a posição que a coroa ocupava antes — para
// que o jogador o veja e interaja sem ficar entalado contra o altar
// quando regressa da derrota.
const TOTEM_X = 0;
const TOTEM_Z = -3.5;

// runa no chão por baixo do totem
const totemRune = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.04, 24),
    new THREE.MeshStandardMaterial({
        color: 0x2a0a3a, emissive: 0x6a20cc, emissiveIntensity: 1.1,
        roughness: 0.6, metalness: 0.4,
    })
);
totemRune.position.set(TOTEM_X, 0.10, TOTEM_Z);
caseloScene.add(totemRune);

// base — coluna baixa para o cristal pousar
const totemBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 1.1, 16),
    new THREE.MeshStandardMaterial({
        color: 0x1a1024, emissive: 0x4020aa, emissiveIntensity: 0.55,
        roughness: 0.5, metalness: 0.6,
    })
);
totemBase.position.set(TOTEM_X, 0.55, TOTEM_Z);
caseloScene.add(totemBase);

// cristal maligno por cima da base
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
crystal.position.set(TOTEM_X, 1.95, TOTEM_Z);
crystal.rotation.y = Math.PI / 4;
caseloScene.add(crystal);
export const bossCrystal = crystal; // animado no main.js

// caixa de interacção à volta do totem — só fica activa visualmente
// quando todos os pedestais estão preenchidos (verificação em main.js).
export const bossCrystalInteractBox = new THREE.Box3(
    new THREE.Vector3(TOTEM_X - 1.4, 0, TOTEM_Z - 1.2),
    new THREE.Vector3(TOTEM_X + 1.4, 4, TOTEM_Z + 1.2),
);
// posição segura — a SUL do totem (em direcção à entrada), para o jogador
// reaparecer com espaço livre depois de uma derrota e não ficar preso.
// 1.5 unidades a sul deixa folga suficiente do colisor do totem e
// mantém-no virado para o cristal.
export const bossCrystalSafePos = new THREE.Vector3(TOTEM_X, 0, TOTEM_Z + 1.5);

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
    // paredes (ajustadas para bater certo com os 0.6 de espessura visual)
    new THREE.Box3(new THREE.Vector3(-W/2-0.1, 0, -D/2-0.1), new THREE.Vector3(-W/2+0.3, H, D/2+0.1)),
    new THREE.Box3(new THREE.Vector3( W/2-0.3, 0, -D/2-0.1), new THREE.Vector3( W/2+0.1, H, D/2+0.1)),
    new THREE.Box3(new THREE.Vector3(-W/2, 0, -D/2-0.1),     new THREE.Vector3( W/2, H, -D/2+0.3)),
    // parede sul: fechada para movimento — saída só via interação E (caseloSaidaBox)
    new THREE.Box3(new THREE.Vector3(-W/2, 0, D/2-0.5),      new THREE.Vector3( W/2, H, D/2+0.5)),
    // altar
    new THREE.Box3(new THREE.Vector3(-3.1, 0, -D/2+1.5),     new THREE.Vector3( 3.1, 2, -D/2+5.5)),
    // totem/cristal do boss
    new THREE.Box3(
        new THREE.Vector3(TOTEM_X - 0.55, 0, TOTEM_Z - 0.55),
        new THREE.Vector3(TOTEM_X + 0.55, 2.5, TOTEM_Z + 0.55),
    ),
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
