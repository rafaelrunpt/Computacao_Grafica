import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerLight } from '../systems/moderator.js';

// ======================================================================
// BOSS FINAL — modelo procedural em three.js.
// ----------------------------------------------------------------------
// • Constrói uma figura humanóide imponente e robusta (~4 unidades de altura).
// • Usa o módulo `acessorios.js` para vestir os 5 acessórios que
//   aparecem nos pedestais do castelo (coroa, brincos, auréola,
//   óculos, máscara). Por defeito veste só a coroa.
//   Podes mudar com `vestirAcessoriosBoss([ids...])`.
// • Cada material está marcado como "TEXTURE SLOT" — substitui o `.map`
//   ou usa `aplicarTexturaBoss(slot, url)` para trocar a textura.
// ======================================================================
import { criarAcessorio } from '../world/acessorios.js';

const _texLoader = new THREE.TextureLoader();

// ----------------------------------------------------------------------
// TEXTURE SLOTS — materiais com placeholders.
// ----------------------------------------------------------------------

// === TEXTURE SLOT: armor === (peitoral / placas / pernas)
export const matBossArmor = new THREE.MeshStandardMaterial({
    color: 0x2a1f3a,
    roughness: 0.55,
    metalness: 0.55,
    flatShading: true,
});

// === TEXTURE SLOT: armor_dark === (placas escuras / juntas)
export const matBossArmorDark = new THREE.MeshStandardMaterial({
    color: 0x14081f,
    roughness: 0.7,
    metalness: 0.45,
    flatShading: true,
});

// === TEXTURE SLOT: cape === (capa atrás do boss)
export const matBossCape = new THREE.MeshStandardMaterial({
    color: 0x4a0e25,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
    flatShading: true,
});

// === TEXTURE SLOT: cape_lining === (forro interior da capa)
export const matBossCapeLining = new THREE.MeshStandardMaterial({
    color: 0x1a0a14,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide,
});

// === TEXTURE SLOT: skin === (pele/rosto/pescoço — visível sob a máscara)
export const matBossSkin = new THREE.MeshStandardMaterial({
    color: 0xc4a890,
    emissive: 0x3a2a1c,
    emissiveIntensity: 0.6,
    roughness: 0.75,
    metalness: 0.08,
    flatShading: true,
});

// === TEXTURE SLOT: leather === (cintos / correias / luvas)
export const matBossLeather = new THREE.MeshStandardMaterial({
    color: 0x3a2010,
    roughness: 0.9,
    metalness: 0.15,
});

// === TEXTURE SLOT: metal === (fivelas / detalhes metálicos)
export const matBossMetal = new THREE.MeshStandardMaterial({
    color: 0xb89640,
    roughness: 0.25,
    metalness: 0.95,
    emissive: 0x2a1800,
    emissiveIntensity: 0.4,
});

// === TEXTURE SLOT: claws === (garras das mãos)
export const matBossClaws = new THREE.MeshStandardMaterial({
    color: 0x0a0612,
    roughness: 0.3,
    metalness: 0.85,
    emissive: 0x3a0050,
    emissiveIntensity: 0.6,
});

// === TEXTURE SLOT: eye === (núcleo dos olhos — emissive)
export const matBossEye = new THREE.MeshStandardMaterial({
    color: 0xff3030,
    emissive: 0xff2010,
    emissiveIntensity: 2.6,
    roughness: 0.2,
    metalness: 0.0,
});

