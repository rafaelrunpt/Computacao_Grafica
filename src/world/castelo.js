import * as THREE from 'three';
import { matBattleGrass, matBattleSky, matBattleDark } from './shaders.js';
import { criarAcessorio } from './acessorios.js';
import { atualizarSomVorticeCristal, getAudioListener, setSwooshAudio } from '../systems/audio.js';
import { registerLight } from '../systems/moderator.js';

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
    registerLight('Castelo', `Tocha ${ti + 1}`, flame);

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
// Texturas são CARREGADAS LAZILY (ver _lazyTex + precarregarTexturasCastelo).
// O castelo ocupa ~110 MB de VRAM em texturas 1K não-comprimidas; deferir o
// upload até o jogador efectivamente entrar no castelo poupa essa memória
// durante toda a fase inicial do jogo (placas integradas com 500 MB beneficiam
// bastante; em placas dedicadas é só boa higiene).
const _texLoader = new THREE.TextureLoader();
const _lazyQueue = []; // { tex, url }
let _texturasCarregadas = false;
function _lazyTex(url) {
    // Texturas do castelo convertidas para WebP (-90% no disco/download).
    // Redirecciona qualquer .png para .webp transparentemente.
    url = url.replace(/\.png$/, '.webp');
    const tex = new THREE.Texture();
    _lazyQueue.push({ tex, url });
    return tex;
}
export function precarregarTexturasCastelo() {
    if (_texturasCarregadas) return;
    _texturasCarregadas = true;
    for (const { tex, url } of _lazyQueue) {
        _texLoader.load(url, (loaded) => {
            if (loaded && loaded.image) {
                tex.image = loaded.image;
                tex.needsUpdate = true;
            }
        });
    }
}

// PAREDE
const texBaseW = 'assets/textures/castelo/parede/Bricks058_1K-PNG_';
const mapColorW = _lazyTex(texBaseW + 'Color.png');
const mapNormalW = _lazyTex(texBaseW + 'NormalGL.png');
const mapRoughnessW = _lazyTex(texBaseW + 'Roughness.png');

[mapColorW, mapNormalW, mapRoughnessW].forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2); 
});
mapColorW.colorSpace = THREE.SRGBColorSpace;

const matStone = new THREE.MeshStandardMaterial({
    map: mapColorW,
    normalMap: mapNormalW,
    roughnessMap: mapRoughnessW,
    roughness: 1.0,
});

// CHÃO
const texBaseF = 'assets/textures/castelo/chao/Rubber001_1K-PNG/Rubber001_1K-PNG_';
const mapColorF = _lazyTex(texBaseF + 'Color.png');
const mapNormalF = _lazyTex(texBaseF + 'NormalGL.png');
const mapRoughnessF = _lazyTex(texBaseF + 'Roughness.png');

[mapColorF, mapNormalF, mapRoughnessF].forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6); 
});
mapColorF.colorSpace = THREE.SRGBColorSpace;

const matFloor = new THREE.MeshStandardMaterial({
    map: mapColorF,
    normalMap: mapNormalF,
    roughnessMap: mapRoughnessF,
    roughness: 0.8,
});

// PILARES
const texBaseP = 'assets/textures/castelo/pilares/Travertine013_1K-PNG/Travertine013_1K-PNG_';
const mapColorP = _lazyTex(texBaseP + 'Color.png');
const mapNormalP = _lazyTex(texBaseP + 'NormalGL.png');
const mapRoughnessP = _lazyTex(texBaseP + 'Roughness.png');

[mapColorP, mapNormalP, mapRoughnessP].forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4); // Repete mais na vertical para o fuste do pilar
});
mapColorP.colorSpace = THREE.SRGBColorSpace;

const matPillar = new THREE.MeshStandardMaterial({
    map: mapColorP,
    normalMap: mapNormalP,
    roughnessMap: mapRoughnessP,
    roughness: 0.9,
});

