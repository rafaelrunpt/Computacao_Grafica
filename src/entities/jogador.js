import * as THREE from 'three';
import { playSFX, stopSFX } from '../systems/audio.js';
import { getNightT } from '../world/night-mode.js';

// ---------------------------------------------------------
// 1. MATERIAIS 
// ---------------------------------------------------------
const matPele = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 });
const matCabelo = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }); 
const matCamisa = new THREE.MeshStandardMaterial({ color: 0x2b529f, roughness: 0.7 }); // Casaco Azul
const matCalcas = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 }); // Calças Escuras
const matChapeu = new THREE.MeshStandardMaterial({ color: 0x9e3b45, roughness: 0.6 }); // Boné Vermelho
const matAba = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); // Aba Branca
const matOlhos = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });

export const player = new THREE.Group();

// --- VARIÁVEIS DE ALTURA ---
const alturaPerna = 0.45;
const alturaTronco = 0.45;
const raioCabeca = 0.35;

// ---------------------------------------------------------
// 2. PERNAS E TRONCO
// ---------------------------------------------------------
// Pernas (Cápsulas)
const legGeo = new THREE.CapsuleGeometry(0.1, 0.25, 8, 16);
legGeo.translate(0, -0.225, 0); // Ponto de rotação na bacia

const leftLeg = new THREE.Mesh(legGeo, matCalcas);
leftLeg.castShadow = true;
leftLeg.position.set(-0.12, alturaPerna, 0); 

const rightLeg = new THREE.Mesh(legGeo, matCalcas);
rightLeg.castShadow = true;
rightLeg.position.set(0.12, alturaPerna, 0);

// Tronco e Mochila (Agrupados)
const bodyGroup = new THREE.Group();
bodyGroup.position.y = alturaPerna + (alturaTronco / 2); // Pousado perfeitamente nas pernas

const bodyGeo = new THREE.CylinderGeometry(0.18, 0.22, alturaTronco, 32);
const body = new THREE.Mesh(bodyGeo, matCamisa);
body.castShadow = true;
bodyGroup.add(body);

// Espada às costas (em vez da mochila)
const matEspadaLamina = new THREE.MeshStandardMaterial({ color: 0xc8d4e0, roughness: 0.25, metalness: 0.85 });
const matEspadaCabo   = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.7 });
const matEspadaGuarda = new THREE.MeshStandardMaterial({ color: 0xc89030, roughness: 0.4, metalness: 0.7 });

// Helper que constrói uma cópia da espada (lâmina, guarda, cabo, pomo) — usada
// para a versão das costas e para a versão empunhada na mão.
function _construirEspada() {
    const g = new THREE.Group();
    const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), matEspadaGuarda);
    pomo.castShadow = true;
    pomo.position.y = 0.27;
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12), matEspadaCabo);
    cabo.castShadow = true;
    cabo.position.y = 0.18;
    const guarda = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), matEspadaGuarda);
    guarda.castShadow = true;
    guarda.position.y = 0.08;
    const lamina = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.015), matEspadaLamina);
    lamina.castShadow = true;
    lamina.position.y = -0.22;
    g.add(pomo, cabo, guarda, lamina);
    return g;
}

// --- Espada nas costas (estilo "Cloud" — cabo em cima, lâmina aponta para baixo)
const espadaCostas = _construirEspada();
// colada às costas (raio do tronco ~0.22; lâmina espessa 0.015 → z=-0.235 encosta)
espadaCostas.position.set(0, 0, -0.235);
// leve inclinação para o lado direito
espadaCostas.rotation.z = -Math.PI * 0.08;
bodyGroup.add(espadaCostas);

// ---------------------------------------------------------
// 3. BRAÇOS E MÃOS
// ---------------------------------------------------------
const armGeo = new THREE.CapsuleGeometry(0.07, 0.2, 8, 16);
armGeo.translate(0, -0.17, 0); // Ponto de rotação no ombro

