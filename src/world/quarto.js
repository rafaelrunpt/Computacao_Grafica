// Quarto inicial — cena 100% procedural em three.js.
// Estilo artístico igual à taverna: pedra fria nas paredes, tábuas
// quentes no chão, mobília low-poly em madeira e iluminação dramática
// dominada por uma vela/lanterna ao lado da cama, com luz fria a entrar
// pela janela.
import * as THREE from 'three';

// ---- dimensões ----
const W = 7.0;   // largura (x)
const D = 6.0;   // profundidade (z)
const H = 3.2;   // pé-direito

export const quartoScene = new THREE.Scene();
quartoScene.background = new THREE.Color(0x0a0806);

// ---- materiais ----
const matStone     = new THREE.MeshStandardMaterial({ color: 0x7a7068, roughness: 0.95, flatShading: true });
const matStoneDark = new THREE.MeshStandardMaterial({ color: 0x554d46, roughness: 0.95, flatShading: true });
const matMortar    = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 1.0 });

const matPlank     = new THREE.MeshStandardMaterial({ color: 0x6b3a1f, roughness: 0.9, flatShading: true });
const matPlankDark = new THREE.MeshStandardMaterial({ color: 0x4d2814, roughness: 0.9, flatShading: true });
const matBeam      = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.95, flatShading: true });

const matWood      = new THREE.MeshStandardMaterial({ color: 0x6a3a1c, roughness: 0.85, flatShading: true });
const matWoodDark  = new THREE.MeshStandardMaterial({ color: 0x44240e, roughness: 0.9,  flatShading: true });
const matMattress  = new THREE.MeshStandardMaterial({ color: 0xd8c89a, roughness: 1.0 });
const matPillow    = new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 1.0 });
const matBlanket   = new THREE.MeshStandardMaterial({ color: 0x7a1a1a, roughness: 1.0, flatShading: true });
const matBlanket2  = new THREE.MeshStandardMaterial({ color: 0x5a1212, roughness: 1.0, flatShading: true });
const matMetal     = new THREE.MeshStandardMaterial({ color: 0x9c8460, metalness: 0.6, roughness: 0.5 });
const matCandle    = new THREE.MeshStandardMaterial({ color: 0xf0e0b0, roughness: 0.8 });
const matFlame     = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff6622, emissiveIntensity: 2.4 });
const matRug       = new THREE.MeshStandardMaterial({ color: 0x6e2820, roughness: 1.0 });
const matRugEdge   = new THREE.MeshStandardMaterial({ color: 0x401410, roughness: 1.0 });
const matGlass     = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4, metalness: 0.2, emissive: 0x224466, emissiveIntensity: 0.4, transparent: true, opacity: 0.55 });
const matLantern   = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.9, flatShading: true });
const matLanternGlow = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff7a20, emissiveIntensity: 2.2, transparent: true, opacity: 0.85 });

// colliders (Box3) para colisões simples
export const quartoColliders = [];

function box(w, h, d, mat, x, y, z, rotY = 0, addCollider = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rotY) m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    quartoScene.add(m);
    if (addCollider) {
        m.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(m);
        quartoColliders.push(b);
    }
    return m;
}

// ---------------------------------------------------------------
// CHÃO — tábuas alternadas
// ---------------------------------------------------------------
box(W + 0.4, 0.08, D + 0.4, matMortar, 0, -0.04, 0);
const plankW = 0.55;
const nPlanks = Math.ceil(W / plankW);
for (let i = 0; i < nPlanks; i++) {
    const x = -W / 2 + plankW / 2 + i * plankW;
    const mat = (i % 2 === 0) ? matPlank : matPlankDark;
    const m = new THREE.Mesh(new THREE.BoxGeometry(plankW - 0.02, 0.05, D), mat);
    m.position.set(x, 0.025, 0);
    m.receiveShadow = true;
    quartoScene.add(m);
}

// tapete junto à cama
const rug = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 1.4), matRug);
rug.position.set(0.6, 0.055, 1.2);
rug.receiveShadow = true;
quartoScene.add(rug);
const rugBorder = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.015, 1.6), matRugEdge);
rugBorder.position.set(0.6, 0.05, 1.2);
rugBorder.receiveShadow = true;
quartoScene.add(rugBorder);