// PLATAFORMA PIRÂMIDE (Altar)
const texBaseA = 'assets/textures/castelo/plataforma_piramide/Fabric004_1K-PNG/Fabric004_1K-PNG_';
const mapColorA = _lazyTex(texBaseA + 'Color.png');
const mapNormalA = _lazyTex(texBaseA + 'NormalGL.png');
const mapRoughnessA = _lazyTex(texBaseA + 'Roughness.png');
const mapMetalnessA = _lazyTex(texBaseA + 'Metalness.png');

[mapColorA, mapNormalA, mapRoughnessA, mapMetalnessA].forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
});
mapColorA.colorSpace = THREE.SRGBColorSpace;

const matAltar = new THREE.MeshStandardMaterial({
    map: mapColorA,
    normalMap: mapNormalA,
    roughnessMap: mapRoughnessA,
    metalnessMap: mapMetalnessA,
    roughness: 0.8,
});

// TAPETE
const texBaseT = 'assets/textures/castelo/tapete/Fabric016_1K-PNG/Fabric016_1K-PNG_';
const mapColorT = _lazyTex(texBaseT + 'Color.png');
const mapNormalT = _lazyTex(texBaseT + 'NormalGL.png');
const mapRoughnessT = _lazyTex(texBaseT + 'Roughness.png');

[mapColorT, mapNormalT, mapRoughnessT].forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4); 
});
mapColorT.colorSpace = THREE.SRGBColorSpace;

const matCarpet = new THREE.MeshStandardMaterial({
    map: mapColorT,
    normalMap: mapNormalT,
    roughnessMap: mapRoughnessT,
    color: 0xaa4444,
    roughness: 1.0,
});

const matStoneDark= new THREE.MeshStandardMaterial({ color: 0x3a3550, roughness: 0.9, flatShading: true });
const matRune     = new THREE.MeshStandardMaterial({ color: 0xaa44ff, emissive: 0x8800cc, emissiveIntensity: 1.8 });

// TEXTURAS DE METAL PINTADO (Partilhadas entre Teto e Cristal)
const texBaseC = 'assets/textures/castelo/cristal/PaintedMetal002_1K-PNG/PaintedMetal002_1K-PNG_';
const mapColorC = _lazyTex(texBaseC + 'Color.png');
const mapNormalC = _lazyTex(texBaseC + 'NormalGL.png');
const mapRoughnessC = _lazyTex(texBaseC + 'Roughness.png');
const mapMetalnessC = _lazyTex(texBaseC + 'Metalness.png');

// MATERIAL DO TETO (mesma textura do cristal mas repeat 8×8).
// Não usamos .clone() porque o clone não acompanha o `image` do original quando
// este é carregado lazily — duplicamos o lazyTex com o mesmo URL.
const mapColorCeil = _lazyTex(texBaseC + 'Color.png');
const mapNormalCeil = _lazyTex(texBaseC + 'NormalGL.png');
const mapRoughnessCeil = _lazyTex(texBaseC + 'Roughness.png');
[mapColorCeil, mapNormalCeil, mapRoughnessCeil].forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8); 
});
const matCeiling = new THREE.MeshStandardMaterial({
    map: mapColorCeil,
    normalMap: mapNormalCeil,
    roughnessMap: mapRoughnessCeil,
    color: 0x6600aa, // Roxo mais vibrante (igual à cor base do cristal)
    emissive: 0x330088, // Adicionado brilho emissivo roxo
    emissiveIntensity: 0.8, // Intensidade para não ficar totalmente preto
    roughness: 0.6, // Ligeiramente mais brilhante para refletir luzes
    metalness: 0.5,
});