// Braço Esquerdo (Manga + Mão)
const leftArmGroup = new THREE.Group();
const leftArm = new THREE.Mesh(armGeo, matCamisa);
leftArm.castShadow = true;
const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), matPele);
leftHand.position.y = -0.34; // Mão na ponta da manga
leftArmGroup.add(leftArm, leftHand);
leftArmGroup.position.set(-0.26, alturaPerna + alturaTronco - 0.05, 0); // Encaixado no ombro

// Braço Direito (Manga + Mão)
const rightArmGroup = new THREE.Group();
const rightArm = new THREE.Mesh(armGeo, matCamisa);
rightArm.castShadow = true;
const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), matPele);
rightHand.position.y = -0.34;
rightArmGroup.add(rightArm, rightHand);
rightArmGroup.position.set(0.26, alturaPerna + alturaTronco - 0.05, 0);

// ---------------------------------------------------------
// 4. CABEÇA, CABELO E BONÉ
// ---------------------------------------------------------
const headGroup = new THREE.Group();
headGroup.position.y = alturaPerna + alturaTronco + raioCabeca - 0.05; 

// 1. Cara 
const head = new THREE.Mesh(new THREE.SphereGeometry(raioCabeca, 32, 32), matPele);
head.castShadow = true;

// 2. Olhos 
const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), matOlhos);
leftEye.position.set(-0.12, 0.08, 0.32); 
const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), matOlhos);
rightEye.position.set(0.12, 0.08, 0.32);

// 3. Cabelo 
const hairGeo = new THREE.SphereGeometry(
    raioCabeca + 0.012, 32, 32, 
    Math.PI * 0.85,  // Começa perto da orelha direita (livra a frente)
    Math.PI * 1.3,   // Dá a volta por trás (234 graus de cabelo)
    0,               // Começa no topo (escondido debaixo do boné)
    Math.PI / 1.6    // Desce até à nuca
);
const hair = new THREE.Mesh(hairGeo, matCabelo);
hair.castShadow = true;
hair.position.y = 0;

// 4. Boné
const hatGroup = new THREE.Group();

// Cúpula do boné (Alargámos o raio para 0.38 para o cabelo não furar o teto!)
const hatDomeGeo = new THREE.CylinderGeometry(0.37, 0.38, 0.18, 32);
const hatDome = new THREE.Mesh(hatDomeGeo, matChapeu);
hatDome.castShadow = true;
hatDome.position.y = 0.28; // Pousado no topo da cabeça, a tapar a "careca"

// Aba do boné (Desenhamos apenas um ângulo de 120º virado para a frente)
// -Math.PI / 3 centra a aba geometricamente no eixo Z (frente)
const brimGeo = new THREE.CylinderGeometry(0.385, 0.385, 0.02, 32, 1, false, -Math.PI / 3, Math.PI / 1.5);
const brim = new THREE.Mesh(brimGeo, matAba);
brim.position.set(0, 0.20, 0.02); 
brim.rotation.x = -0.15; // Aba ligeiramente inclinada para cima para dar estilo

hatGroup.add(hatDome, brim);
hatGroup.rotation.x = -0.05; // Inclina o chapéu todo um bocadinho para trás

headGroup.add(head, leftEye, rightEye, hair, hatGroup);

// ---------------------------------------------------------
// 4b. COROA MÁGICA (oculta por defeito; mostra-se ao equipar)
// ---------------------------------------------------------
const matCoroaOuro = new THREE.MeshStandardMaterial({
    color: 0xffd24a, emissive: 0x4a3000, emissiveIntensity: 0.4,
    roughness: 0.25, metalness: 0.9,
});
const matCoroaPedra = new THREE.MeshStandardMaterial({
    color: 0x88aaff, emissive: 0x3050ff, emissiveIntensity: 1.4,
    roughness: 0.1, metalness: 0.4,
});