// ---------------------------------------------------------------
// PAREDES — blocos de pedra com variação
// ---------------------------------------------------------------
// painel base sólido (para vedar buracos entre blocos)
function wallSlab(w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matStoneDark);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    quartoScene.add(m);
}

// blocos de pedra individuais cobrindo uma parede
function stoneCourse(orient, length, height, baseX, baseZ, faceNormal, gapY = 0) {
    // orient: 'x' (parede orientada ao longo do eixo X) ou 'z'
    // faceNormal: direção para dentro da sala (1 ou -1) — só para offset visual
    const blockH = 0.42;
    const rows = Math.ceil(height / blockH);
    for (let r = 0; r < rows; r++) {
        const y = r * blockH + blockH / 2 + gapY;
        if (y > height) continue;
        // larguras irregulares
        let used = 0;
        const offset = (r % 2 === 0) ? 0 : 0.25;
        while (used < length) {
            const bw = 0.55 + Math.random() * 0.35;
            const x = -length / 2 + used + bw / 2 + (r % 2 === 0 ? 0 : offset);
            if (x + bw / 2 > length / 2 + 0.01) break;
            const bMat = (Math.random() < 0.25) ? matStoneDark : matStone;
            const depth = 0.18 + Math.random() * 0.08;
            const blockH2 = blockH - 0.02;
            const m = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.04, blockH2, depth), bMat);
            if (orient === 'x') {
                m.position.set(baseX + x, y, baseZ + faceNormal * (0.18 - depth / 2));
            } else {
                m.position.set(baseX + faceNormal * (0.18 - depth / 2), y, baseZ + x);
            }
            m.receiveShadow = true;
            m.castShadow = true;
            quartoScene.add(m);
            used += bw;
        }
    }
}

// Apenas paredes "de fundo" (norte + oeste) para a câmara conseguir
// olhar para dentro do quarto. As paredes este e sul foram removidas
// visualmente; os colliders mantêm-se para o jogador não sair.
// parede traseira (norte, z = -D/2)
wallSlab(W + 0.4, H, 0.2, 0, H / 2, -D / 2 - 0.1);
stoneCourse('x', W, H, 0, -D / 2, 1);
// parede esquerda (oeste, x = -W/2) — janela
wallSlab(0.2, H, D + 0.4, -W / 2 - 0.1, H / 2, 0);
stoneCourse('z', D, H, -W / 2, 0, 1);

// pequenos cotos de pedra nas paredes removidas — só a base, dão a
// ideia de "corte" no mesmo estilo da taverna
const stubH = 0.5;
wallSlab(W + 0.4, stubH, 0.2, 0, stubH / 2,  D / 2 + 0.1);
stoneCourse('x', W, stubH, 0,  D / 2, -1);
wallSlab(0.2, stubH, D + 0.4,  W / 2 + 0.1, stubH / 2, 0);
stoneCourse('z', D, stubH,  W / 2, 0, -1);

// colliders nas paredes (planos finos)
quartoColliders.push(
    new THREE.Box3(new THREE.Vector3(-W/2 - 0.3, 0, -D/2 - 0.3), new THREE.Vector3( W/2 + 0.3, H, -D/2 + 0.05)), // norte
    new THREE.Box3(new THREE.Vector3(-W/2 - 0.3, 0,  D/2 - 0.05), new THREE.Vector3(W/2 + 0.3, H,  D/2 + 0.3)), // sul
    new THREE.Box3(new THREE.Vector3(-W/2 - 0.3, 0, -D/2 - 0.3), new THREE.Vector3(-W/2 + 0.05, H,  D/2 + 0.3)), // oeste
    new THREE.Box3(new THREE.Vector3( W/2 - 0.05, 0, -D/2 - 0.3), new THREE.Vector3(W/2 + 0.3, H,  D/2 + 0.3)), // este
);

