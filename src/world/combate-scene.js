import * as THREE from 'three';
import { criarBoss, updateBoss, getBossRoot } from './boss.js';

// ----------------------------------------------------------------------
// CENA DE COMBATE
// ----------------------------------------------------------------------
// Estilo: corrompido roxo (mesma paleta de matBattleGrass + matCorruptHalo)
// Layout: arena circular plana, player à esquerda, inimigo à direita,
//         câmara estática lateral, fog escuro a fechar a arena.
// ----------------------------------------------------------------------

export const combateScene = new THREE.Scene();
combateScene.background = new THREE.Color(0x05000a);
combateScene.fog = new THREE.FogExp2(0x100020, 0.045);

// Posições fixas — são mutadas em runtime conforme entramos/saímos de
// boss mode. Os módulos que importam estes Vector3 lêem sempre o valor
// actual (mantêm a referência).
const _posPlayerNormal  = new THREE.Vector3(-2.6, 0, 0);
const _posInimigoNormal = new THREE.Vector3( 2.8, 0.85, 0);
const _posPlayerBoss    = new THREE.Vector3(0, 0, 2.0);
const _posInimigoBoss   = new THREE.Vector3(0, 0, -3.5);
export const posPlayerCombate  = _posPlayerNormal.clone();
export const posInimigoCombate = _posInimigoNormal.clone();

// ---- Iluminação ambiental + chave + contraluz roxo ----
combateScene.add(new THREE.AmbientLight(0x553388, 0.55));

const keyLight = new THREE.DirectionalLight(0xb070ff, 1.4);
keyLight.position.set(-4, 8, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
keyLight.shadow.bias = -0.0005;
combateScene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xff60d0, 0.6);
rimLight.position.set(6, 4, -6);
combateScene.add(rimLight);

// luz pontual a pulsar entre os dois lutadores (dramatiza a arena)
const arenaPulse = new THREE.PointLight(0xaa55ff, 1.5, 14, 1.4);
arenaPulse.position.set(0, 2.2, 0);
combateScene.add(arenaPulse);

// ---- Chão da arena: shader roxo corrompido (estilo matBattleGrass) ----
export const matCombateChao = new THREE.ShaderMaterial({
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

        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float sn(vec2 p){
            vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.5;
            for(int i=0;i<4;i++){v+=a*sn(p);p=p*2.1+vec2(3.1,1.7);a*=0.5;}
            return v;
        }

        void main(){
            // Disco da arena com borda orgânica
            vec2 c = vUv - 0.5;
            float dist = length(c);
            float angle = atan(c.y, c.x);
            float warp = fbm(vec2(angle * 2.0, uTime * 0.12) + 1.7) * 0.10;
            float mask = smoothstep(0.50 + warp, 0.42 + warp, dist);
            if (mask < 0.01) discard;

            float n  = fbm(vUv * 14.0 + vec2(uTime * 0.05, 0.0));
            float n2 = fbm(vUv *  6.0 - vec2(0.0, uTime * 0.03) + 5.3);
            float sparkle = pow(sn(vUv * 40.0 + uTime * 0.6), 7.0);
            float pulse   = 0.5 + 0.5 * sin(uTime * 2.0);

            vec3 dark   = vec3(0.10, 0.02, 0.18);
            vec3 mid    = vec3(0.32, 0.08, 0.48);
            vec3 bright = vec3(0.62, 0.18, 0.92);
            vec3 spark  = vec3(0.90, 0.55, 1.00);

            vec3 col = mix(dark, mid, n * 0.6 + n2 * 0.4);
            col      = mix(col, bright, sparkle * pulse * 0.7);
            col      = mix(col, spark,  sparkle * 0.4);

            // anel de borda mais brilhante a delimitar a arena
            float borderGlow = smoothstep(0.40 + warp, 0.50 + warp, dist) * mask;
            col = mix(col, vec3(0.85, 0.35, 1.00), borderGlow * 0.9 * (0.7 + 0.3 * pulse));

            gl_FragColor = vec4(col, mask);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
});

const arenaR = 7;
const arenaGeo = new THREE.PlaneGeometry(arenaR * 2, arenaR * 2, 1, 1);
const arenaMesh = new THREE.Mesh(arenaGeo, matCombateChao);
arenaMesh.rotation.x = -Math.PI / 2;
arenaMesh.position.y = 0.02;
arenaMesh.receiveShadow = true;
combateScene.add(arenaMesh);

// chão preto por baixo (recebe as sombras nítidas dos lutadores)
const floorShadow = new THREE.Mesh(
    new THREE.CircleGeometry(arenaR * 1.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x080010, roughness: 1 })
);
floorShadow.rotation.x = -Math.PI / 2;
floorShadow.position.y = 0;
floorShadow.receiveShadow = true;
combateScene.add(floorShadow);