export const coroaGroup = new THREE.Group();
coroaGroup.name = 'coroaGroup';
coroaGroup.visible = false;

// aro da coroa
const aroGeo = new THREE.TorusGeometry(0.32, 0.05, 12, 28);
const aro = new THREE.Mesh(aroGeo, matCoroaOuro);
aro.rotation.x = Math.PI / 2;
aro.castShadow = true;
coroaGroup.add(aro);

// pontas (5 cones à volta)
const pontaGeo = new THREE.ConeGeometry(0.06, 0.18, 8);
const nPontas = 5;
for (let i = 0; i < nPontas; i++) {
    const a = (i / nPontas) * Math.PI * 2;
    const p = new THREE.Mesh(pontaGeo, matCoroaOuro);
    p.position.set(Math.cos(a) * 0.32, 0.08, Math.sin(a) * 0.32);
    p.castShadow = true;
    coroaGroup.add(p);
}

// pedra mágica frontal
const pedra = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), matCoroaPedra);
pedra.position.set(0, 0.02, 0.32);
coroaGroup.add(pedra);

// halo subtil em torno da pedra
const haloGeo = new THREE.SphereGeometry(0.11, 16, 16);
const matHalo = new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.18 });
const halo = new THREE.Mesh(haloGeo, matHalo);
halo.position.copy(pedra.position);
coroaGroup.add(halo);

// pousada por cima do boné
coroaGroup.position.y = 0.40;

headGroup.add(coroaGroup);

export function setCoroaVisivel(v) { coroaGroup.visible = !!v; }
// userData para animação suave da pedra
coroaGroup.userData.pedra = pedra;
coroaGroup.userData.halo  = halo;
coroaGroup.userData.t     = 0;

// ---------------------------------------------------------
// 4c. BRINCOS DA AURORA (acessório — visível ao equipar)
// ---------------------------------------------------------
const matBrincoOuro = new THREE.MeshStandardMaterial({
    color: 0xffd87a, emissive: 0x6a4500, emissiveIntensity: 0.5,
    roughness: 0.2, metalness: 0.95,
});
const matBrincoGema = new THREE.MeshStandardMaterial({
    color: 0xff5fa0, emissive: 0xff2a80, emissiveIntensity: 1.8,
    roughness: 0.1, metalness: 0.2,
});

export const brincosGroup = new THREE.Group();
brincosGroup.name = 'brincosGroup';
brincosGroup.visible = false;

for (const side of [-1, 1]) {
    const brinco = new THREE.Group();
    // aro junto à orelha
    const aroBrinco = new THREE.Mesh(
        new THREE.TorusGeometry(0.035, 0.012, 8, 16),
        matBrincoOuro
    );
    aroBrinco.rotation.y = Math.PI / 2;
    brinco.add(aroBrinco);
    // pedra suspensa
    const gema = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.05, 0),
        matBrincoGema
    );
    gema.position.y = -0.09;
    brinco.add(gema);
    // posicionamento na lateral da cabeça (à altura das orelhas)
    brinco.position.set(side * (raioCabeca + 0.005), -0.02, 0);
    brincosGroup.add(brinco);
}
brincosGroup.userData.t = 0;
brincosGroup.userData.gemaMat = matBrincoGema;
headGroup.add(brincosGroup);
export function setBrincosVisivel(v) { brincosGroup.visible = !!v; }

// ---------------------------------------------------------
// 4d. ÓCULOS DO VIDENTE (acessório — visível ao equipar)
// ---------------------------------------------------------
const matOculosArma = new THREE.MeshStandardMaterial({
    color: 0x1a1020, emissive: 0x2a0040, emissiveIntensity: 0.3,
    roughness: 0.4, metalness: 0.7,
});
const matOculosLente = new THREE.MeshStandardMaterial({
    color: 0x66ddff, emissive: 0x2080ff, emissiveIntensity: 1.6,
    roughness: 0.1, metalness: 0.2,
    transparent: true, opacity: 0.78,
});