// ---------------------------------------------------------------
// JANELA — recortada na parede oeste (apenas visual + luz)
// ---------------------------------------------------------------
const winY = 1.9, winW = 1.1, winH = 1.2;
// "buraco" preto atrás do vidro
const winHole = new THREE.Mesh(new THREE.BoxGeometry(0.05, winH, winW), new THREE.MeshBasicMaterial({ color: 0x070b14 }));
winHole.position.set(-W / 2 + 0.02, winY, 0);
quartoScene.add(winHole);
// vidro
const winGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, winH - 0.05, winW - 0.05), matGlass);
winGlass.position.set(-W / 2 + 0.05, winY, 0);
quartoScene.add(winGlass);
// moldura
const frameMat = matWoodDark;
box(0.1, 0.08, winW + 0.2, frameMat, -W / 2 + 0.05, winY - winH / 2 - 0.04, 0); // base
box(0.1, 0.08, winW + 0.2, frameMat, -W / 2 + 0.05, winY + winH / 2 + 0.04, 0); // topo
box(0.1, winH + 0.16, 0.08, frameMat, -W / 2 + 0.05, winY,  winW / 2 + 0.04);   // lado +
box(0.1, winH + 0.16, 0.08, frameMat, -W / 2 + 0.05, winY, -winW / 2 - 0.04);   // lado -
// barras em cruz
box(0.06, winH - 0.05, 0.04, frameMat, -W / 2 + 0.06, winY, 0);
box(0.06, 0.04, winW - 0.05, frameMat, -W / 2 + 0.06, winY, 0);

// peitoril de pedra
box(0.45, 0.12, winW + 0.4, matStone, -W / 2 + 0.18, winY - winH / 2 - 0.12, 0);

// ---------------------------------------------------------------
// TECTO — vigas + ripado
// ---------------------------------------------------------------
// (sem tecto — o quarto fica aberto por cima para a câmara cinematográfica)

// ---------------------------------------------------------------
// CAMA — encostada à parede norte, viragem para sul
// ---------------------------------------------------------------
const bedGroup = new THREE.Group();
const bedW = 1.7, bedL = 2.4, bedH = 0.5;
// estrado
const bedBase = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.12, bedL), matWoodDark);
bedBase.position.set(0, bedH - 0.06, 0);
bedBase.castShadow = true; bedBase.receiveShadow = true;
bedGroup.add(bedBase);
// pés
for (const [sx, sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, bedH, 0.16), matWoodDark);
    leg.position.set(sx * (bedW / 2 - 0.1), bedH / 2, sz * (bedL / 2 - 0.1));
    leg.castShadow = true;
    bedGroup.add(leg);
}
// cabeceira (norte)
const headBoard = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.1, 1.0, 0.12), matWood);
headBoard.position.set(0, bedH + 0.5, -bedL / 2 + 0.06);
headBoard.castShadow = true;
bedGroup.add(headBoard);
// rodapé (sul)
const footBoard = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.1, 0.55, 0.12), matWood);
footBoard.position.set(0, bedH + 0.27, bedL / 2 - 0.06);
footBoard.castShadow = true;
bedGroup.add(footBoard);
// colchão
const mattress = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.08, 0.18, bedL - 0.2), matMattress);
mattress.position.set(0, bedH + 0.09, 0);
mattress.castShadow = true;
bedGroup.add(mattress);
// almofada
const pillow = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.3, 0.12, 0.5), matPillow);
pillow.position.set(0, bedH + 0.22, -bedL / 2 + 0.5);
pillow.castShadow = true;
bedGroup.add(pillow);
// manta (dobrada) — cobre 2/3
const blanket = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.06, 0.06, bedL * 0.55), matBlanket);
blanket.position.set(0, bedH + 0.21, bedL * 0.18);
blanket.castShadow = true;
bedGroup.add(blanket);
// orla da manta
const blanketEdge = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.06, 0.07, 0.15), matBlanket2);
blanketEdge.position.set(0, bedH + 0.215, bedL * 0.18 - bedL * 0.55 / 2 + 0.075);
bedGroup.add(blanketEdge);

bedGroup.position.set(1.4, 0, -D / 2 + bedL / 2 + 0.3);
quartoScene.add(bedGroup);

// collider da cama
{
    bedGroup.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(bedGroup);
    quartoColliders.push(b);
}