// === TEXTURE SLOT: aura === (saia/aura de energia na base — sem map, só cor/glow)
export const matBossAura = new THREE.MeshBasicMaterial({
    color: 0x6020c0,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

// === TEXTURE SLOT: rune === (runas que brilham no peito)
export const matBossRune = new THREE.MeshStandardMaterial({
    color: 0xaa44ff,
    emissive: 0x8800cc,
    emissiveIntensity: 2.2,
    roughness: 0.4,
    metalness: 0.0,
});

// registo central para o helper aplicarTexturaBoss
const _SLOTS = {
    armor:        matBossArmor,
    armor_dark:   matBossArmorDark,
    cape:         matBossCape,
    cape_lining:  matBossCapeLining,
    skin:         matBossSkin,
    leather:      matBossLeather,
    metal:        matBossMetal,
    claws:        matBossClaws,
    eye:          matBossEye,
    aura:         matBossAura,
    rune:         matBossRune,
};

/**
 * Aplica uma textura a um slot do boss.
 */
export function aplicarTexturaBoss(slot, url, opts = {}) {
    const mat = _SLOTS[slot];
    if (!mat) { console.warn('[Boss] slot desconhecido:', slot); return; }
    url = url.replace(/\.png$/, '.webp');
    if (opts.normalUrl)    opts.normalUrl    = opts.normalUrl.replace(/\.png$/, '.webp');
    if (opts.roughnessUrl) opts.roughnessUrl = opts.roughnessUrl.replace(/\.png$/, '.webp');
    _texLoader.load(url, (tex) => {
        if (opts.repeat) {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(opts.repeat[0], opts.repeat[1]);
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex;
        if (opts.color    != null) mat.color.setHex(opts.color);
        if (opts.emissive != null && mat.emissive) mat.emissive.setHex(opts.emissive);
        mat.needsUpdate = true;
    });
    if (opts.normalUrl && 'normalMap' in mat) {
        _texLoader.load(opts.normalUrl, (n) => {
            if (opts.repeat) {
                n.wrapS = n.wrapT = THREE.RepeatWrapping;
                n.repeat.set(opts.repeat[0], opts.repeat[1]);
            }
            mat.normalMap = n;
            mat.needsUpdate = true;
        });
    }
    if (opts.roughnessUrl && 'roughnessMap' in mat) {
        _texLoader.load(opts.roughnessUrl, (r) => {
            if (opts.repeat) {
                r.wrapS = r.wrapT = THREE.RepeatWrapping;
                r.repeat.set(opts.repeat[0], opts.repeat[1]);
            }
            mat.roughnessMap = r;
            mat.needsUpdate = true;
        });
    }
}

// ----------------------------------------------------------------------
// Texturas iniciais — uma textura DISTINTA por slot, com cor a branco e
// emissivo a zero, para se ver claramente o limite de cada parte do corpo.
// ----------------------------------------------------------------------
const _T = 'assets/textures/';
const _B = _T + 'boss/';

// armadura principal (torso / coxas / braços) — Metal012 (placas hexagonais)
aplicarTexturaBoss('armor', _B + 'Metal012_armor/Metal012_1K-PNG_Color.png', {
    repeat: [2, 2], color: 0xffffff,
    normalUrl:    _B + 'Metal012_armor/Metal012_1K-PNG_NormalGL.png',
    roughnessUrl: _B + 'Metal012_armor/Metal012_1K-PNG_Roughness.png',
});

// placas escuras / juntas (base / canelas / ombreiras / antebraços) — Metal046 (Metal Dark)
aplicarTexturaBoss('armor_dark', _B + 'Metal_Dark/Metal046A_1K-PNG_Color.png', {
    repeat: [2, 2], color: 0xffffff,
    normalUrl:    _B + 'Metal_Dark/Metal046A_1K-PNG_NormalGL.png',
    roughnessUrl: _B + 'Metal_Dark/Metal046A_1K-PNG_Roughness.png',
});

// capa / colar — Fabric030 (Velvet)
aplicarTexturaBoss('cape', _B + 'cape/Fabric030_1K-PNG_Color.png', {
    repeat: [2, 3], color: 0xffffff,
    normalUrl:    _B + 'cape/Fabric030_1K-PNG_NormalGL.png',
    roughnessUrl: _B + 'cape/Fabric030_1K-PNG_Roughness.png',
});

// forro da capa — Fabric002
aplicarTexturaBoss('cape_lining', _B + 'cape_lining/Fabric002_1K-JPG_Color.jpg', {
    repeat: [2, 1], color: 0xffffff,
    normalUrl:    _B + 'cape_lining/Fabric002_1K-JPG_NormalGL.jpg',
    roughnessUrl: _B + 'cape_lining/Fabric002_1K-JPG_Roughness.jpg',
});

// pele (cabeça / pescoço) — Rock035 (Obsidiana/Rocha Escura)
aplicarTexturaBoss('skin', _B + 'skin/Rock035_1K-PNG_Color.png', {
    repeat: [1, 1], color: 0xffffff, emissive: 0x000000,
    normalUrl:    _B + 'skin/Rock035_1K-PNG_NormalGL.png',
    roughnessUrl: _B + 'skin/Rock035_1K-PNG_Roughness.png',
});

// couro (botas / cinto / luvas) — Leather033
aplicarTexturaBoss('leather', _B + 'Leather/Leather033A_1K-PNG_Color.png', {
    repeat: [2, 2], color: 0xffffff,
    normalUrl:    _B + 'Leather/Leather033A_1K-PNG_NormalGL.png',
    roughnessUrl: _B + 'Leather/Leather033A_1K-PNG_Roughness.png',
});

// metal (joelhos / cotovelos / fivela / espigões) — Metal008 (Gold)
aplicarTexturaBoss('metal', _B + 'Metal008_gold/Metal008_1K-PNG_Color.png', {
    repeat: [1, 1], color: 0xffffff, emissive: 0x000000,
    normalUrl:    _B + 'Metal008_gold/Metal008_1K-PNG_NormalGL.png',
    roughnessUrl: _B + 'Metal008_gold/Metal008_1K-PNG_Roughness.png',
});

// garras — Rock020
aplicarTexturaBoss('claws', _B + 'Rock020_Claws/Rock020_1K-PNG_Color.png', {
    repeat: [1, 1], color: 0xffffff, emissive: 0x000000,
    normalUrl:    _B + 'Rock020_Claws/Rock020_1K-PNG_NormalGL.png',
    roughnessUrl: _B + 'Rock020_Claws/Rock020_1K-PNG_Roughness.png',
});

// ----------------------------------------------------------------------
// BOSS — construção e animação
// ----------------------------------------------------------------------
const _anchors = {
    coroa:    null,
    aureola:  null,
    brincos:  null,
    oculos:   null,
    mascara:  null,
};

let _boss = null;
let _t = 0;
// escala base do boss — aumenta presença/altura (1 = tamanho original)
const _BOSS_BASE_SCALE = 1.12;
const _anim = {
    eyeLeft:  null,
    eyeRight: null,
    cape:     null,
    capePivot: null,
    head:     null,
    runes:    [],
    halo:     null,
    crown:    null,
    armL:     null,
    armR:     null,
    attack: {
        active: false,
        type: 'none', // 'aereo', 'rasante', 'lateral', 'varredura'
        side: 0,      // -1 (esq), 1 (dir)
        timer: 0,
        duration: 1.0,
    }
};

// ---- curvas de easing para dar "game feel" às animações de ataque ----
function _smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

// Curva de golpe: antecipação (recua a -1), golpe rápido com overshoot
// (+1.15) e recuperação suave até 0. Dá peso e snap aos braços.
//   p:0 ─▶ 0   p:0.30 ─▶ -1 (recuo)   p:0.46 ─▶ +1.15 (impacto)   p:1 ─▶ 0
function _strike(p) {
    if (p < 0.30) return -_smooth(p / 0.30);
    if (p < 0.46) return -1 + _smooth((p - 0.30) / 0.16) * 2.15;
    return 1.15 * (1 - _smooth((p - 0.46) / 0.54));
}

// Curva de salto: agacha (-) na antecipação, sobe forte no golpe, cai e
// assenta. Pico em ~0.5.
function _leap(p) {
    if (p < 0.26) return -0.35 * _smooth(p / 0.26);      // agacha
    if (p < 0.55) return -0.35 + _smooth((p - 0.26) / 0.29) * 1.35; // sobe a +1.0
    return 1.0 * (1 - _smooth((p - 0.55) / 0.45));       // desce
}

/**
 * Dispara uma animação de ataque no boss.
 * @param {string} type Tipo de ataque ('aereo', 'rasante', 'lateral', 'varredura')
 * @param {number} duration Duração total da animação
 * @param {object} opts Opções extras (ex: { side: -1 })
 */
export function triggerBossAttackAnim(type, duration = 1.0, opts = {}) {
    if (!_boss) return;
    _anim.attack.active = true;
    _anim.attack.type = type;
    _anim.attack.duration = duration;
    _anim.attack.timer = 0;
    _anim.attack.side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    _anim.attack.baseZ = _boss.position.z; // para a carga avançar relativa à base
}

export function criarBoss(scene, posicao = new THREE.Vector3(0, 0, 0), {
    acessorios = ['coroa_magica'],
} = {}) {
    if (_boss) {
        if (_boss.parent) _boss.parent.remove(_boss);
        scene.add(_boss);
        _boss.position.copy(posicao);
        return _boss;
    }

    _boss = new THREE.Group();
    _boss.name = 'Boss';
    _boss.position.copy(posicao);
    _anim.attack.active = false;

    // BASE
    const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.10, 24), matBossArmorDark);
    baseDisc.position.y = 0.05;
    baseDisc.receiveShadow = true;
    _boss.add(baseDisc);

    // PERNAS
    function perna(side) {
        const g = new THREE.Group();
        const coxa = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.74, 8), matBossArmor);
        coxa.position.y = -0.37;
        coxa.castShadow = true;
        g.add(coxa);
        const joelho = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), matBossMetal);
        joelho.position.y = -0.74;
        g.add(joelho);
        const canela = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.72, 8), matBossArmorDark);
        canela.position.y = -1.10;
        canela.castShadow = true;
        g.add(canela);
        const bota = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.20, 0.58), matBossLeather);
        bota.position.set(0, -1.42, 0.08);
        g.add(bota);
        g.position.set(side * 0.32, 1.5, 0);
        _boss.add(g);
    }
    perna(-1); perna(1);

    // TRONCO
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.52, 1.10, 12), matBossArmor);
    torso.position.y = 1.95;
    torso.castShadow = true;
    _boss.add(torso);

    for (const side of [-1, 1]) {
        const placa = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.52), matBossArmorDark);
        placa.position.set(side * 0.62, 1.95, 0);
        placa.castShadow = true;
        _boss.add(placa);
    }

    const cinto = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.08, 8, 24), matBossLeather);
    cinto.position.y = 1.48;
    cinto.rotation.x = Math.PI / 2;
    _boss.add(cinto);

    const fivela = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.08), matBossMetal);
    fivela.position.set(0, 1.48, 0.60);
    _boss.add(fivela);

    for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), matBossRune);
        r.position.set(-0.20 + i * 0.20, 2.15, 0.64);
        _boss.add(r);
        _anim.runes.push(r);
    }

    // OMBROS
    for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.40, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), matBossArmorDark);
        pauldron.position.set(side * 0.80, 2.42, 0);
        pauldron.castShadow = true;
        _boss.add(pauldron);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 6), matBossMetal);
        spike.position.set(side * 0.98, 2.56, 0);
        spike.rotation.z = -side * 0.4;
        _boss.add(spike);
    }

    // BRAÇOS
    function braco(side) {
        const g = new THREE.Group();
        g.position.set(side * 0.82, 2.32, 0);
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.66, 8), matBossArmor);
        upper.position.y = -0.35;
        upper.castShadow = true;
        g.add(upper);
        const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), matBossMetal);
        elbow.position.y = -0.72;
        g.add(elbow);
        const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.60, 8), matBossArmorDark);
        fore.position.y = -1.05;
        fore.castShadow = true;
        g.add(fore);
        const luva = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), matBossLeather);
        luva.position.y = -1.38;
        g.add(luva);
        for (let i = -1; i <= 1; i++) {
            const garra = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.20, 5), matBossClaws);
            garra.position.set(i * 0.08, -1.54, 0.08);
            garra.rotation.x = 0.3;
            g.add(garra);
        }
        g.rotation.z = -side * 0.12;
        _boss.add(g);
        return g;
    }
    _anim.armL = braco(-1);
    _anim.armR = braco(1);

    // CABEÇA
    const pescoco = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.22, 10), matBossSkin);
    pescoco.position.y = 2.62;
    _boss.add(pescoco);

    const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.40, 16, 14), matBossSkin);
    cabeca.position.y = 2.96;
    cabeca.castShadow = true;
    _boss.add(cabeca);
    _anim.head = cabeca;

    const olhoGeo = new THREE.SphereGeometry(0.075, 10, 8);
    const olhoL = new THREE.Mesh(olhoGeo, matBossEye);
    olhoL.position.set(-0.14, 3.00, 0.34);
    _boss.add(olhoL);
    _anim.eyeLeft = olhoL;
    const olhoR = new THREE.Mesh(olhoGeo, matBossEye);
    olhoR.position.set( 0.14, 3.00, 0.34);
    _boss.add(olhoR);
    _anim.eyeRight = olhoR;

    const eyeLight = new THREE.PointLight(0xff4020, 2.0, 4, 2);
    eyeLight.position.set(0, 3.00, 0.50);
    _boss.add(eyeLight);
    registerLight('Boss', 'Luz dos Olhos', eyeLight);

    // CAPA — pendurada a partir dos ombros/parte de cima das costas, num
    // pivô inclinado para trás para não entrar dentro da armadura.
    const capePivot = new THREE.Group();
    capePivot.position.set(0, 2.58, -0.72);
    capePivot.rotation.x = 0.24;
    _boss.add(capePivot);

    const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.7, 6, 10), matBossCape);
    cape.position.y = -1.30; // topo da capa fica junto ao pivô (ombros)
    cape.castShadow = true;
    capePivot.add(cape);
    _anim.cape = cape;
    _anim.capePivot = capePivot;

    const lining = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), matBossCapeLining);
    lining.position.set(0, -2.32, 0.03); // forro interior, junto à base da capa
    capePivot.add(lining);

    // ANCORAS
    const headY = 2.96;
    _anchors.coroa   = new THREE.Group(); _anchors.coroa.position.set(0, headY + 0.42, 0); _boss.add(_anchors.coroa);
    _anchors.aureola = new THREE.Group(); _anchors.aureola.position.set(0, headY + 0.66, -0.02); _boss.add(_anchors.aureola);
    _anchors.brincos = new THREE.Group(); _anchors.brincos.position.set(0, headY - 0.05, 0); _boss.add(_anchors.brincos);
    _anchors.oculos  = new THREE.Group(); _anchors.oculos.position.set(0, headY + 0.05, 0.38); _boss.add(_anchors.oculos);
    _anchors.mascara = new THREE.Group(); _anchors.mascara.position.set(0, headY + 0.04, 0); _boss.add(_anchors.mascara);

    scene.add(_boss);
    vestirAcessoriosBoss(acessorios);
    return _boss;
}

