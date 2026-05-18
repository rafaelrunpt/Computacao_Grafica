// ======================================================================
// BOSS FINAL — modelo procedural em three.js.
// ----------------------------------------------------------------------
// • Constrói uma figura humanóide imponente (~3 unidades de altura).
// • Usa o módulo `acessorios.js` para vestir os 5 acessórios que
//   aparecem nos pedestais do castelo (coroa, brincos, auréola,
//   óculos, máscara). Por defeito veste a coroa, a máscara e os
//   óculos — os "3 acessórios" mais visíveis. Podes mudar com
//   `vestirAcessoriosBoss([ids...])`.
// • Cada material está marcado como "TEXTURE SLOT" — substitui o `.map`
//   ou usa `aplicarTexturaBoss(slot, url)` para trocar a textura.
// ======================================================================
import * as THREE from 'three';
import { criarAcessorio } from './acessorios.js';

const _texLoader = new THREE.TextureLoader();

// ----------------------------------------------------------------------
// TEXTURE SLOTS — materiais com placeholders.
// Para aplicar uma textura, faz uma destas três coisas:
//   1) `matBossArmor.map = loader.load('texturas/armor.png'); matBossArmor.needsUpdate = true;`
//   2) `aplicarTexturaBoss('armor', 'texturas/armor.png')` (helper abaixo).
//   3) Sobrepor as cores/emissões directamente para variantes "fáceis":
//      `matBossArmor.color.setHex(0x8a1a1a);`
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
    color: 0x7a6e60,
    roughness: 0.85,
    metalness: 0.05,
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
 * Aplica uma textura a um slot do boss.
 *   slot   — nome do slot (ver _SLOTS acima)
 *   url    — caminho do ficheiro de textura (png/jpg)
 *   opts   — { repeat:[u,v], color, emissive, normalUrl, roughnessUrl }
 */
export function aplicarTexturaBoss(slot, url, opts = {}) {
    const mat = _SLOTS[slot];
    if (!mat) { console.warn('[Boss] slot desconhecido:', slot); return; }
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
        _texLoader.load(opts.normalUrl, (n) => { mat.normalMap = n; mat.needsUpdate = true; });
    }
    if (opts.roughnessUrl && 'roughnessMap' in mat) {
        _texLoader.load(opts.roughnessUrl, (r) => { mat.roughnessMap = r; mat.needsUpdate = true; });
    }
}

// ----------------------------------------------------------------------
// BOSS — construção do modelo
// ----------------------------------------------------------------------
// "ancoras" — Groups posicionados para onde cada acessório deve assentar
const _anchors = {
    coroa:    null,  // topo da cabeça
    aureola:  null,  // acima da coroa
    brincos:  null,  // laterais (à altura das orelhas)
    oculos:   null,  // frente da cabeça à altura dos olhos
    mascara:  null,  // frente da cabeça à altura da boca
};

let _boss = null;
let _t = 0;
const _anim = {
    eyeLeft:  null,
    eyeRight: null,
    cape:     null,
    aura:     null,
    runes:    [],
    halo:     null,   // referência ao acessório de auréola para rodar
    crown:    null,   // referência à coroa equipada (para subtle rotation)
};

/**
 * Constrói o boss e adiciona-o à cena. Devolve o THREE.Group raiz.
 * Por defeito veste 3 acessórios — passa `acessorios:[]` para não vestir
 * nenhum, ou outra lista para escolher.
 */