// ---------------------------------------------------------------
// MESA DE CABECEIRA + VELA (luz principal)
// ---------------------------------------------------------------
const nsX = 1.4 - bedW / 2 - 0.45;   // à esquerda da cama (lado da janela)
const nsZ = -D / 2 + 0.6;
const nightG = new THREE.Group();
// tampo
const topNS = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.55), matWood);
topNS.position.set(0, 0.78, 0);
topNS.castShadow = true;
nightG.add(topNS);
// estrutura
const bodyNS = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.74, 0.5), matWoodDark);
bodyNS.position.set(0, 0.37, 0);
bodyNS.castShadow = true;
nightG.add(bodyNS);
// gaveta
const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.04), matWood);
drawer.position.set(0, 0.55, 0.25);
nightG.add(drawer);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), matMetal);
knob.position.set(0, 0.55, 0.275);
nightG.add(knob);

// castiçal + vela
const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 12), matMetal);
holder.position.set(-0.15, 0.82, -0.1);
nightG.add(holder);
const candleStick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), matCandle);
candleStick.position.set(-0.15, 0.93, -0.1);
nightG.add(candleStick);
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), matFlame);
flame.position.set(-0.15, 1.10, -0.1);
nightG.add(flame);

// livro pousado
const book1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0x4a1a1a, roughness: 0.95 }));
book1.position.set(0.12, 0.82, 0.05);
book1.rotation.y = 0.2;
nightG.add(book1);

nightG.position.set(nsX, 0, nsZ);
quartoScene.add(nightG);

// luz da vela — quente e intensa, com leve flicker no animate.
// É também o único pointlight com sombras (raio pequeno, custo baixo).
const candleLight = new THREE.PointLight(0xff8a44, 18, 7, 1.6);
candleLight.position.set(nsX - 0.15, 1.2, nsZ - 0.1);
candleLight.castShadow = true;
candleLight.shadow.mapSize.set(512, 512);
candleLight.shadow.bias = -0.002;
candleLight.shadow.camera.near = 0.1;
candleLight.shadow.camera.far = 7;
quartoScene.add(candleLight);

// collider mesa-de-cabeceira
quartoColliders.push(new THREE.Box3(
    new THREE.Vector3(nsX - 0.35, 0, nsZ - 0.27),
    new THREE.Vector3(nsX + 0.35, 0.85, nsZ + 0.27),
));

// ---------------------------------------------------------------
// BAÚ ao pé da cama — interactivo, dá poções iniciais
// ---------------------------------------------------------------
const chestG = new THREE.Group();
const chestBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.55), matWood);
chestBody.position.set(0, 0.25, 0);
chestBody.castShadow = true;
chestG.add(chestBody);
// bandas metálicas no corpo
for (const x of [-0.35, 0.35]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.57), matMetal);
    band.position.set(x, 0.25, 0);
    chestG.add(band);
}
// fechadura no corpo
const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.05), matMetal);
lock.position.set(0, 0.42, 0.29);
chestG.add(lock);

// tampa articulada — pivot no rebordo traseiro (z = -0.275)
const lidPivot = new THREE.Group();
lidPivot.position.set(0, 0.5, -0.275);
const chestLid = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.18, 0.57), matWoodDark);
chestLid.position.set(0, 0.09, 0.275);
chestLid.castShadow = true;
lidPivot.add(chestLid);
for (const x of [-0.35, 0.35]) {
    const bandL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.57), matMetal);
    bandL.position.set(x, 0.09, 0.275);
    lidPivot.add(bandL);
}
chestG.add(lidPivot);

chestG.position.set(1.4, 0, -D / 2 + bedL + 0.7);
quartoScene.add(chestG);
chestG.updateMatrixWorld(true);
quartoColliders.push(new THREE.Box3().setFromObject(chestG));

// estado + interacção do baú
let _bauAberto = false;
let _lidAnimT = 0; // 0..1 — animação a abrir
export function bauQuartoAberto() { return _bauAberto; }
export function abrirBauQuarto() {
    if (_bauAberto) return;
    _bauAberto = true;
}

// caixa de interacção em frente ao baú
export const quartoBauBox = new THREE.Box3(
    new THREE.Vector3(0.7, 0, -D / 2 + bedL + 0.95),
    new THREE.Vector3(2.1, 1.4, -D / 2 + bedL + 1.6),
);