// tufos roxos espalhados (decorativo, igual ao mapa)
const matTufo = new THREE.MeshStandardMaterial({
    color: 0x4a1170,
    emissive: 0x6a20a0,
    emissiveIntensity: 0.6,
    roughness: 0.9,
});
const seededRand = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
const r = seededRand(91);
for (let i = 0; i < 60; i++) {
    const ang = r() * Math.PI * 2;
    const rad = 1.5 + r() * (arenaR - 1.6);
    const h = 0.18 + r() * 0.32;
    const tufo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, h, 4), matTufo);
    tufo.position.set(Math.cos(ang) * rad, h / 2, Math.sin(ang) * rad);
    tufo.rotation.y = r() * Math.PI * 2;
    tufo.castShadow = true;
    combateScene.add(tufo);
}

// pilares quebrados (atmosfera de ruína corrompida)
const matPilar = new THREE.MeshStandardMaterial({
    color: 0x1a0825,
    emissive: 0x3a0a55,
    emissiveIntensity: 0.25,
    roughness: 1,
});
function pilar(x, z, h) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, h, 8), matPilar);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    combateScene.add(m);
}
pilar(-5.5, -3.5, 2.2);
pilar( 5.8, -3.2, 1.8);
pilar(-5.2,  3.8, 1.4);
pilar( 5.3,  4.0, 2.6);

// partículas roxas no ar
const partGeo = new THREE.BufferGeometry();
const partCount = 120;
const partPos = new Float32Array(partCount * 3);
for (let i = 0; i < partCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const rd = 1 + Math.random() * (arenaR - 0.5);
    partPos[i * 3 + 0] = Math.cos(a) * rd;
    partPos[i * 3 + 1] = Math.random() * 4;
    partPos[i * 3 + 2] = Math.sin(a) * rd;
}
partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
const partMat = new THREE.PointsMaterial({
    color: 0xc090ff,
    size: 0.06,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});
const particulas = new THREE.Points(partGeo, partMat);
combateScene.add(particulas);

// ---- Wraith inimigo (referência: figura encapuzada com chamas roxas) ----
export const combateInimigo = new THREE.Group();
combateInimigo.position.copy(posInimigoCombate);

const wraithDark = new THREE.MeshStandardMaterial({
    color: 0x080310, roughness: 0.95, metalness: 0.05,
});
const wraithCloth = new THREE.MeshStandardMaterial({
    color: 0x1a0930, emissive: 0x3d0e75, emissiveIntensity: 0.55,
    roughness: 1, metalness: 0,
});
const wingMat = new THREE.MeshStandardMaterial({
    color: 0x4a1880, emissive: 0x9040e0, emissiveIntensity: 1.0,
    transparent: true, opacity: 0.8, side: THREE.DoubleSide, roughness: 0.5,
});
const flameMat = new THREE.MeshBasicMaterial({
    color: 0xa050ff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
});
const mistMat = new THREE.MeshBasicMaterial({
    color: 0x6520b0, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const glowMat = new THREE.MeshBasicMaterial({ color: 0xc080ff });

// Robe (corpo cónico, alargado em baixo)
const robe = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 2.2, 14, 1, true),
    wraithCloth
);
robe.position.y = 1.0;
robe.castShadow = true;
combateInimigo.add(robe);