export function vestirAcessoriosBoss(ids = []) {
    if (!_boss) return;
    for (const k of Object.keys(_anchors)) {
        const a = _anchors[k];
        while (a.children.length) a.remove(a.children[0]);
    }
    _anim.halo = null; _anim.crown = null;
    for (const id of ids) {
        const ac = criarAcessorio(id);
        if (!ac) continue;
        switch (id) {
            case 'coroa_magica': ac.scale.setScalar(2.0); _anchors.coroa.add(ac); _anim.crown = ac; break;
            case 'aureola_caidos': ac.scale.setScalar(2.0); ac.position.y = 0; _anchors.aureola.add(ac); _anim.halo = ac; break;
            case 'brincos_vida': ac.scale.setScalar(1.5); ac.position.y = -0.02; for (const child of ac.children) child.position.x *= 2.8; _anchors.brincos.add(ac); break;
            case 'oculos_carga': ac.scale.setScalar(1.9); _anchors.oculos.add(ac); break;
            // máscara — banda fina ao nível dos olhos: deixa a testa e a
            // parte de baixo do rosto à mostra. raio ≈ raio da cabeça (0.40).
            case 'mascara_eclipse': ac.scale.setScalar(2.5); ac.position.y = 0; _anchors.mascara.add(ac); break;
        }
    }
}