// ---------------------------------------------------------------
// GUARDA-ROUPA — parede este
// ---------------------------------------------------------------
const wardG = new THREE.Group();
const wardBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.7), matWood);
wardBody.position.set(0, 1.15, 0);
wardBody.castShadow = true;
wardG.add(wardBody);
// portas
const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.1, 0.04), matWoodDark);
doorL.position.set(-0.32, 1.15, 0.36);
wardG.add(doorL);
const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.1, 0.04), matWoodDark);
doorR.position.set(0.32, 1.15, 0.36);
wardG.add(doorR);
// puxadores
for (const x of [-0.05, 0.05]) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), matMetal);
    k.position.set(x, 1.15, 0.4);
    wardG.add(k);
}
// rodapé
const wardBase = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.12, 0.74), matWoodDark);
wardBase.position.set(0, 0.06, 0);
wardG.add(wardBase);
wardG.position.set(W / 2 - 0.5, 0, 1.5);
wardG.rotation.y = -Math.PI / 2;
quartoScene.add(wardG);
wardG.updateMatrixWorld(true);
quartoColliders.push(new THREE.Box3().setFromObject(wardG));

// ---------------------------------------------------------------
// MESA + CADEIRA junto à janela
// ---------------------------------------------------------------
const tableG = new THREE.Group();
const tabTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), matWood);
tabTop.position.set(0, 0.82, 0);
tabTop.castShadow = true;
tableG.add(tabTop);
for (const [sx, sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.82, 0.08), matWoodDark);
    leg.position.set(sx * 0.52, 0.41, sz * 0.28);
    leg.castShadow = true;
    tableG.add(leg);
}
// papel + pena
const paper = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.005, 0.22), new THREE.MeshStandardMaterial({ color: 0xe6d8a8, roughness: 1.0 }));
paper.position.set(-0.15, 0.865, 0.05);
paper.rotation.y = 0.1;
tableG.add(paper);
const inkpot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }));
inkpot.position.set(0.2, 0.91, 0.08);
tableG.add(inkpot);
// caneca
const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0x7a5030, roughness: 0.9 }));
mug.position.set(0.35, 0.94, -0.12);
tableG.add(mug);

tableG.position.set(-W / 2 + 0.8, 0, D / 2 - 1.4);
quartoScene.add(tableG);
tableG.updateMatrixWorld(true);
quartoColliders.push(new THREE.Box3().setFromObject(tableG));

// cadeira
const chairG = new THREE.Group();
const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), matWood);
seat.position.set(0, 0.5, 0);
seat.castShadow = true;
chairG.add(seat);
for (const [sx, sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), matWoodDark);
    leg.position.set(sx * 0.2, 0.25, sz * 0.2);
    chairG.add(leg);
}
const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.06), matWood);
backrest.position.set(0, 0.85, -0.22);
chairG.add(backrest);
chairG.position.set(-W / 2 + 0.8, 0, D / 2 - 2.3);
chairG.rotation.y = Math.PI;
quartoScene.add(chairG);

// ---------------------------------------------------------------
// LANTERNA na parede este — luz secundária quente
// ---------------------------------------------------------------
const lantG = new THREE.Group();
const lantBracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.3), matMetal);
lantBracket.position.set(0, 0, 0);
lantG.add(lantBracket);
const lantBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.22), matLantern);
lantBody.position.set(0, -0.22, 0.2);
lantG.add(lantBody);
const lantGlow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), matLanternGlow);
lantGlow.position.set(0, -0.22, 0.2);
lantG.add(lantGlow);
lantG.position.set(W / 2 - 0.08, 2.3, -1.0);
lantG.rotation.y = -Math.PI / 2;
quartoScene.add(lantG);

const lantLight = new THREE.PointLight(0xffa050, 12, 6, 1.8);
lantLight.position.set(W / 2 - 0.3, 2.1, -1.0);
quartoScene.add(lantLight);

// ---------------------------------------------------------------
// ILUMINAÇÃO GLOBAL
// ---------------------------------------------------------------
// ambiente muito baixo, quente
quartoScene.add(new THREE.AmbientLight(0xffc89a, 0.18));

