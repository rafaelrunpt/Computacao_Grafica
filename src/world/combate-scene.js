import * as THREE from 'three';
import { criarBoss, updateBoss, getBossRoot } from '../entities/boss.js';
import { criarInimigoWraith, updateInimigoWraith, resetInimigoWraith } from '../entities/inimigo-wraith.js';
import { criarInimigoNucleo, updateInimigoNucleo, resetInimigoNucleo } from '../entities/inimigo-nucleo.js';
import { skyboxCombate, starMat } from './sky.js';
import { settings } from '../systems/settings.js';

// ----------------------------------------------------------------------
// CENA DE COMBATE
// ----------------------------------------------------------------------
// Estilo: corrompido roxo (mesma paleta de matBattleGrass + matCorruptHalo)
// Layout: arena circular plana, player à esquerda, inimigo à direita,
//         câmara estática lateral, fog escuro a fechar a arena.
// ----------------------------------------------------------------------

export const combateScene = new THREE.Scene();
combateScene.background = new THREE.Color(0x05000a);
// Nevoeiro ajustado para deixar ver o céu estrelado ao fundo
combateScene.fog = new THREE.FogExp2(0x05000a, 0.02);

// Skybox do céu nocturno — instância própria da cena de combate. Só fica
// visível em batalhas normais com o modo noite activo (ver updateCombateScene).
combateScene.add(skyboxCombate);
skyboxCombate.visible = false;
// A geometria do céu tem raio 450 (dimensionada para o mundo aberto), mas a
// câmara de combate só alcança far=60 — a esse tamanho a esfera fica toda
// fora do frustum e não se vê uma única estrela. Encolhemo-la para ~raio 40,
// que continua bem atrás da arena. O shader desenha as estrelas a partir das
// normais, por isso a escala não altera o aspecto do céu.
skyboxCombate.scale.setScalar(0.09);

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

// ---- Chão da arena: obsidiana (Rock035) + shader de corrupção roxa ----
// textura reaproveitada (sem assets novos): a obsidiana dá o detalhe de
// superfície e a corrupção roxa irrompe/brilha pelas fendas.
const _arenaTexLoader = new THREE.TextureLoader();
const arenaRochaTex = _arenaTexLoader.load('assets/textures/boss/skin/Rock035_1K-PNG_Color.webp');
const arenaRochaNrm = _arenaTexLoader.load('assets/textures/boss/skin/Rock035_1K-PNG_NormalGL.webp');
for (const t of [arenaRochaTex, arenaRochaNrm]) t.wrapS = t.wrapT = THREE.RepeatWrapping;

export const matCombateChao = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTex: { value: arenaRochaTex }, uNormal: { value: arenaRochaNrm } },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform sampler2D uTex;
        uniform sampler2D uNormal;
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

            // --- superfície: obsidiana (Rock035) com RELEVO ---
            // luminância (com contraste reforçado) dá o padrão da pedra...
            vec2 ruv = vUv * 3.5;
            float rocha = dot(texture2D(uTex, ruv).rgb, vec3(0.333));
            rocha = clamp((rocha - 0.5) * 1.9 + 0.5, 0.0, 1.0);
            float fendas = 1.0 - smoothstep(0.12, 0.62, rocha);
            // ...e o normal map com luz rasante faz fendas/facetas saltar
            // à vista — é isto que torna a pedra realmente visível.
            vec3 nrm = normalize(texture2D(uNormal, ruv).rgb * 2.0 - 1.0);
            float relevo = clamp(0.5 + 0.95 * dot(nrm, normalize(vec3(0.55, 0.45, 0.7))), 0.22, 1.55);
            vec3 col = mix(vec3(0.06, 0.02, 0.12), vec3(0.44, 0.25, 0.62), rocha) * relevo;

            float n  = fbm(vUv * 14.0 + vec2(uTime * 0.05, 0.0));
            float n2 = fbm(vUv *  6.0 - vec2(0.0, uTime * 0.03) + 5.3);
            float energia = pow(n * 0.6 + n2 * 0.4, 1.7);
            float sparkle = pow(sn(vUv * 40.0 + uTime * 0.6), 7.0);
            float pulse   = 0.5 + 0.5 * sin(uTime * 2.0);

            // corrupção ADITIVA — brilha por cima sem apagar a pedra
            col += vec3(0.32, 0.09, 0.55) * energia * (0.55 + 0.45 * pulse) * (0.4 + 0.6 * fendas);
            col += vec3(0.60, 0.35, 0.70) * sparkle * (0.5 + 0.5 * pulse);

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

// A "arena" (chão, decoração, pilares, partículas) vive num grupo próprio
// para poder ser rodada sem mexer nas entidades (player / inimigo / boss),
// que continuam a ser adicionadas directamente à combateScene. A rotação
// alinha o "palco" com a câmara 3/4 (ver combateCamera em renderer.js).
const arenaGrupo = new THREE.Group();
arenaGrupo.rotation.y = -0.52;   // ≈ -30°, vira a arena para a câmara
combateScene.add(arenaGrupo);

const arenaR = 7;
const arenaGeo = new THREE.PlaneGeometry(arenaR * 2, arenaR * 2, 1, 1);
const arenaMesh = new THREE.Mesh(arenaGeo, matCombateChao);
arenaMesh.rotation.x = -Math.PI / 2;
arenaMesh.position.y = 0.02;
arenaMesh.receiveShadow = true;
arenaGrupo.add(arenaMesh);