// Cintura
const belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.06, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x6a6a78, roughness: 0.6 })
);
belt.position.y = 1.45;
belt.rotation.x = Math.PI / 2;
combateInimigo.add(belt);

// Tronco (parte de cima do robe, mais estreita)
const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.58, 0.95, 12, 1, true),
    wraithCloth
);
torso.position.y = 1.92;
torso.castShadow = true;
combateInimigo.add(torso);

// Ombros / capa
const shoulders = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 0.5, 12, 1, true),
    wraithDark
);
shoulders.position.y = 2.15;
shoulders.castShadow = true;
combateInimigo.add(shoulders);

// Capuz
const hood = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.9, 12),
    wraithDark
);
hood.position.y = 2.78;
hood.rotation.x = 0.15;
hood.castShadow = true;
combateInimigo.add(hood);

// Rosto brilhante dentro do capuz
const face = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), glowMat);
face.position.set(0, 2.55, 0.18);
combateInimigo.add(face);
const faceLight = new THREE.PointLight(0xa060ff, 1.0, 2.2, 2);
faceLight.position.set(0, 2.55, 0.25);
combateInimigo.add(faceLight);

// Braços (mangas caídas) + garras luminosas
function braco(side) {
    const manga = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 1.05, 8, 1, true),
        wraithCloth
    );
    manga.position.set(0.55 * side, 1.55, 0.1);
    manga.rotation.z = side * 0.45;
    manga.castShadow = true;
    combateInimigo.add(manga);

    const garra = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), glowMat);
    garra.position.set(0.82 * side, 1.05, 0.12);
    combateInimigo.add(garra);
}
braco(-1); braco(1);

// Asas (forma curva, semitransparente, roxa)
function asa(side) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.7 * side, 0.3, 1.4 * side, 0.0, 1.6 * side, -0.6);
    shape.bezierCurveTo(1.2 * side, -0.5, 0.8 * side, -0.9, 0.4 * side, -1.2);
    shape.bezierCurveTo(0.25 * side, -0.8, 0.1 * side, -0.4, 0, 0);
    const g = new THREE.ShapeGeometry(shape);
    const m = new THREE.Mesh(g, wingMat);
    m.position.set(0.35 * side, 2.0, -0.25);
    m.rotation.y = side * -0.35;
    return m;
}
const asaL = asa(-1);
const asaR = asa(1);
combateInimigo.add(asaL, asaR);

// Chamas roxas em volta da cabeça
const flames = [];
for (let i = 0; i < 12; i++) {
    const g = new THREE.ConeGeometry(0.08 + Math.random() * 0.05, 0.45 + Math.random() * 0.45, 6);
    const m = new THREE.Mesh(g, flameMat);
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
    const rad = 0.32 + Math.random() * 0.18;
    m.position.set(Math.cos(a) * rad, 2.95 + Math.random() * 0.25, Math.sin(a) * rad);
    m.userData = {
        baseY: m.position.y,
        phase: Math.random() * Math.PI * 2,
        baseScale: 0.8 + Math.random() * 0.5,
    };
    m.scale.setScalar(m.userData.baseScale);
    flames.push(m);
    combateInimigo.add(m);
}

// Nevoa/aura rotativa em redor do wraith
const mistGroup = new THREE.Group();
mistGroup.position.y = 1.2;
for (let i = 0; i < 16; i++) {
    const g = new THREE.PlaneGeometry(1.7, 1.7);
    const m = new THREE.Mesh(g, mistMat);
    const a = (i / 16) * Math.PI * 2;
    const rad = 0.95 + Math.random() * 0.35;
    m.position.set(Math.cos(a) * rad, (Math.random() - 0.3) * 1.6, Math.sin(a) * rad);
    m.rotation.y = -a + Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI * 2;
    mistGroup.add(m);
}
combateInimigo.add(mistGroup);