export function criarBoss(scene, posicao = new THREE.Vector3(0, 0, 0), {
    acessorios = ['coroa_magica', 'mascara_eclipse', 'oculos_carga'],
} = {}) {
    if (_boss) {
        // se já existir, mova-se / re-anexe
        if (_boss.parent) _boss.parent.remove(_boss);
        scene.add(_boss);
        _boss.position.copy(posicao);
        return _boss;
    }

    _boss = new THREE.Group();
    _boss.name = 'Boss';
    _boss.position.copy(posicao);

    // ===== BASE / AURA ===================================================
    // disco no chão
    const baseDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.1, 0.08, 24),
        matBossArmorDark
    );
    baseDisc.position.y = 0.04;
    baseDisc.receiveShadow = true;
    _boss.add(baseDisc);

    // "saia" de energia (cone aberto invertido)
    const aura = new THREE.Mesh(
        new THREE.ConeGeometry(1.05, 0.75, 24, 1, true),
        matBossAura
    );
    aura.position.y = 0.42;
    _boss.add(aura);
    _anim.aura = aura;

    // ===== PERNAS ========================================================
    function perna(side) {
        const g = new THREE.Group();
        const coxa = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.7, 8), matBossArmor);
        coxa.position.y = -0.35;
        coxa.castShadow = true;
        g.add(coxa);
        const joelho = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), matBossMetal);
        joelho.position.y = -0.7;
        g.add(joelho);
        const canela = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.7, 8), matBossArmorDark);
        canela.position.y = -1.05;
        canela.castShadow = true;
        g.add(canela);
        const bota = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.46), matBossLeather);
        bota.position.set(0, -1.42, 0.06);
        g.add(bota);
        g.position.set(side * 0.22, 1.5, 0);
        _boss.add(g);
        return g;
    }
    perna(-1);
    perna(1);

    // ===== TRONCO ========================================================
    // peitoral
    const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.38, 0.95, 12),
        matBossArmor
    );
    torso.position.y = 1.92;
    torso.castShadow = true;
    _boss.add(torso);

    // placas laterais
    for (const side of [-1, 1]) {
        const placa = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.85, 0.42),
            matBossArmorDark
        );
        placa.position.set(side * 0.4, 1.92, 0);
        placa.castShadow = true;
        _boss.add(placa);
    }

    // cintura (cinto)
    const cinto = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.06, 8, 24),
        matBossLeather
    );
    cinto.position.y = 1.45;
    cinto.rotation.x = Math.PI / 2;
    _boss.add(cinto);
    // fivela
    const fivela = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), matBossMetal);
    fivela.position.set(0, 1.45, 0.42);
    _boss.add(fivela);

    // runas no peito (3 pequenas pedras)
    for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.045, 0),
            matBossRune
        );
        r.position.set(-0.15 + i * 0.15, 2.05, 0.46);
        _boss.add(r);
        _anim.runes.push(r);
    }

    // ===== OMBROS / PAULDRONS ============================================
    for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
            matBossArmorDark
        );
        pauldron.position.set(side * 0.55, 2.32, 0);
        pauldron.castShadow = true;
        _boss.add(pauldron);
        // espinho no ombro
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 6), matBossMetal);
        spike.position.set(side * 0.65, 2.45, 0);
        spike.rotation.z = -side * 0.4;
        _boss.add(spike);
    }

    // ===== BRAÇOS ========================================================
    function braco(side) {
        const g = new THREE.Group();
        g.position.set(side * 0.55, 2.18, 0);

        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.6, 8), matBossArmor);
        upper.position.y = -0.32;
        upper.castShadow = true;
        g.add(upper);

        const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), matBossMetal);
        elbow.position.y = -0.66;
        g.add(elbow);

        const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.55, 8), matBossArmorDark);
        fore.position.y = -0.96;
        fore.castShadow = true;
        g.add(fore);

        // luva
        const luva = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), matBossLeather);
        luva.position.y = -1.26;
        g.add(luva);

        // garras (3 dedos pontiagudos)
        for (let i = -1; i <= 1; i++) {
            const garra = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 5), matBossClaws);
            garra.position.set(i * 0.06, -1.42, 0.06);
            garra.rotation.x = 0.3;
            g.add(garra);
        }

        // leve inclinação para fora dos braços
        g.rotation.z = -side * 0.12;
        _boss.add(g);
        return g;
    }
    braco(-1);
    braco(1);

    // ===== PESCOÇO + CABEÇA ==============================================
    const pescoco = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 0.18, 10),
        matBossSkin
    );
    pescoco.position.y = 2.5;
    _boss.add(pescoco);

    const cabeca = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 14),
        matBossSkin
    );
    cabeca.position.y = 2.78;
    cabeca.castShadow = true;
    _boss.add(cabeca);

    // olhos (esferas emissivas dentro da cabeça)
    const olhoGeo = new THREE.SphereGeometry(0.06, 10, 8);
    const olhoL = new THREE.Mesh(olhoGeo, matBossEye);
    olhoL.position.set(-0.11, 2.82, 0.27);
    _boss.add(olhoL);
    _anim.eyeLeft = olhoL;
    const olhoR = new THREE.Mesh(olhoGeo, matBossEye);
    olhoR.position.set( 0.11, 2.82, 0.27);
    _boss.add(olhoR);
    _anim.eyeRight = olhoR;

    // luz a sair dos olhos
    const eyeLight = new THREE.PointLight(0xff4020, 2.0, 4, 2);
    eyeLight.position.set(0, 2.82, 0.4);
    _boss.add(eyeLight);

    // ===== CAPA ==========================================================
    const cape = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 2.2, 6, 10),
        matBossCape
    );
    cape.position.set(0, 1.7, -0.4);
    cape.castShadow = true;
    _boss.add(cape);
    _anim.cape = cape;

    // forro interior visível na orla
    const lining = new THREE.Mesh(
        new THREE.PlaneGeometry(1.25, 0.4),
        matBossCapeLining
    );
    lining.position.set(0, 0.65, -0.39);
    _boss.add(lining);

    // colarinho alto que sobe atrás da cabeça
    const colar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.45, 0.55, 12, 1, true, -Math.PI * 0.4, Math.PI * 0.8),
        matBossCape
    );
    colar.position.set(0, 2.78, -0.05);
    _boss.add(colar);

    // ===== ANCORAS PARA ACESSÓRIOS =======================================
    const headY = 2.78;
    _anchors.coroa   = new THREE.Group(); _anchors.coroa.position.set(0, headY + 0.34, 0); _boss.add(_anchors.coroa);
    _anchors.aureola = new THREE.Group(); _anchors.aureola.position.set(0, headY + 0.55, -0.02); _boss.add(_anchors.aureola);
    _anchors.brincos = new THREE.Group(); _anchors.brincos.position.set(0, headY - 0.04, 0); _boss.add(_anchors.brincos);
    _anchors.oculos  = new THREE.Group(); _anchors.oculos.position.set(0, headY + 0.04, 0.30); _boss.add(_anchors.oculos);
    _anchors.mascara = new THREE.Group(); _anchors.mascara.position.set(0, headY - 0.06, 0.25); _boss.add(_anchors.mascara);

    scene.add(_boss);

    // veste-se com os acessórios pedidos
    vestirAcessoriosBoss(acessorios);

    return _boss;
}