export const oculosGroup = new THREE.Group();
oculosGroup.name = 'oculosGroup';
oculosGroup.visible = false;

// duas lentes redondas
for (const side of [-1, 1]) {
    const aro = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.012, 10, 24),
        matOculosArma
    );
    aro.position.set(side * 0.12, 0.08, raioCabeca - 0.005);
    aro.rotation.y = 0;
    oculosGroup.add(aro);

    const lente = new THREE.Mesh(
        new THREE.CircleGeometry(0.075, 24),
        matOculosLente
    );
    lente.position.set(side * 0.12, 0.08, raioCabeca - 0.003);
    oculosGroup.add(lente);
}
// ponte central
const ponte = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.012, 0.012),
    matOculosArma
);
ponte.position.set(0, 0.08, raioCabeca - 0.005);
oculosGroup.add(ponte);
// hastes (vão da lente para trás, junto às orelhas)
for (const side of [-1, 1]) {
    const haste = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, 0.30),
        matOculosArma
    );
    haste.position.set(side * 0.19, 0.08, raioCabeca - 0.16);
    oculosGroup.add(haste);
}
oculosGroup.userData.t = 0;
oculosGroup.userData.lenteMat = matOculosLente;
headGroup.add(oculosGroup);
export function setOculosVisivel(v) { oculosGroup.visible = !!v; }

// ---------------------------------------------------------
// 4e. AURÉOLA DOS CAÍDOS (acessório — flutua sobre o boné)
// ---------------------------------------------------------
const matAureolaOuro = new THREE.MeshStandardMaterial({
    color: 0x9ec8ff, emissive: 0x3060ff, emissiveIntensity: 2.0,
    roughness: 0.15, metalness: 0.9,
});
const matAureolaGlow = new THREE.MeshBasicMaterial({
    color: 0x88b0ff, transparent: true, opacity: 0.25,
});

export const aureolaGroup = new THREE.Group();
aureolaGroup.name = 'aureolaGroup';
aureolaGroup.visible = false;

const aureolaAnel = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.025, 12, 36),
    matAureolaOuro
);
aureolaAnel.rotation.x = Math.PI / 2;
aureolaGroup.add(aureolaAnel);

// brilho difuso à volta do anel
const aureolaGlow = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.075, 8, 24),
    matAureolaGlow
);
aureolaGlow.rotation.x = Math.PI / 2;
aureolaGroup.add(aureolaGlow);

aureolaGroup.position.y = 0.50;          // logo acima do boné
aureolaGroup.rotation.x = -0.32;         // inclinada para a frente
aureolaGroup.userData.t = 0;
aureolaGroup.userData.ouro = matAureolaOuro;
headGroup.add(aureolaGroup);
export function setAureolaVisivel(v) { aureolaGroup.visible = !!v; }

// ---------------------------------------------------------
// 4f. MÁSCARA DO ECLIPSE (acessório — bandolete sobre os olhos)
// ---------------------------------------------------------
const matMascaraBanda = new THREE.MeshStandardMaterial({
    color: 0x0a0612, roughness: 0.7, metalness: 0.3,
    emissive: 0x100020, emissiveIntensity: 0.4,
});
const matMascaraRuna = new THREE.MeshStandardMaterial({
    color: 0xa84bff, emissive: 0xa040ff, emissiveIntensity: 2.2,
    roughness: 0.3, metalness: 0.2,
});

export const mascaraGroup = new THREE.Group();
mascaraGroup.name = 'mascaraGroup';
mascaraGroup.visible = false;

// tira horizontal que envolve a frente da cabeça
const banda = new THREE.Mesh(
    new THREE.CylinderGeometry(raioCabeca + 0.012, raioCabeca + 0.012, 0.10, 32, 1, true, -Math.PI * 0.55, Math.PI * 1.1),
    matMascaraBanda
);
banda.position.set(0, 0.08, 0);
banda.rotation.y = Math.PI / 2;  // abertura para trás, frente coberta
mascaraGroup.add(banda);