// segundo anel de nevoa, mais lento e em sentido contrário
const mistGroup2 = new THREE.Group();
mistGroup2.position.y = 0.4;
for (let i = 0; i < 12; i++) {
    const g = new THREE.PlaneGeometry(2.1, 1.4);
    const m = new THREE.Mesh(g, mistMat);
    const a = (i / 12) * Math.PI * 2;
    const rad = 1.3 + Math.random() * 0.3;
    m.position.set(Math.cos(a) * rad, (Math.random() - 0.5) * 0.8, Math.sin(a) * rad);
    m.rotation.y = -a + Math.PI / 2;
    mistGroup2.add(m);
}
combateInimigo.add(mistGroup2);

// luz roxa pessoal
const auraLight = new THREE.PointLight(0x9040ff, 1.6, 5.5, 2);
auraLight.position.set(0, 1.4, 0);
combateInimigo.add(auraLight);

combateScene.add(combateInimigo);

// ----------------------------------------------------------------------
// BOSS — adicionado à mesma cena, escondido por defeito.
// É activado por `setBossMode(true)`; nessa altura o wraith é
// escondido e o boss aparece na mesma marca (posInimigoCombate).
// ----------------------------------------------------------------------
// boss tem origem nos pés (base a y≈0), por isso ignoramos o offset Y
// usado pelo wraith.
const bossPos = posInimigoCombate.clone();
bossPos.y = 0;
criarBoss(combateScene, bossPos, {
    acessorios: ['coroa_magica', 'mascara_eclipse', 'oculos_carga'],
});
const _bossRoot = getBossRoot();
if (_bossRoot) {
    _bossRoot.visible = false;
    // virado para o jogador (player em -X)
    _bossRoot.rotation.y = -Math.PI / 2 + 0.25;
}

let _bossMode = false;
export function isBossMode() { return _bossMode; }
export function setBossMode(on) {
    _bossMode = !!on;
    if (_bossRoot) _bossRoot.visible = _bossMode;
    combateInimigo.visible = !_bossMode;
    // muta as posições que outros módulos importaram por referência
    if (_bossMode) {
        posPlayerCombate.copy(_posPlayerBoss);
        posInimigoCombate.copy(_posInimigoBoss);
    } else {
        posPlayerCombate.copy(_posPlayerNormal);
        posInimigoCombate.copy(_posInimigoNormal);
    }
    // garante que o boss assenta na nova marca imediatamente (não
    // espera pelo próximo updateCombateScene).
    if (_bossRoot) {
        _bossRoot.position.set(posInimigoCombate.x, 0, posInimigoCombate.z);
        _bossRoot.rotation.y = 0; // virado para +Z (jogador/câmara)
    }
}

// Proxy de material para preservar a API usada por systems/combate.js
const _fadeMats = [wraithDark, wraithCloth, wingMat, flameMat, mistMat, glowMat,
                   belt.material, face.material];
const _emissiveMats = [wraithCloth, wingMat];
const _baseOpacity = new Map(_fadeMats.map(m => [m, m.opacity ?? 1]));
const _baseEmissive = _emissiveMats.map(m => m.emissiveIntensity);
const inimigoMat = {
    get emissiveIntensity() { return _emissiveMats[0].emissiveIntensity; },
    set emissiveIntensity(v) {
        _emissiveMats[0].emissiveIntensity = v;
        _emissiveMats[1].emissiveIntensity = v * 1.4;
    },
    get transparent() { return wraithCloth.transparent; },
    set transparent(v) { _fadeMats.forEach(m => { m.transparent = v; }); },
    get opacity() { return wraithCloth.opacity; },
    set opacity(v) {
        _fadeMats.forEach(m => { m.opacity = (_baseOpacity.get(m) ?? 1) * v; });
    },
    color: { setHex: () => {} },
    emissive: { setHex: () => {} },
};
combateInimigo.material = inimigoMat;
combateInimigo.userData.flames = flames;
combateInimigo.userData.mistGroup = mistGroup;
combateInimigo.userData.mistGroup2 = mistGroup2;
combateInimigo.userData.asaL = asaL;
combateInimigo.userData.asaR = asaR;
combateInimigo.userData._baseOpacity = _baseOpacity;
combateInimigo.userData._baseEmissive = _baseEmissive;
combateInimigo.userData._emissiveMats = _emissiveMats;
combateInimigo.userData._fadeMats = _fadeMats;