export function getBossRoot() { return _boss; }
export function getBossTargetPoint() {
    if (!_boss) return null;
    return new THREE.Vector3(_boss.position.x, _boss.position.y + 2.0, _boss.position.z);
}

export function updateBoss(deltaTime) {
    if (!_boss) return;
    _t += deltaTime;

    // Reset base transformations
    _boss.position.y = 0;
    _boss.rotation.set(0, 0, 0);
    if (_anim.armL) _anim.armL.rotation.set(0, 0, -0.12);
    if (_anim.armR) _anim.armR.rotation.set(0, 0, 0.12);

    // FLUTUAÇÃO IDLE
    const idleFloat = Math.sin(_t * 1.4) * 0.05;
    _boss.position.y += idleFloat;
    const b = 1 + Math.sin(_t * 1.8) * 0.015;
    _boss.scale.set(_BOSS_BASE_SCALE, _BOSS_BASE_SCALE * b, _BOSS_BASE_SCALE);

    // Outras animações idle
    if (_anim.eyeLeft && _anim.eyeRight) {
        matBossEye.emissiveIntensity = 2.2 + Math.sin(_t * 6) * 0.6 + Math.sin(_t * 17) * 0.25;
    }
    if (_anim.halo) _anim.halo.rotation.y += deltaTime * 0.8;
    if (_anim.crown) _anim.crown.rotation.y = Math.sin(_t * 0.6) * 0.15;
    if (_anim.cape) {
        _anim.cape.rotation.x = Math.sin(_t * 1.1) * 0.04;
        _anim.cape.rotation.z = Math.sin(_t * 0.7) * 0.025;
    }
    matBossRune.emissiveIntensity = 1.8 + Math.sin(_t * 3.2) * 0.6;

    // reset da cabeça (animada só nos ataques)
    if (_anim.head) _anim.head.rotation.set(0, 0, 0);

    // ANIMAÇÕES DE ATAQUE — com antecipação, golpe rápido (overshoot) e
    // recuperação + movimento secundário (lean do corpo, cabeça, capa).
    if (_anim.attack.active) {
        _anim.attack.timer += deltaTime;
        const p = Math.min(1, _anim.attack.timer / _anim.attack.duration);
        const s = _strike(p);                 // -1 → +1.15 → 0 (snap)
        const sPos = Math.max(0, s);           // só a parte positiva do golpe
        const armL = _anim.armL, armR = _anim.armR;
        const head = _anim.head, cape = _anim.capePivot;

        switch (_anim.attack.type) {
            case 'aereo': {
                // Recua, agacha e dispara num salto com os dois braços a
                // descer num smash sobre a cabeça.
                const j = _leap(p);
                _boss.position.y += j * 1.7;
                _boss.rotation.x = -s * 0.12;                 // inclina ao saltar/cair
                // braços: recuam para cima (antecipação) e batem para baixo
                if (armL) { armL.rotation.x = -2.6 + sPos * 3.4; armL.rotation.z = -0.12; }
                if (armR) { armR.rotation.x = -2.6 + sPos * 3.4; armR.rotation.z = 0.12; }
                if (head) head.rotation.x = -s * 0.35;          // olha para cima e baixa
                if (cape) cape.rotation.x = 0.24 - j * 0.5;     // capa esvoaça no salto
                break;
            }

            case 'rasante': {
                // Carga: recua o tronco, mergulha em frente e dá um slam
                // baixo com ambas as garras.
                _boss.position.z = _anim.attack.baseZ + sPos * 0.7; // avança (+z = para o player)
                _boss.position.y -= sPos * 0.35;
                _boss.rotation.x = s * 0.45;                    // mergulho para a frente
                if (armL) { armL.rotation.x = -0.5 + sPos * 1.9; armL.rotation.z = -0.12 - sPos * 0.35; }
                if (armR) { armR.rotation.x = -0.5 + sPos * 1.9; armR.rotation.z = 0.12 + sPos * 0.35; }
                if (head) head.rotation.x = s * 0.4;
                if (cape) cape.rotation.x = 0.24 + s * 0.4;
                break;
            }

            case 'varredura': {
                // Wind-up rotacional para um lado e varrimento horizontal
                // largo com os dois braços abertos em cruz.
                _boss.rotation.y = -s * 0.55;                   // roda o torso no swing
                if (armL) { armL.rotation.x = -0.6; armL.rotation.z = -0.12 - sPos * 1.7; }
                if (armR) { armR.rotation.x = -0.6; armR.rotation.z = 0.12 + sPos * 1.7; }
                if (head) head.rotation.y = -s * 0.5;
                if (cape) cape.rotation.z = -s * 0.3;
                break;
            }

            case 'lateral': {
                const side = _anim.attack.side;
                // Recolhe o braço (antecipação) e desfere um jab lateral.
                _boss.rotation.y = -side * s * 0.5;
                const arm = side === -1 ? armL : armR;
                if (arm) {
                    arm.rotation.x = -0.4 - sPos * 0.9;
                    arm.rotation.y = side * (-0.3 + sPos * 2.0);
                    arm.rotation.z = side * -0.12;
                }
                // braço oposto contrabalança
                const other = side === -1 ? armR : armL;
                if (other) other.rotation.x = -sPos * 0.5;
                if (head) head.rotation.y = side * s * 0.4;
                if (cape) cape.rotation.z = side * s * 0.25;
                break;
            }
        }

        if (p >= 1) {
            _anim.attack.active = false;
            // repõe a capa e a posição base (a carga move o z)
            if (cape) cape.rotation.set(0.24, 0, 0);
            _boss.position.z = _anim.attack.baseZ;
        }
    }
}