// runa central a brilhar na testa (octaedro)
const runaTestal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.05, 0),
    matMascaraRuna
);
runaTestal.position.set(0, 0.08, raioCabeca + 0.012);
mascaraGroup.add(runaTestal);

mascaraGroup.userData.t = 0;
mascaraGroup.userData.runa = matMascaraRuna;
headGroup.add(mascaraGroup);
export function setMascaraVisivel(v) { mascaraGroup.visible = !!v; }

// ---------------------------------------------------------
// 4g. TOCHA DO VIAJANTE (item de mão — empunhada ao equipar)
// Fonte de luz do herói no modo nocturno: a PointLight vive na chama,
// por isso luz e sombras seguem a mão automaticamente.
// ---------------------------------------------------------
// Pose do braço direito ao empunhar — esticado para a frente.
const RIGHT_ARM_TORCH = -1.5;
// Intensidade base da luz (× nightT × flicker).
const TOCHA_INTENSIDADE = 2.6;

export const tochaGroup = new THREE.Group();
tochaGroup.name = 'tochaGroup';
tochaGroup.visible = false;
// agarrada na mão direita; contra-roda a pose do braço para a tocha
// ficar vertical (chama para cima) com o braço esticado.
tochaGroup.position.set(0, -0.34, 0);
tochaGroup.rotation.x = -RIGHT_ARM_TORCH;

// cabo de madeira
const matCabo = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.95 });
const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.36, 8), matCabo);
cabo.position.y = 0.18;
tochaGroup.add(cabo);

// taça metálica no topo do cabo
const matTaca = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5, metalness: 0.6 });
const taca = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.035, 0.07, 8), matTaca);
taca.position.y = 0.39;
tochaGroup.add(taca);

// chama — mesmo estilo das tochas do castelo, mas com emissivo mais
// contido para não rebentar no UnrealBloom do modo nocturno.
const matChamaInt = new THREE.MeshStandardMaterial({
    color: 0xff5a18, emissive: 0xaa3300, emissiveIntensity: 0.9,
    roughness: 1.0, metalness: 0.0,
});
const chamaInt = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.10, 6), matChamaInt);
chamaInt.position.y = 0.44;
// Sem halo aditivo externo — era ele que criava o "quadrado" de luz à frente da cara.
const chamaExt = chamaInt; // referência simbólica usada nas animações
tochaGroup.add(chamaInt);

// luz da tocha — PointLight na chama; SEM sombras (cube-shadow custa 6
// passes/frame e provocava stutter na primeira vez que se equipava).
// Intensidade base baixa para não esbranquiçar a cara do herói.
// decay sub-linear (0.5) — distribui a luz quase uniformemente: a mão
// não fica mais brilhante quando aumentamos a intensidade, mas o
// alcance ao longe ganha bastante.
const tochaLuz = new THREE.PointLight(0xffce7a, 0.0001, 22, 0.5);
tochaLuz.position.y = 0.38;
tochaLuz.castShadow = false;
tochaGroup.add(tochaLuz);

rightArmGroup.add(tochaGroup);
// Mantém o grupo presente no grafo (apenas as meshes ficam invisíveis)
// para o renderer pré-compilar o shader com a PointLight extra. Isto
// elimina o freeze de ~2s na primeira vez que a tocha é mostrada.
tochaGroup.visible = true;
for (const child of tochaGroup.children) {
    if (child.isMesh) child.visible = false;
}

tochaGroup.userData.t = 0;
tochaGroup.userData.luz = tochaLuz;
tochaGroup.userData.chamaInt = chamaInt;
tochaGroup.userData.chamaExt = chamaExt;