/**
 * Tira tudo o que está nos anchors e equipa os acessórios pedidos.
 * IDs aceites: 'coroa_magica', 'brincos_vida', 'aureola_caidos',
 *              'oculos_carga', 'mascara_eclipse'.
 */
export function vestirAcessoriosBoss(ids = []) {
    if (!_boss) { console.warn('[Boss] criarBoss(...) primeiro.'); return; }
    // limpa anchors
    for (const k of Object.keys(_anchors)) {
        const a = _anchors[k];
        while (a.children.length) a.remove(a.children[0]);
    }
    _anim.halo = null;
    _anim.crown = null;

    for (const id of ids) {
        const ac = criarAcessorio(id);
        if (!ac) continue;
        switch (id) {
            case 'coroa_magica': {
                ac.scale.setScalar(1.6);
                _anchors.coroa.add(ac);
                _anim.crown = ac;
                break;
            }
            case 'aureola_caidos': {
                ac.scale.setScalar(1.6);
                ac.position.y = 0;
                _anchors.aureola.add(ac);
                _anim.halo = ac;
                break;
            }
            case 'brincos_vida': {
                // os brincos vêm em pares a ±0.14 (escala troféu).
                // Para o boss empurro-os para fora da cabeça (raio ~0.32).
                ac.scale.setScalar(1.2);
                ac.position.y = -0.02;
                for (const child of ac.children) child.position.x *= 2.4;
                _anchors.brincos.add(ac);
                break;
            }
            case 'oculos_carga': {
                ac.scale.setScalar(1.5);
                _anchors.oculos.add(ac);
                break;
            }
            case 'mascara_eclipse': {
                ac.scale.setScalar(1.5);
                // levantar um pouco para tapar a metade inferior do rosto
                ac.position.y = 0.02;
                _anchors.mascara.add(ac);
                break;
            }
        }
    }
}

/** Devolve o group raiz do boss (null se ainda não foi criado). */
export function getBossRoot() { return _boss; }

/** Devolve a posição para a câmara apontar (centro do tronco). */
export function getBossTargetPoint() {
    if (!_boss) return null;
    return new THREE.Vector3(
        _boss.position.x,
        _boss.position.y + 2.0,
        _boss.position.z
    );
}

/**
 * Animação idle do boss — chamar a cada frame.
 *   • Flutuação leve do corpo
 *   • Pulse dos olhos
 *   • Rotação da auréola
 *   • Sway da capa
 *   • Pulse das runas
 *   • Rotação lenta da aura
 */
export function updateBoss(deltaTime) {
    if (!_boss) return;
    _t += deltaTime;

    // flutuação
    _boss.position.y = 0 + Math.sin(_t * 1.4) * 0.05;
    // breath
    const b = 1 + Math.sin(_t * 1.8) * 0.015;
    _boss.scale.set(1, b, 1);

    // olhos — flicker
    if (_anim.eyeLeft && _anim.eyeRight) {
        const eP = 2.2 + Math.sin(_t * 6) * 0.6 + Math.sin(_t * 17) * 0.25;
        matBossEye.emissiveIntensity = eP;
    }

    // auréola roda devagar
    if (_anim.halo) _anim.halo.rotation.y += deltaTime * 0.8;
    // coroa oscila ligeiramente
    if (_anim.crown) _anim.crown.rotation.y = Math.sin(_t * 0.6) * 0.15;

    // capa sway
    if (_anim.cape) {
        _anim.cape.rotation.x = Math.sin(_t * 1.1) * 0.04;
        _anim.cape.rotation.z = Math.sin(_t * 0.7) * 0.025;
    }

    // aura roda
    if (_anim.aura) _anim.aura.rotation.y += deltaTime * 0.3;

    // pulse das runas no peito
    const ri = 1.8 + Math.sin(_t * 3.2) * 0.6;
    matBossRune.emissiveIntensity = ri;
}