// ---- CORRUPÇÃO MÍSTICA DO TETO ----
// A textura de metal pintado mantém-se; por cima do material PBR é
// injectado um shader que faz alastrar veias/vórtice de energia roxa.
// `uCorrupcao` (0..1) cresce à medida que os pedestais são preenchidos
// e chega ao máximo quando os 5 cilindros estão activos.
const _ceilingUniforms = {
    uTime:      { value: 0 },
    uCorrupcao: { value: 0 },
};
matCeiling.onBeforeCompile = (shader) => {
    shader.uniforms.uTime      = _ceilingUniforms.uTime;
    shader.uniforms.uCorrupcao = _ceilingUniforms.uCorrupcao;

    shader.vertexShader = 'varying vec2 vCorrUv;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n    vCorrUv = uv;'
    );

    shader.fragmentShader =
        'varying vec2 vCorrUv;\n' +
        'uniform float uTime;\n' +
        'uniform float uCorrupcao;\n' +
        'float corrHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
        'float corrSn(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);\n' +
        '  return mix(mix(corrHash(i), corrHash(i+vec2(1.0,0.0)), f.x),\n' +
        '             mix(corrHash(i+vec2(0.0,1.0)), corrHash(i+vec2(1.0,1.0)), f.x), f.y); }\n' +
        'float corrFbm(vec2 p){ float v=0.0, a=0.5;\n' +
        '  for(int i=0;i<3;i++){ v+=a*corrSn(p); p=p*2.1+vec2(3.1,1.7); a*=0.5; } return v; }\n' +
        'vec2 corrRot(vec2 p, float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*p; }\n' +
        shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            if (uCorrupcao > 0.001) {
                float T = uTime;
                vec2 p = vCorrUv * 7.0;
                // vórtice
                vec2 sw = corrRot(p - 3.5, T * 0.09);
                float swirlN = corrFbm(sw * 1.3 + vec2(T * 0.06, 0.0));
                // veias de corrupção — largas e em 3 camadas, bem visíveis
                float veins = pow(corrSn(p * 2.0 + T * 0.16), 3.0)
                            + pow(corrSn(p * 1.5 - T * 0.12 + 1.7), 4.0) * 0.9
                            + pow(corrSn(p * 3.0 + T * 0.20 + 4.3), 5.0) * 0.6;
                // brilhos pontuais
                float spark = pow(corrSn(p * 3.4 + T * 0.30), 7.0);
                spark      += pow(corrSn(p * 5.0 - T * 0.24 + 5.1), 8.0) * 0.8;
                float pulse = 0.5 + 0.5 * sin(T * 2.0);
                vec3 glowMid    = vec3(0.45, 0.05, 0.85);
                vec3 glowBright = vec3(0.95, 0.30, 1.30);
                vec3 sparkCol   = vec3(1.30, 0.75, 1.30);
                vec3 corr = glowMid * swirlN * 1.4;
                corr += glowBright * veins * (1.0 + 0.7 * pulse);
                corr += sparkCol * spark * (0.8 + 0.6 * pulse);
                // escurece bem a base para o glow saltar à vista
                gl_FragColor.rgb = mix(gl_FragColor.rgb,
                                       gl_FragColor.rgb * 0.45, uCorrupcao * 0.6);
                gl_FragColor.rgb += corr * uCorrupcao;
            }`
        );
};
matCeiling.needsUpdate = true;


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

    // corrupção do teto — só ativa quando os 5 cilindros estão todos
    // activos; faz uma transição suave do limpo para o corrompido.
    _ceilingUniforms.uTime.value += deltaTime;
    const _alvoCorr = todosPedestaisCheios() ? 1 : 0;
    const _c = _ceilingUniforms.uCorrupcao;
    // Aumentado de 0.35 para 0.5 para chegar à velocidade máxima um pouco mais rápido
    _c.value += (_alvoCorr - _c.value) * Math.min(1, deltaTime * 0.5);

    // Atualiza o som do vórtice dinamicamente
    atualizarSomVorticeCristal(_c.value);

    // Quando todos os pedestais estão cheios, o cristal sobe e o feixe intensifica
    if (_c.value > 0.001) {
        // Cristal sobe suavemente até um máximo de +2.0m da posição base
        const targetY = bossCrystalRestY + (_c.value * 2.0);
        bossCrystal.position.y += (targetY - bossCrystal.position.y) * Math.min(1, deltaTime * 0.8);
        
        // Luz acompanha o cristal e ganha intensidade progressiva
        crystalLight.position.y = bossCrystal.position.y;
        const glow = Math.sin(performance.now() * 0.001 * Math.PI) * 0.5 + 0.5;
        crystalLight.intensity = _c.value * (12 + glow * 28);
        crystalLight.color.setHSL(0.75, 1.0, 0.4 + glow * 0.25);

        // Feixe intensifica (de 0.15 a 0.8)
        _feixeMat.uniforms.uIntensity.value = 0.15 + _c.value * 0.65;
        
        // Partículas à volta do cristal tornam-se mais densas e sincronizam o pulso
        _mistMat.uniforms.uActivation.value = _c.value;
        _mistMat.uniforms.uPulse.value = glow; // Passamos o pulso lento (0..1) para o shader

        // Cristal acelera a rotação em sincronia com a ativação (Apenas Eixo Y)
        const easedC = _c.value * _c.value;
        const rotSpeed = 1.2 + easedC * 6.8;
        bossCrystal.rotation.y += deltaTime * rotSpeed;
        
        // Garante que X e Z ficam estáticos/alinhados
        bossCrystal.rotation.x = 0;
        bossCrystal.rotation.z = 0;
    } else {
        // Rotação base calma (Apenas Eixo Y)
        bossCrystal.rotation.y += deltaTime * 1.2;
        bossCrystal.rotation.x = 0;
        bossCrystal.rotation.z = 0;
        crystalLight.intensity *= 0.9; // Apaga luz se desativar
        _mistMat.uniforms.uActivation.value *= 0.9;
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

// ---- "céu" corrupto agora com textura de metal pintado ----
{
    const tetoSize = Math.max(W, D) * 6;
    const teto = new THREE.Mesh(
        new THREE.PlaneGeometry(tetoSize, tetoSize),
        matCeiling
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
        // capitel — mesma textura do fuste do pilar
        box(1.3, 0.4, 1.3, matPillar, px, H - 0.2, pz);
        // base — mesma textura do fuste do pilar
        box(1.3, 0.4, 1.3, matPillar, px, 0.2, pz);
    }
}

// ---- altar do boss (fundo) ----
// plataforma escalonada
box(6, 0.5, 4, matAltar,  0, 0.25, -D / 2 + 3.5);
box(4.5, 0.5, 3, matAltar, 0, 0.75, -D / 2 + 3.2);
box(3, 0.5, 2.2, matAltar, 0, 1.25, -D / 2 + 3.0);

// ---- prisma do boss — agora em cima da pirâmide do altar ----
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
mapColorC.colorSpace = THREE.SRGBColorSpace;

const crystalGeo = new THREE.OctahedronGeometry(0.7, 0);
const crystalMat = new THREE.MeshStandardMaterial({
    map: mapColorC,
    normalMap: mapNormalC,
    roughnessMap: mapRoughnessC,
    metalnessMap: mapMetalnessC,
    color: 0x8844ff,
    emissive: 0x4400aa,
    emissiveIntensity: 1.8, // Ligeiro aumento no brilho
    transparent: false,
    opacity: 1.0,
    metalness: 1.0,
    roughness: 0.2,
    flatShading: true,
});
const crystal = new THREE.Mesh(crystalGeo, crystalMat);
crystal.position.set(TOTEM_X, TOTEM_TOP_Y + 0.95, TOTEM_Z);
crystal.rotation.y = Math.PI / 4;
crystal.castShadow = false;
caseloScene.add(crystal);
export const bossCrystal = crystal;

// Configura Áudio Posicional (3D) para o swoosh
const listener = getAudioListener();
if (listener) {
    const swooshPositional = new THREE.PositionalAudio(listener);
    const loader = new THREE.AudioLoader();
    loader.load('assets/sounds/swoosh.mp3', (buffer) => {
        swooshPositional.setBuffer(buffer);
        swooshPositional.setRefDistance(3); // Começa a baixar após 3 metros
        swooshPositional.setRolloffFactor(2); // Baixa depressa com a distância
        swooshPositional.setDistanceModel('exponential');
        setSwooshAudio(swooshPositional);
    });
    crystal.add(swooshPositional); // Acopla o som ao cristal para efeito 3D
}

// Luz dinâmica que o cristal emite ao ativar
const crystalLight = new THREE.PointLight(0xcc66ff, 0, 15);
crystalLight.position.set(TOTEM_X, TOTEM_TOP_Y + 0.95, TOTEM_Z);
crystalLight.castShadow = false; // Evita excesso de luzes com sombra
caseloScene.add(crystalLight);

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
    new THREE.Vector3(-2.2, 0,  D / 2),
    new THREE.Vector3( 2.2, 3,  D / 2 + 2.0)
);

// ---- colisores interiores ----
export const caseloColliders = [
    // paredes (ajustadas para bater certo com os 0.6 de espessura visual)
    new THREE.Box3(new THREE.Vector3(-W/2-0.1, 0, -D/2-0.1), new THREE.Vector3(-W/2+0.3, H, D/2+2.0)),
    new THREE.Box3(new THREE.Vector3( W/2-0.3, 0, -D/2-0.1), new THREE.Vector3( W/2+0.1, H, D/2+2.0)),
    new THREE.Box3(new THREE.Vector3(-W/2, 0, -D/2-0.1),     new THREE.Vector3( W/2, H, -D/2+0.3)),
    // parede sul: movida mais para trás (z=D/2 + 1.5)
    new THREE.Box3(new THREE.Vector3(-W/2, 0, D/2+1.5),      new THREE.Vector3( W/2, H, D/2+2.0)),
    // altar (pirâmide escalonada — agora também serve de pedestal do cristal) - atualizado para 8x5
    new THREE.Box3(new THREE.Vector3(-4.1, 0, -D/2+1.0),     new THREE.Vector3( 4.1, 2.5, -D/2+6.0)),
    // pilares
    new THREE.Box3(new THREE.Vector3(-W/2+0.8, 0, -D/2+0.8), new THREE.Vector3(-W/2+2.2, H, -D/2+2.2)),
    new THREE.Box3(new THREE.Vector3( W/2-2.2, 0, -D/2+0.8), new THREE.Vector3( W/2-0.8, H, -D/2+2.2)),
    new THREE.Box3(new THREE.Vector3(-W/2+0.8, 0,  D/2-2.2), new THREE.Vector3(-W/2+2.2, H,  D/2-0.8)),
    new THREE.Box3(new THREE.Vector3( W/2-2.2, 0,  D/2-2.2), new THREE.Vector3( W/2-0.8, H,  D/2-0.8)),
];

// ---- posição de spawn dentro do castelo ----
export const caseloSpawnPos = new THREE.Vector3(0, 0, D / 2 + 0.5);

// ---- minimapa ortográfico ----
export const caseloMiniCam = new THREE.OrthographicCamera(
    -W / 2 - 1,  W / 2 + 1,
     D / 2 + 3, -D / 2 - 1,
    0.1, 60
);
caseloMiniCam.position.set(0, 25, 0);
caseloMiniCam.lookAt(0, 0, 0);


const _atmosTime = { t: 0, mist: 0 };


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
    const N = 120; // Aumentado de 50 para 120 para preencher melhor
    const positions = new Float32Array(N * 3);
    const phases    = new Float32Array(N);
    const radii     = new Float32Array(N);
    const speeds    = new Float32Array(N);

    for (let i = 0; i < N; i++) {
        positions[i*3]   = TOTEM_X;
        positions[i*3+1] = TOTEM_TOP_Y + 0.1 + Math.random() * 4.5;
        positions[i*3+2] = TOTEM_Z;
        phases[i] = Math.random() * Math.PI * 2;
        radii[i]  = 0.4 + Math.random() * 1.5;
        speeds[i] = 0.5 + Math.random() * 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aRadius',  new THREE.BufferAttribute(radii, 1));
    geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uMistTime: { value: 0 },
            uPulse: { value: 0 }, // Sincronizado com o cristal (0..1)
            uActivation: { value: 0 }, // 0..1 para controlar densidade/agitação
            uPixelRatio: { value: window.devicePixelRatio || 1 },
        },
        vertexShader: `
            attribute float aPhase;
            attribute float aRadius;
            attribute float aSpeed;
            uniform float uMistTime;
            uniform float uActivation;
            uniform float uPixelRatio;
            varying float vPulse;
            varying float vAlpha;
            void main() {
                float t = uMistTime;
                float ang = t * (0.45 + aRadius * 0.2) * aSpeed + aPhase;
                
                // As partículas espalham-se mais com a ativação
                float r = aRadius * (1.0 + uActivation * 0.5);
                vec3 p = position;
                p.x += cos(ang) * r;
                p.z += sin(ang) * r;
                // Sobem mais alto com a ativação
                p.y += sin(t * 0.6 + aPhase) * 0.5 + (uActivation * aPhase * 0.5);
                
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                float d = -mv.z;
                
                // Tamanho aumenta com ativação
                gl_PointSize = uPixelRatio * (4.0 + 3.0 * uActivation) * (35.0 / max(d, 1.0));
                vPulse = 0.5 + 0.5 * sin(t * 2.0 + aPhase);
                vAlpha = smoothstep(0.1, 0.4, aPhase/6.28 + uActivation); // Mais partículas visíveis com uActivation
            }
        `,
        fragmentShader: `
            uniform float uPulse;
            varying float vPulse;
            varying float vAlpha;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                
                // Sincroniza as cores com o cristal: roxo escuro -> roxo elétrico
                vec3 c1 = vec3(0.13, 0.0, 0.26); // Equivale a 0x220044
                vec3 c2 = vec3(0.53, 0.0, 1.0);  // Equivale a 0x8800ff
                vec3 col = mix(c1, c2, uPulse);
                
                // Adiciona um brilho individual extra para não ser uniforme demais
                col *= (0.8 + 0.4 * vPulse);
                
                gl_FragColor = vec4(col, core * (0.3 + 0.5 * vPulse) * vAlpha);
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
        uniforms: { 
            uTime: { value: 0 },
            uIntensity: { value: 0.15 }, // Intensidade base baixa
        },
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
            uniform float uIntensity;
            varying float vNorm;
            void main() {
                // mais brilho perto do topo (fonte)
                float fade = pow(vNorm, 1.6);
                fade *= 0.55 + 0.25 * sin(uTime * 1.5);
                vec3 col = vec3(0.50, 0.15, 0.85);
                gl_FragColor = vec4(col * fade * (uIntensity * 4.0), fade * uIntensity);
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

    // Tempo acumulado para as partículas do cristal (permite aceleração suave sem saltos)
    const mistSpeed = 1.0 + _mistMat.uniforms.uActivation.value * 1.5;
    _atmosTime.mist += deltaTime * mistSpeed;

    const corruption = _ceilingUniforms.uCorrupcao.value;
    const orangeLight = new THREE.Color(0xff6600);
    const purpleLight = new THREE.Color(0x9933ff);
    const orangeFire  = new THREE.Color(0xff4400);
    const purpleFire  = new THREE.Color(0x6600aa);
    const orangeEmiss = new THREE.Color(0xff2200);
    const purpleEmiss = new THREE.Color(0x330088);

    // flicker independente por tocha (intensidade da luz + emissive da chama)
    for (const tch of _torches) {
        const f = 0.80
                + 0.30 * Math.sin(t * 12 + tch.phase)
                + 0.15 * Math.sin(t * 23 + tch.phase * 1.7);
        tch.light.intensity = tch.baseIntensity * f;
        
        // Transição de cor baseada na corrupção
        tch.light.color.copy(orangeLight).lerp(purpleLight, corruption);
        tch.fire.material.color.copy(orangeFire).lerp(purpleFire, corruption);
        tch.fire.material.emissive.copy(orangeEmiss).lerp(purpleEmiss, corruption);

        tch.fireMat.emissiveIntensity = 1.6 + 1.0 * f * 0.5;
        tch.fire.scale.y = 0.9 + 0.20 * Math.cos(t * 11 + tch.phase);
        tch.fire.scale.x = 0.95 + 0.10 * Math.sin(t * 15 + tch.phase);
    }

    // uniforms dos shaders de partículas / feixe
    _embersMat.uniforms.uTime.value = t;
    _motesMat .uniforms.uTime.value = t;
    _mistMat  .uniforms.uTime.value = t;
    _mistMat  .uniforms.uMistTime.value = _atmosTime.mist;
    _feixeMat .uniforms.uTime.value = t;
}