// luz fria pela janela (lua) — também projecta sombras suaves no chão
const moon = new THREE.SpotLight(0x88aacc, 14, 14, Math.PI * 0.32, 0.55, 1.6);
moon.position.set(-W / 2 - 2.5, winY + 0.5, 0);
moon.target.position.set(0, 0.2, 1.5);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.bias = -0.001;
moon.shadow.camera.near = 0.5;
moon.shadow.camera.far = 18;
quartoScene.add(moon, moon.target);

// "preencher" leve a azul para o lado da janela não morrer no escuro
const fill = new THREE.HemisphereLight(0x4060a0, 0x101015, 0.12);
quartoScene.add(fill);

// ---------------------------------------------------------------
// ANIMAÇÃO — flicker da vela/lanterna
// ---------------------------------------------------------------
let _t = 0;
export function updateQuarto(deltaTime) {
    _t += deltaTime;
    candleLight.intensity = 16 + Math.sin(_t * 11.3) * 1.6 + Math.sin(_t * 23.7) * 0.8;
    lantLight.intensity   = 11 + Math.sin(_t * 7.1)  * 0.9 + Math.sin(_t * 14.2) * 0.5;
    const s = 0.92 + Math.sin(_t * 12) * 0.08;
    flame.scale.set(s, 0.9 + Math.sin(_t * 9.0) * 0.1, s);

    // animação da tampa do baú a abrir
    if (_bauAberto && _lidAnimT < 1) {
        _lidAnimT = Math.min(1, _lidAnimT + deltaTime * 1.8);
        // ease-out: começa rápido, desacelera no fim
        const e = 1 - (1 - _lidAnimT) * (1 - _lidAnimT);
        lidPivot.rotation.x = -e * 1.35;
    }
}

// ---------------------------------------------------------------
// COLISÕES + CHÃO
// ---------------------------------------------------------------
export const QUARTO_FLOOR_Y = 0.06;

export function verificaColisaoQuarto(nx, ny, nz) {
    const r = 0.25;
    const pb = new THREE.Box3(
        new THREE.Vector3(nx - r, ny,        nz - r),
        new THREE.Vector3(nx + r, ny + 1.7,  nz + r),
    );
    for (const c of quartoColliders) {
        if (pb.intersectsBox(c)) return true;
    }
    return false;
}

export function tryMoveQuarto(currentY, nextX, nextZ) {
    if (verificaColisaoQuarto(nextX, currentY, nextZ)) return null;
    return QUARTO_FLOOR_Y;
}

export function getQuartoHeight(_x, _z) { return QUARTO_FLOOR_Y; }

// ---------------------------------------------------------------
// SAÍDA (porta sul) + SPAWN
// ---------------------------------------------------------------
// Porta visual na parede sul
const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.9, flatShading: true });
const doorMatDark = new THREE.MeshStandardMaterial({ color: 0x2a140a, roughness: 1.0 });
const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.16), doorMatDark);
doorFrame.position.set(-1.5, 1.2, D / 2 - 0.02);
quartoScene.add(doorFrame);
const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.08), doorMat);
door.position.set(-1.5, 1.1, D / 2 - 0.06);
quartoScene.add(door);
const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), matMetal);
doorKnob.position.set(-1.05, 1.1, D / 2 - 0.1);
quartoScene.add(doorKnob);

export const quartoSaidaBox = new THREE.Box3(
    new THREE.Vector3(-2.2, 0, D / 2 - 0.6),
    new THREE.Vector3(-0.8, 2.4, D / 2 + 0.2),
);

// caixa de interacção com a cama — em frente ao colchão (lado sul)
export const quartoCamaBox = new THREE.Box3(
    new THREE.Vector3(0.4, 0, -D / 2 + bedL / 2 + 0.3 + bedL / 2 - 0.2),
    new THREE.Vector3(2.4, 1.8, -D / 2 + bedL / 2 + 0.3 + bedL / 2 + 0.9),
);

export const quartoSpawnPos = new THREE.Vector3(-1.5, QUARTO_FLOOR_Y, D / 2 - 1.8);