// Estado "tocha equipada" — controla as meshes e a contribuição da luz,
// mas mantém o grupo+luz sempre no grafo para o shader não recompilar.
let _tochaEquipada = false;
export function isTochaEquipada() { return _tochaEquipada; }
export function setTochaVisivel(v) {
    _tochaEquipada = !!v;
    for (const child of tochaGroup.children) {
        if (child.isMesh) child.visible = _tochaEquipada;
    }
}

// ---------------------------------------------------------
// 4h. ESPADA EMPUNHADA (no combate)
// ---------------------------------------------------------
// Em combate o player roda 90° e o braço direito fica atrás (lado oposto à
// câmara), por isso a espada empunhada vai no braço ESQUERDO — esse fica
// virado para a câmara e a espada aparece bem visível.
// Escala 0.6 para parecer empunhável com uma só mão; lâmina aponta para cima.
export const espadaMaoGroup = _construirEspada();
espadaMaoGroup.name = 'espadaMaoGroup';
// Espada maior e inclinada para cima-frente — aponta para o inimigo em diagonal.
const SWORD_SCALE = 0.85;
const SWORD_ROT_X = -Math.PI * 0.70;   // ~ -126°: lâmina para a frente, tilt ~36° p/ cima
espadaMaoGroup.scale.setScalar(SWORD_SCALE);
espadaMaoGroup.rotation.set(SWORD_ROT_X, 0, 0);
// Cabo (local y=+0.18) tem que coincidir com a mão (arm local y=-0.34).
// Após rotação X, cabo passa para (0, 0.18*cosθ, 0.18*sinθ) e escala SWORD_SCALE.
{
    const _cY = 0.18 * Math.cos(SWORD_ROT_X) * SWORD_SCALE;
    const _cZ = 0.18 * Math.sin(SWORD_ROT_X) * SWORD_SCALE;
    espadaMaoGroup.position.set(0, -0.34 - _cY, -_cZ);
}
leftArmGroup.add(espadaMaoGroup);
for (const child of espadaMaoGroup.children) child.visible = false;

let _espadaMaoEquipada = false;
export function setEspadaMaoVisivel(v) {
    _espadaMaoEquipada = !!v;
    for (const child of espadaMaoGroup.children) child.visible = _espadaMaoEquipada;
    // esconder a espada das costas quando empunhada
    espadaCostas.visible = !_espadaMaoEquipada;
}

// ---------------------------------------------------------
// 5. JUNTAR TUDO NO BONECO
// ---------------------------------------------------------
player.add(leftLeg, rightLeg, bodyGroup, leftArmGroup, rightArmGroup, headGroup);

// Guardar para a animação
player.userData.leftLeg = leftLeg;
player.userData.rightLeg = rightLeg;
player.userData.leftArm = leftArmGroup; 
player.userData.rightArm = rightArmGroup;

player.position.set(3, 0, 5);
// baseY = altura "intencional" definida pelo gameplay (chão da loja, ponte, teleport).
// A animação do andar só pode somar/subtrair o bounce por cima deste valor.
player.userData.baseY = 0;