// chão preto por baixo (recebe as sombras nítidas dos lutadores)
const floorShadow = new THREE.Mesh(
    new THREE.CircleGeometry(arenaR * 1.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x080010, roughness: 1 })
);
floorShadow.rotation.x = -Math.PI / 2;
floorShadow.position.y = 0;
floorShadow.receiveShadow = true;
arenaGrupo.add(floorShadow);

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
    arenaGrupo.add(tufo);
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
    arenaGrupo.add(m);
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
arenaGrupo.add(particulas);

// ---- Wraith inimigo (entidade em src/entities/inimigo-wraith.js) ----
export const combateInimigo = criarInimigoWraith();
combateInimigo.position.copy(posInimigoCombate);
combateScene.add(combateInimigo);

// ---- Núcleo Corrompido inimigo (entidade em src/entities/inimigo-nucleo.js) ----
export const combateNucleo = criarInimigoNucleo();
combateNucleo.position.copy(posInimigoCombate);
combateNucleo.visible = false;
combateScene.add(combateNucleo);

// Tipo de inimigo activo em combate normal (não-boss): 'wraith' | 'nucleo'
let _tipoInimigo = 'wraith';
export function setTipoInimigo(tipo) {
    _tipoInimigo = (tipo === 'nucleo') ? 'nucleo' : 'wraith';
    if (_bossMode) return; // boss mode controla visibilidade independentemente
    combateInimigo.visible = (_tipoInimigo === 'wraith');
    combateNucleo.visible  = (_tipoInimigo === 'nucleo');
}
export function getTipoInimigo() { return _tipoInimigo; }
// Devolve o mesh activo (para o systems/combate fazer fade no fim de vitória)
export function getInimigoActivo() {
    return _tipoInimigo === 'nucleo' ? combateNucleo : combateInimigo;
}

// ----------------------------------------------------------------------
// BOSS — instanciação ADIADA (lazy). O boss usa ~24 texturas PBR a 1K
// (~125 MB de VRAM) e dezenas de meshes. Em vez de o criar ao importar
// este módulo (que acontece logo no arranque), criamo-lo só na primeira
// vez que se entra em modo boss. Os jogadores que nunca cheguem a essa
// peleja não pagam o custo. Em placas integradas é a maior poupança
// individual de memória.
// ----------------------------------------------------------------------
let _bossRoot = null;
function _ensureBossInstanciado() {
    if (_bossRoot) return _bossRoot;
    const bossPos = posInimigoCombate.clone();
    bossPos.y = 0;
    criarBoss(combateScene, bossPos, {
        acessorios: ['coroa_magica'],
    });
    _bossRoot = getBossRoot();
    if (_bossRoot) {
        _bossRoot.visible = false;
        _bossRoot.rotation.y = -Math.PI / 2 + 0.25;
    }
    return _bossRoot;
}
// Pré-carregamento opcional, para chamar quando o jogador se aproxima
// do cristal (ou outro gatilho antecipado) e queremos amortizar o load.
export function precarregarBoss() { _ensureBossInstanciado(); }

let _bossMode = false;
export function isBossMode() { return _bossMode; }
export function setBossMode(on) {
    _bossMode = !!on;
    if (_bossMode) _ensureBossInstanciado(); // garante criação no primeiro toggle
    if (_bossRoot) _bossRoot.visible = _bossMode;
    // O boss é um singleton partilhado — pode ter sido movido para a cena
    // de debug. Ao activar o modo boss, garantir que está nesta cena.
    if (_bossMode && _bossRoot) combateScene.add(_bossRoot);
    if (_bossMode) {
        combateInimigo.visible = false;
        combateNucleo.visible  = false;
    } else {
        combateInimigo.visible = (_tipoInimigo === 'wraith');
        combateNucleo.visible  = (_tipoInimigo === 'nucleo');
    }
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

// ---- Atualização por frame (uniforms + animações) ----
let _t = 0;
export function updateCombateScene(deltaTime) {
    _t += deltaTime;
    matCombateChao.uniforms.uTime.value = _t;
    if (starMat) starMat.uniforms.uTime.value = _t;

    // Céu estrelado só nas batalhas normais e com o modo noite activo.
    skyboxCombate.visible = !!settings.nightMode && !_bossMode;

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

    // animação dos inimigos de combate normal (delegada às entidades).
    // Só anima o que está visível para poupar trabalho.
    if (combateInimigo.visible) {
        updateInimigoWraith(combateInimigo, deltaTime, _t, posInimigoCombate);
    }
    if (combateNucleo.visible) {
        updateInimigoNucleo(combateNucleo, deltaTime, _t, posInimigoCombate);
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
    // os inimigos partilham a mesma marca; só aparece o seleccionado pelo
    // tipo. Em boss mode ambos ficam ocultos.
    combateInimigo.position.copy(_posInimigoNormal);
    combateNucleo.position.copy(_posInimigoNormal);
    if (_bossMode) {
        combateInimigo.visible = false;
        combateNucleo.visible  = false;
    } else {
        combateInimigo.visible = (_tipoInimigo === 'wraith');
        combateNucleo.visible  = (_tipoInimigo === 'nucleo');
    }
    resetInimigoWraith(combateInimigo);
    resetInimigoNucleo(combateNucleo);
    // garantir que o boss está visível e na marca correcta se boss mode
    if (_bossMode && _bossRoot) {
        _bossRoot.visible = true;
        _bossRoot.scale.set(1, 1, 1);
        _bossRoot.position.set(posInimigoCombate.x, 0, posInimigoCombate.z);
        _bossRoot.rotation.y = 0;
    }
}