// ---- Atualização por frame (uniforms + animações) ----
let _t = 0;
export function updateCombateScene(deltaTime) {
    _t += deltaTime;
    matCombateChao.uniforms.uTime.value = _t;

    // pulsar a luz da arena
    arenaPulse.intensity = 1.2 + Math.sin(_t * 2.4) * 0.5;

    // boss tem animação própria (flutuação, capa, olhos, etc.)
    if (_bossMode) {
        updateBoss(deltaTime);
        if (_bossRoot) {
            // fica na marca do inimigo + virado para +Z (player e câmara)
            _bossRoot.position.x = posInimigoCombate.x;
            _bossRoot.position.z = posInimigoCombate.z;
            _bossRoot.rotation.y = Math.sin(_t * 0.5) * 0.08;
        }
    }

    // wraith a flutuar e a oscilar lentamente
    combateInimigo.position.y = posInimigoCombate.y + Math.sin(_t * 1.4) * 0.12;
    // Virado para o player (que está em -X), mas com um leve giro
    // para a câmara (que está em +Z) — assim a cara fica visível.
    combateInimigo.rotation.y = -Math.PI / 2 + 0.35 + Math.sin(_t * 0.5) * 0.15;
    combateInimigo.rotation.z = Math.sin(_t * 0.8) * 0.04;

    // nevoa rotativa (dois anéis em sentidos opostos)
    const mist1 = combateInimigo.userData.mistGroup;
    const mist2 = combateInimigo.userData.mistGroup2;
    if (mist1) mist1.rotation.y += deltaTime * 0.45;
    if (mist2) mist2.rotation.y -= deltaTime * 0.28;

    // asas a bater
    const asaL = combateInimigo.userData.asaL;
    const asaR = combateInimigo.userData.asaR;
    if (asaL && asaR) {
        const flap = Math.sin(_t * 2.2) * 0.18;
        asaL.rotation.y = -0.35 + flap;
        asaR.rotation.y =  0.35 - flap;
    }

    // chamas a oscilar
    const flames = combateInimigo.userData.flames;
    if (flames) {
        for (const f of flames) {
            const u = f.userData;
            f.position.y = u.baseY + Math.sin(_t * 5 + u.phase) * 0.08;
            const s = u.baseScale * (0.85 + Math.sin(_t * 6 + u.phase) * 0.2);
            f.scale.set(s, s * (1.0 + Math.sin(_t * 4 + u.phase) * 0.15), s);
        }
    }

    // partículas a subir lentamente
    const pos = particulas.geometry.attributes.position;
    for (let i = 0; i < partCount; i++) {
        pos.array[i * 3 + 1] += deltaTime * 0.25;
        if (pos.array[i * 3 + 1] > 4) pos.array[i * 3 + 1] = 0;
    }
    pos.needsUpdate = true;
}

// ---- Reset visual entre combates (volta a posição/rotação inicial) ----
export function resetCombateScene() {
    // o wraith ocupa o spot normal mesmo durante o boss (ficaria atrás),
    // mas é escondido por _bossMode.
    combateInimigo.position.copy(_posInimigoNormal);
    combateInimigo.rotation.set(0, -Math.PI / 2 + 0.35, 0);
    combateInimigo.visible = !_bossMode;
    combateInimigo.scale.set(1, 1, 1);
    const ud = combateInimigo.userData;
    ud._fadeMats.forEach(m => {
        m.opacity = ud._baseOpacity.get(m) ?? 1;
        m.transparent = (ud._baseOpacity.get(m) ?? 1) < 1;
    });
    ud._emissiveMats.forEach((m, i) => { m.emissiveIntensity = ud._baseEmissive[i]; });
    // garantir que o boss está visível e na marca correcta se boss mode
    if (_bossMode && _bossRoot) {
        _bossRoot.visible = true;
        _bossRoot.scale.set(1, 1, 1);
        _bossRoot.position.set(posInimigoCombate.x, 0, posInimigoCombate.z);
        _bossRoot.rotation.y = 0;
    }
}