// ---------------------------------------------------------
// 6. ANIMAÇÃO
// ---------------------------------------------------------
let walkTime = 0;
let _lastStepSide = 0; // 1 para direita, -1 para esquerda
let _lastSurface = null;
export function updateCoroaAnimacao(deltaTime) {
    if (coroaGroup.visible) {
        coroaGroup.userData.t += deltaTime;
        const pulse = 1.0 + Math.sin(coroaGroup.userData.t * 4) * 0.25;
        coroaGroup.userData.pedra.material.emissiveIntensity = 1.0 + 0.6 * pulse;
        coroaGroup.userData.halo.scale.setScalar(0.9 + 0.2 * pulse);
    }
    if (brincosGroup.visible) {
        brincosGroup.userData.t += deltaTime;
        const pulse = 0.5 + Math.sin(brincosGroup.userData.t * 5) * 0.5;
        brincosGroup.userData.gemaMat.emissiveIntensity = 1.4 + 0.8 * pulse;
    }
    if (oculosGroup.visible) {
        oculosGroup.userData.t += deltaTime;
        const pulse = 0.5 + Math.sin(oculosGroup.userData.t * 3) * 0.5;
        oculosGroup.userData.lenteMat.emissiveIntensity = 1.2 + 0.9 * pulse;
    }
    if (aureolaGroup.visible) {
        aureolaGroup.userData.t += deltaTime;
        const t = aureolaGroup.userData.t;
        aureolaGroup.rotation.y += deltaTime * 1.2;
        aureolaGroup.position.y = 0.50 + Math.sin(t * 2.2) * 0.04;
        aureolaGroup.userData.ouro.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5;
    }
    if (mascaraGroup.visible) {
        mascaraGroup.userData.t += deltaTime;
        const pulse = 0.5 + Math.sin(mascaraGroup.userData.t * 2.5) * 0.5;
        mascaraGroup.userData.runa.emissiveIntensity = 1.5 + 1.2 * pulse;
    }
    if (_tochaEquipada) {
        tochaGroup.userData.t += deltaTime;
        const tt = tochaGroup.userData.t;
        // flicker irregular — duas frequências, como uma chama a tremer
        const flick = 0.80 + 0.13 * Math.sin(tt * 11) + 0.09 * Math.sin(tt * 23 + 1.3);
        // Luz activa sempre que a tocha está equipada (mundo dia/noite e interiores)
        tochaGroup.userData.luz.intensity = TOCHA_INTENSIDADE * flick;
        const chama = tochaGroup.userData.chamaInt;
        chama.scale.set(1, 0.88 + 0.20 * Math.sin(tt * 13), 1);
        chama.material.emissiveIntensity = 0.85 + 0.25 * Math.sin(tt * 9 + 0.7);
    } else {
        tochaGroup.userData.luz.intensity = 0.0001;
    }
}

export function updatePlayerAnimation(isMoving, deltaTime, surfaceType = 'grass') {
    // Madeira ligeiramente acelerada (22), resto normal (17)
    const walkSpeed = (surfaceType === 'wood') ? 22 : 17;
    const stepAmplitude = 0.6;
    const armAmplitude = 0.5;

    const baseY = player.userData.baseY ?? 0;

    if (isMoving) {
        // Evitar overlap entre superfícies diferentes (ex: sair da ponte para a relva)
        if (_lastSurface && _lastSurface !== surfaceType) {
            stopSFX(`step_${_lastSurface}`);
        }
        _lastSurface = surfaceType;

        walkTime += deltaTime * walkSpeed;

        const s = Math.sin(walkTime);
        player.userData.leftLeg.rotation.x = s * stepAmplitude;
        player.userData.rightLeg.rotation.x = -s * stepAmplitude;

        player.userData.leftArm.rotation.x = -s * armAmplitude;
        player.userData.rightArm.rotation.x = s * armAmplitude;

        const bounce = Math.abs(s) * 0.06;
        player.position.y = baseY + bounce;

        // Gatilho de som de passos (idêntico para todos)
        const currentSide = Math.sign(s);
        if (currentSide !== 0 && currentSide !== _lastStepSide) {
            _lastStepSide = currentSide;
            playSFX(`step_${surfaceType}`);
        }

    } else {
        // Parar sons imediatamente
        stopSFX('step_grass');
        stopSFX('step_wood');
        stopSFX('step_stone');

        player.userData.leftLeg.rotation.x = 0;
        player.userData.rightLeg.rotation.x = 0;
        player.userData.leftArm.rotation.x = 0;
        player.userData.rightArm.rotation.x = 0;
        player.position.y = baseY;
        walkTime = 0;
        _lastStepSide = 0;
        _lastSurface = null;
    }

    // Tocha equipada → braço direito esticado a empunhá-la (sobrepõe o balanço do andar).
    if (_tochaEquipada) {
        player.userData.rightArm.rotation.x = RIGHT_ARM_TORCH;
    }
}