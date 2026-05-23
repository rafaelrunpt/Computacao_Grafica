// --------------------------------------------------------
// NOITE 11
//
// Arquitectura para alta performance:
//   • ~5 luzes reais (2 PointLights de lanterna + 2 SpotLights de janela
//     com sombra + hemisphere). A luz do herói é a tocha que ele
//     empunha (entities/jogador.js). Cada luz é iterada por fragmento,
//     por isso mantém-se a contagem baixa.
//     por fragmento pelos shaders Standard — mantemos a contagem baixa.
//   • Centenas de "pirilampos" via THREE.Points + vertex-shader que
//     anima a posição. Custo de luz: ZERO (apenas raster de sprites
//     aditivos). Escala bem para milhares.
//   • Pó cintilante a cair dos cristais — outro THREE.Points.
//   • 4 cristais gigantes (MeshStandardMaterial com emissivo alto) —
//     o pós-processamento Bloom é que os faz "explodir" em luz.
//   • EffectComposer com UnrealBloomPass aplica o halo mágico a tudo
//     que tenha emissão alta.
//   • FogExp2 azul-marinho dá profundidade e esconde o limite do mapa.
//
// Desempenho: tudo se mantém em cena permanentemente quando inicializado
// (modo nocturno é decidido no menu inicial — não há toggle em jogo).
// --------------------------------------------------------

import * as THREE from 'three';
import { matWater } from './shaders.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// --- estado ---
let _scene = null;
let _sunLight = null;
let _ambientLight = null;
let _player = null;
let _initialized = false;
let _targetActive = false;
let _t = 0;
let _time = 0;

let _hemiLight = null;
let _nightGroup = null;
let _fireflies = null;       // Points
let _pollen = null;          // Points (ambiente nas árvores)
const _crystalSparkles = []; // 4 Points (1 por cristal — frustum-cullable)
const _crystals = [];        // [{ mesh, basePos, phase }]
const _lanterns = [];        // 4 lanternas
const _torches = [];         // tochas do caminho (PointLight + chama animada)
const _runas = [];           // 6 runas
let _moonSprite = null;
let _moonHalo = null;

let _composer = null;
let _bloomPass = null;
let _origFog = null;

// --- guardar valores originais ---
const _orig = {
    sunColor: null,
    sunIntensity: 1.0,
    ambColor: null,
    ambIntensity: 0.6,
};

// --- cores e configuração ---
const _bgDay   = new THREE.Color(0x87ceeb);
const _bgNight = new THREE.Color(0x06081e);   // azul-marinho profundo
const _sunDay   = new THREE.Color(0xffffff);
const _sunNight = new THREE.Color(0x3050a0);
const _ambDay   = new THREE.Color(0xffffff);
const _ambNight = new THREE.Color(0x2a3060);

// --- API pública ---
export function isNightInitialized() { return _initialized; }
export function isNightActive()      { return _targetActive; }
export function getNightT()          { return _t; }
export function getNightComposer()   { return _composer; }

export function initNightMode(scene, sunLight, ambientLight, player, mainCamera, renderer) {
    if (_initialized) return;
    _scene = scene;
    _sunLight = sunLight;
    _ambientLight = ambientLight;
    _player = player;

    // Modo nocturno: o sol deixa de projectar sombras. Todas as sombras do
    // mundo passam a vir exclusivamente da tocha empunhada pelo jogador.
    sunLight.castShadow = false;

    _orig.sunColor = sunLight.color.clone();
    _orig.sunIntensity = sunLight.intensity;
    _orig.ambColor = ambientLight.color.clone();
    _orig.ambIntensity = ambientLight.intensity;

    _nightGroup = new THREE.Group();
    _nightGroup.name = 'NightFX';

    _createMoon();
    _createLanterns();
    // _createTorches(); // Removido a pedido do utilizador
    _createCrystals();
    _createFireflies();
    _createPollen();
    _createCrystalSparkles();
    _createRunas();

    // Optimização: esconder polígonos inteiramente abaixo de y=0 — não
    // são visíveis em jogo e poupam draw calls / vértices.
    _cullBelowGround(scene);

    // Nevoeiro nocturno — só MeshStandardMaterials reagem; os ShaderMaterials
    // (matBattleGrass, etc.) ignoram-no, o que é desejável: a corrupção
    // continua a brilhar através do nevoeiro.
    _origFog = scene.fog;
    scene.fog = new THREE.FogExp2(0x06081e, 0.009);

    scene.add(_nightGroup);

    // Pós-processamento — composer com bloom para os elementos emissivos
    _setupComposer(mainCamera, renderer);

    _initialized = true;
    _applyEnvironment(0); // arranca em "dia" e faz a transição em update
}

export function setNightMode(on) {
    _targetActive = !!on;
}

export function pauseNightMode() {
    if (!_initialized) return;
    _t = 0;
    _applyEnvironment(0);
}

export function resumeNightMode() { /* no-op — transição é por _targetActive */ }

export function updateNightMode(dt) {
    if (!_initialized) return;
    _time += dt;

    const target = _targetActive ? 1 : 0;
    if (Math.abs(_t - target) > 0.0005) {
        _t += (target - _t) * Math.min(1, dt * 1.6);
    } else {
        _t = target;
    }

    _applyEnvironment(_t);

    if (_player) {
        const mx = _player.position.x - 22;
        const my = 50;
        const mz = _player.position.z - 65;
        if (_moonSprite) _moonSprite.position.set(mx, my, mz);
        if (_moonHalo)   _moonHalo.position.set(mx, my, mz);
    }

    if (_t > 0.01) {
        _updateCrystals();
        // _updateTorches(); // Removido
        if (_fireflies)       _fireflies.material.uniforms.uTime.value = _time;
        if (_pollen)          _pollen.material.uniforms.uTime.value = _time;
        if (_wisps)           _wisps.material.uniforms.uTime.value = _time;
        for (let i = 0; i < _crystalSparkles.length; i++) {
            _crystalSparkles[i].material.uniforms.uTime.value = _time;
        }
        for (let i = 0; i < _runas.length; i++) {
            _runas[i].mesh.material.uniforms.uTime.value = _time;
        }
    }
}

// Chamado pelo main loop em vez de renderer.render() quando o modo nocturno
// está activo. O composer aplica o bloom e devolve a imagem final ao ecrã.
export function renderNightWorld() {
    if (!_composer) return false;
    _composer.render();
    return true;
}

export function resizeNightComposer(w, h) {
    if (!_composer) return;
    _composer.setSize(w, h);
    _bloomPass?.setSize(w, h);
}

// ===========================================================
// AMBIENTE — interpolação suave dia/noite
// ===========================================================
function _applyEnvironment(t) {
    if (!_sunLight) return;

    if (_scene.background?.isColor) {
        _scene.background.copy(_bgDay).lerp(_bgNight, t);
    }
    _sunLight.color.copy(_sunDay).lerp(_sunNight, t);
    _sunLight.intensity = _orig.sunIntensity * (1 - 0.82 * t);

    _ambientLight.color.copy(_ambDay).lerp(_ambNight, t);
    // preenchimento mínimo da noite — aumentado para melhor visibilidade
    _ambientLight.intensity = _orig.ambIntensity * (1 - 0.25 * t);

    if (_hemiLight) _hemiLight.intensity = 0.75 * t;

    // Densidade do nevoeiro também sobe gradualmente
    if (_scene.fog && _scene.fog.isFogExp2) {
        _scene.fog.density = 0.009 * t;
    }

    // Rio — ShaderMaterial ignora luzes/nevoeiro, por isso escurecemos
    // manualmente a água via uniform para acompanhar a transição nocturna.
    if (matWater.uniforms.uNight) {
        matWater.uniforms.uNight.value = t;
    }

    // Bloom proporcional ao "nighty-ness" — moderado para não saturar o ecrã
    if (_bloomPass) {
        _bloomPass.strength = 0.55 * t;
    }

    // Visual da lua
    if (_moonSprite) _moonSprite.material.opacity = t;
    if (_moonHalo)   _moonHalo.material.opacity   = 0.4 * t;

    // Lanternas / cristais — modulam pela transição também
    for (let i = 0; i < _lanterns.length; i++) {
        const lan = _lanterns[i];
        const flicker = 0.85 + 0.15 * Math.sin(_time * 10 + lan.phase) + 0.05 * Math.sin(_time * 22 + lan.phase * 1.5);
        lan.light.intensity = lan.baseIntensity * t * flicker;
        if (lan.sprite) {
            lan.sprite.material.opacity = t * flicker;
        }
    }
    for (let i = 0; i < _crystals.length; i++) {
        _crystals[i].mesh.material.emissiveIntensity =
            _crystals[i].baseEmissive * (0.55 + 0.35 * Math.sin(_time * 1.6 + _crystals[i].phase)) * t;
    }
    for (let i = 0; i < _runas.length; i++) {
        _runas[i].mesh.material.opacity = 0.85 * t;
    }
    if (_fireflies)       _fireflies.material.uniforms.uOpacity.value = t;
    if (_pollen)          _pollen.material.uniforms.uOpacity.value = t;
    for (let i = 0; i < _crystalSparkles.length; i++) {
        _crystalSparkles[i].material.uniforms.uOpacity.value = t;
    }
}

// ===========================================================
// LUA
// ===========================================================
function _createMoon() {
    _hemiLight = new THREE.HemisphereLight(0x4060a0, 0x101830, 0);
    _nightGroup.add(_hemiLight);

    const moonTex = _crescentTexture('#ffffff', '#cfd8f5');
    const haloTex = _radialTexture('#ffffff', '#cfd8f5');
    _moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: moonTex, transparent: true, opacity: 0,
        depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending,
    }));
    _moonSprite.position.set(-80, 85, -40);
    _moonSprite.scale.set(16, 16, 1);
    _moonSprite.renderOrder = -1;
    _nightGroup.add(_moonSprite);

    _moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: haloTex, color: 0x6080c0, transparent: true, opacity: 0,
        depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending,
    }));
    _moonHalo.position.copy(_moonSprite.position);
    _moonHalo.scale.set(42, 42, 1);
    _moonHalo.renderOrder = -2;
    _nightGroup.add(_moonHalo);
}

// ===========================================================
// CULL ABAIXO DE Y=0 — esconde meshes claramente subterrâneos
// (max.y <= -0.5) para poupar polígonos. Mantém o chão e quaisquer
// objectos que toquem ou ultrapassem o nível do solo.
// ===========================================================
function _cullBelowGround(scene) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    let hidden = 0;
    scene.traverse(obj => {
        if (!obj.isMesh || !obj.geometry) return;
        if (obj.userData._nightCulled) return;
        if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
        if (!obj.geometry.boundingBox) return;
        box.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
        // só esconder se TODO o mesh está claramente abaixo do solo
        if (box.max.y <= -0.5) {
            obj.userData._nightCulled = true;
            obj.visible = false;
            hidden++;
        }
    });
    if (hidden > 0) {
        console.log(`[night] culled ${hidden} meshes below y=0`);
    }
}

// ===========================================================
// LANTERNAS — 2 PointLights ambientais (ponte, castelo) +
// 2 SpotLights direccionadas a sair das janelas para o chão
// (loja, taberna) com sombras locais nítidas.
// ===========================================================
const LANTERN_POINTS = [
    { x: -15.0, y: 2.2, z: -39.0, color: 0xffcc00, intensity: 3.5, distance: 7, noSprite: true }, // Lanterna Direita
    { x: -21.0, y: 2.2, z: -39.0, color: 0xffcc00, intensity: 3.5, distance: 7, noSprite: true }  // Lanterna Esquerda
];

// SpotLights que projectam um cone de luz "da janela" para o chão.
const LANTERN_SPOTS_DIR = [
    {
        pos: [-15.0, 2.2, -39.0],
        aim: [-15.0, 0, -39.0],
        color: 0xffaa00,
        intensity: 3.0,
        distance: 8,
        angle: Math.PI / 4,
        penumbra: 0.8,
        noShadow: true
    },
    {
        pos: [-21.0, 2.2, -39.0],
        aim: [-21.0, 0, -39.0],
        color: 0xffaa00,
        intensity: 3.0,
        distance: 8,
        angle: Math.PI / 4,
        penumbra: 0.8,
        noShadow: true
    }
];

function _createLanterns() {
    // ---- pontos decorativos (sem sombras) ----
    for (const s of LANTERN_POINTS) {
        const light = new THREE.PointLight(s.color, 0, s.distance, 2);
        light.position.set(s.x, s.y, s.z);
        _nightGroup.add(light);

        let sprite = null;
        if (!s.noSprite) {
            const colorHex = '#' + s.color.toString(16).padStart(6, '0');
            const tex = _radialTexture('#ffffff', colorHex);
            sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: tex, color: s.color, transparent: true, opacity: 0,
                depthWrite: false, blending: THREE.AdditiveBlending,
            }));
            const sc = s.spriteScale || 1.4;
            sprite.scale.set(sc, sc, 1);
            sprite.position.set(s.x, s.y, s.z);
            _nightGroup.add(sprite);
        }

        _lanterns.push({ 
            light, sprite, 
            baseIntensity: s.intensity,
            phase: Math.random() * Math.PI * 2
        });
    }

    // ---- spotlights de janela (sem sombra para performance) ----
    for (const s of LANTERN_SPOTS_DIR) {
        const sp = new THREE.SpotLight(
            s.color, 0, s.distance, s.angle, s.penumbra, 1.5,
        );
        sp.position.set(s.pos[0], s.pos[1], s.pos[2]);
        sp.target.position.set(s.aim[0], s.aim[1], s.aim[2]);
        
        if (!s.noShadow) {
            sp.castShadow = true;
            sp.shadow.mapSize.set(512, 512);
            sp.shadow.bias = -0.0008;
            sp.shadow.normalBias = 0.04;
            sp.shadow.camera.near = 0.5;
            sp.shadow.camera.far  = s.distance + 2;
            sp.shadow.camera.layers.enable(1);
        }
        
        _nightGroup.add(sp, sp.target);
        _lanterns.push({ light: sp, sprite: null, baseIntensity: s.intensity, phase: Math.random() * Math.PI * 2 });
    }
}


// ===========================================================
// LUZ DO HERÓI — já não há luz própria aqui. A iluminação do jogador no
// modo nocturno vem da PointLight da tocha empunhada (entities/jogador.js):
// só existe e só projecta sombras quando a tocha está equipada. Sem tocha,
// a noite fica escura — é intencional.
// ===========================================================

// ===========================================================
// CRISTAIS GIGANTES — 4 colunas hexagonais emissivas
// ===========================================================
const CRYSTAL_SPOTS = [
    { x: -70, z:  60, h: 5.5, color: 0x9020ff, scale: 1.1 },
    { x:  68, z:  55, h: 4.8, color: 0x40c0ff, scale: 1.0 },
    { x: -68, z: -55, h: 6.2, color: 0xff20a0, scale: 1.2 },
    { x:  62, z: -55, h: 5.0, color: 0xffd040, scale: 1.0 },
];

function _createCrystals() {
    for (let i = 0; i < CRYSTAL_SPOTS.length; i++) {
        const s = CRYSTAL_SPOTS[i];
        // Geometria de cristal — cone hexagonal alongado
        const geo = new THREE.ConeGeometry(0.7 * s.scale, s.h, 6, 1, false);
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(s.color).multiplyScalar(0.3),
            emissive: s.color,
            emissiveIntensity: 0,
            metalness: 0.4,
            roughness: 0.25,
            transparent: true,
            opacity: 0.95,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(s.x, s.h / 2, s.z);
        mesh.rotation.z = (Math.random() - 0.5) * 0.15;
        mesh.rotation.x = (Math.random() - 0.5) * 0.15;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        _nightGroup.add(mesh);

        // pequeno cristal secundário inclinado ao lado
        const geo2 = new THREE.ConeGeometry(0.35 * s.scale, s.h * 0.6, 6);
        const mesh2 = new THREE.Mesh(geo2, mat);
        mesh2.position.set(
            s.x + 0.9 * s.scale,
            s.h * 0.3,
            s.z + 0.3,
        );
        mesh2.rotation.z = 0.6;
        _nightGroup.add(mesh2);

        _crystals.push({
            mesh, mesh2,
            phase: i * 1.7,
            baseEmissive: 1.4,
            color: s.color,
            pos: new THREE.Vector3(s.x, s.h / 2, s.z),
            topY: s.h,
        });
    }
}

function _updateCrystals() {
    // emissiveIntensity já é animada em _applyEnvironment via _crystals[i].phase
    // (mantém-se uma única ramificação de animação para ambos os meshes do par
    // — partilham o material).
}

// ===========================================================
// TOCHAS — fila de PointLights ao longo do caminho até ao castelo.
// Mostram bem o custo de várias luzes dinâmicas + sombras de tochas
// (apenas as 2 do meio têm castShadow para manter o custo equilibrado).
// ===========================================================
const TORCH_POSITIONS = [
    { x: -5, z: -15 }, { x:  5, z: -15 },
    { x: -5, z: -40 }, { x:  5, z: -40 },
    { x: -5, z: -65 }, { x:  5, z: -65 },
];

function _createTorches() {
    // Postes mais altos e robustos — tochas maiores tornam o efeito óbvio
    // tanto à distância como em close-up.
    const postGeo = new THREE.CylinderGeometry(0.10, 0.16, 2.2, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.95 });

    // Texturas separadas para o corpo da chama (azul-saturado) e o núcleo
    // branco-azulado quente que dá o ponto mais brilhante no centro.
    const flameOuterTex = _radialTexture('#a0d0ff', '#1850ff');
    const flameInnerTex = _radialTexture('#ffffff', '#80c0ff');

    for (let i = 0; i < TORCH_POSITIONS.length; i++) {
        const p = TORCH_POSITIONS[i];
        const group = new THREE.Group();
        group.position.set(p.x, 0, p.z);

        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = 1.1;
        post.castShadow = false;
        post.receiveShadow = true;
        group.add(post);

        // Corpo da chama — azul-eléctrico, sprite aditivo grande.
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({
            map: flameOuterTex, transparent: true, opacity: 0,
            depthWrite: false, blending: THREE.AdditiveBlending,
            color: 0xffffff,
        }));
        flame.position.y = 2.45;
        flame.scale.set(1.10, 1.55, 1);
        group.add(flame);

        // Núcleo branco-azulado — pequeno sprite por cima do corpo da
        // chama, para dar o ponto incandescente que o bloom amplifica.
        const flameCore = new THREE.Sprite(new THREE.SpriteMaterial({
            map: flameInnerTex, transparent: true, opacity: 0,
            depthWrite: false, blending: THREE.AdditiveBlending,
            color: 0xffffff,
        }));
        flameCore.position.y = 2.35;
        flameCore.scale.set(0.55, 0.75, 1);
        group.add(flameCore);

        // PointLight sem sombra — cube-shadow custa 6 passes/frame por
        // luz, e a iluminação dinâmica do chão já dá o efeito de tocha
        // sem precisar das silhuetas projectadas.
        const light = new THREE.PointLight(0x4080ff, 0, 14, 2);
        light.position.y = 2.4;
        light.castShadow = false;
        group.add(light);

        _nightGroup.add(group);
        _torches.push({
            flame, flameCore, light,
            baseIntensity: 5.5,
            phase: Math.random() * Math.PI * 2,
        });
    }
}

function _updateTorches() {
    for (const t of _torches) {
        // dois sin de frequências diferentes = flicker irregular
        const f = 0.78
                + 0.28 * Math.sin(_time * 12 + t.phase)
                + 0.14 * Math.sin(_time * 23 + t.phase * 1.7);
        t.light.intensity = t.baseIntensity * f * _t;

        const flickerY = 0.15 * Math.cos(_time * 11 + t.phase);
        const flickerX = 0.10 * Math.sin(_time * 15 + t.phase);

        const m = t.flame.material;
        m.opacity = (0.65 + 0.30 * Math.sin(_time * 8 + t.phase)) * _t;
        t.flame.scale.x = 1.05 + flickerX;
        t.flame.scale.y = 1.50 + flickerY;

        if (t.flameCore) {
            const mc = t.flameCore.material;
            mc.opacity = (0.80 + 0.20 * Math.sin(_time * 9 + t.phase * 1.3)) * _t;
            t.flameCore.scale.x = 0.50 + flickerX * 0.6;
            t.flameCore.scale.y = 0.72 + flickerY * 0.6;
        }
    }
}

// ===========================================================
// PIRILAMPOS — THREE.Points (vertex-shader animado, sem luzes)
// ===========================================================
function _isInPath(x, z) {
    // central N-S corridor
    if (Math.abs(x) < 4) return true;
    // shop east-west z≈25
    if (z > 20 && z < 30 && x > -36 && x < 3) return true;
    // bridge area (river around z≈0)
    if (Math.abs(z) < 6) return true;
    // dentro do castelo
    if (z < -65 && z > -90 && x > -12 && x < 12) return true;
    return false;
}

function _createFireflies() {
    const POIs = [
        { x:   0, z:   3, r: 4.0, w: 0.2, color: [1.0, 0.5, 0.3] }, // ponte (Sul)
        { x:   0, z: -82, r: 12.0, w: 6.0, color: [0.7, 0.4, 1.0] }, // castelo (Extremo Norte - Máximo Peso)
        { x: -28, z:  27, r: 3.5, w: 0.1, color: [1.0, 0.85, 0.4] },// loja (Sul)
        { x: -43, z:  37, r: 3.5, w: 0.1, color: [1.0, 0.9, 0.5] }, // taberna (Sul)
        { x: -70, z:  60, r: 5.0, w: 0.3, color: [0.7, 0.3, 1.0] }, // cristal/combate NW (Sul)
        { x:  68, z:  55, r: 5.0, w: 0.3, color: [0.3, 0.8, 1.0] }, // cristal/combate NE (Sul)
        { x: -68, z: -55, r: 5.0, w: 2.2, color: [1.0, 0.4, 0.9] }, // cristal/combate SW (Norte)
        { x:  62, z: -55, r: 5.0, w: 2.2, color: [1.0, 0.85, 0.3] },// cristal/combate SE (Norte)
        { x: -50, z: -50, r: 3.0, w: 1.2, color: [0.8, 0.5, 1.0] }, // runa SW (Norte)
        { x:  50, z: -50, r: 3.0, w: 1.2, color: [0.4, 1.0, 0.8] }, // runa SE (Norte)
    ];

    const BASE_PER_POI = 35;        
    const SCATTERED    = 150;       

    let totalCluster = 0;
    for (const p of POIs) totalCluster += Math.round(BASE_PER_POI * p.w);
    const MAX_COUNT = totalCluster + SCATTERED;

    const positions = new Float32Array(MAX_COUNT * 3);
    const phases    = new Float32Array(MAX_COUNT);
    const speeds    = new Float32Array(MAX_COUNT);
    const colors    = new Float32Array(MAX_COUNT * 3);
    const radii     = new Float32Array(MAX_COUNT);

    let placed = 0;

    function _push(x, y, z, col, phaseRand, speedRand, radiusRand) {
        if (placed >= MAX_COUNT) return;
        // Se estiver muito a sul (z > 20) e não for um POI muito próximo, 
        // chance de 90% de ignorar para forçar o deserto visual
        if (z > 15 && Math.random() < 0.9) return;

        const i = placed++;
        positions[i*3+0] = x; positions[i*3+1] = y; positions[i*3+2] = z;
        phases[i] = phaseRand;
        speeds[i] = speedRand;
        radii[i]  = radiusRand;
        colors[i*3+0] = col[0]; colors[i*3+1] = col[1]; colors[i*3+2] = col[2];
    }

    // 1. POIs
    for (const p of POIs) {
        const n = Math.round(BASE_PER_POI * p.w);
        for (let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2;
            const d   = Math.sqrt(Math.random()) * p.r;
            _push(
                p.x + Math.cos(ang) * d,
                1.5 + Math.random() * 4.5,
                p.z + Math.sin(ang) * d,
                p.color,
                Math.random() * Math.PI * 2,
                0.5 + Math.random() * 1.2,
                0.6 + Math.random() * 1.5
            );
        }
    }

    // 2. Dispersos (90% no Norte) — paleta variada (verde-lima, azul-pálido,
    //    rosa, lilás, âmbar) em vez de tudo amarelo, para parecerem espécies
    //    diferentes a percorrer o mato.
    const WANDER_COLORS = [
        [0.6, 1.0, 0.4],  // verde-lima
        [0.4, 0.9, 1.0],  // azul-pálido
        [1.0, 0.5, 0.8],  // rosa-magenta
        [0.8, 0.5, 1.0],  // lilás
        [1.0, 0.85, 0.4], // âmbar (mantido em minoria)
        [0.5, 1.0, 0.8],  // verde-água
    ];
    for (let i = 0; i < SCATTERED; i++) {
        const x = (Math.random() * 2 - 1) * 94;
        let z;
        if (Math.random() < 0.92) z = -Math.random() * 94;
        else                     z =  Math.random() * 94;

        if (_isInPath(x, z)) continue;

        const col = WANDER_COLORS[Math.floor(Math.random() * WANDER_COLORS.length)];
        _push(
            x, 1.2 + Math.random() * 3.5, z,
            col,
            Math.random() * Math.PI * 2,
            0.6 + Math.random() * 1.0,
            0.5 + Math.random() * 2.0
        );
    }
    // ... (geometria e material de fireflies permanecem iguais ou similares)

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, placed * 3), 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases.subarray(0, placed),  1));
    geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds.subarray(0, placed),  1));
    geo.setAttribute('aColor',   new THREE.BufferAttribute(colors.subarray(0, placed * 3), 3));
    geo.setAttribute('aRadius',  new THREE.BufferAttribute(radii.subarray(0, placed),   1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime:    { value: 0 },
            uOpacity: { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio || 1 },
        },
        vertexShader: `
            attribute float aPhase;
            attribute float aSpeed;
            attribute vec3  aColor;
            attribute float aRadius;
            varying vec3  vColor;
            varying float vPulse;
            uniform float uTime;
            uniform float uPixelRatio;

            float hash(float n) { return fract(sin(n) * 43758.5453123); }

            void main() {
                vec3 pos = position;
                float t = uTime * aSpeed + aPhase;
                
                pos.x += sin(t) * aRadius;
                pos.z += cos(t * 1.3) * aRadius;
                pos.y += sin(t * 1.7 + aPhase) * 0.8;

                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mv;

                float dist = -mv.z;
                gl_PointSize = uPixelRatio * 7.0 * (35.0 / max(dist, 1.0));

                vColor = aColor;
                // Brilho procedural mais caótico
                float p = sin(uTime * 5.0 + aPhase * 10.0) * 0.5 + 0.5;
                vPulse = pow(p, 3.0) * (0.8 + 0.5 * hash(aPhase + floor(uTime * 10.0)));
            }
        `,
        fragmentShader: `
            uniform float uOpacity;
            varying vec3  vColor;
            varying float vPulse;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                vec3 col = vColor * core * vPulse * 4.0;
                gl_FragColor = vec4(col, core * uOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    _fireflies = new THREE.Points(geo, mat);
    _fireflies.frustumCulled = false; // animação shader move-os fora da bounding
    _nightGroup.add(_fireflies);

    _createWisps();
}

let _wisps = null;
function _createWisps() {
    const COUNT = 35;
    const positions = new Float32Array(COUNT * 3);
    const phases    = new Float32Array(COUNT);
    
    for (let i = 0; i < COUNT; i++) {
        positions[i*3+0] = (Math.random() * 2 - 1) * 85;
        positions[i*3+1] = 1.5 + Math.random() * 2.5;
        positions[i*3+2] = (Math.random() * 2 - 1) * 85;
        phases[i] = Math.random() * Math.PI * 2;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio || 1 }
        },
        vertexShader: `
            attribute float aPhase;
            varying float vGlow;
            uniform float uTime;
            uniform float uPixelRatio;
            void main() {
                vec3 pos = position;
                float t = uTime * 0.4 + aPhase;
                pos.x += sin(t) * 3.5;
                pos.z += cos(t * 0.8) * 3.5;
                pos.y += sin(t * 1.2) * 1.5;
                
                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = uPixelRatio * 35.0 * (40.0 / max(-mv.z, 1.0));
                vGlow = 0.5 + 0.5 * sin(uTime * 1.5 + aPhase);
            }
        `,
        fragmentShader: `
            varying float vGlow;
            uniform float uOpacity;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                // Azul fantasmagórico / Roxo
                vec3 col = mix(vec3(0.2, 0.5, 1.0), vec3(0.6, 0.2, 1.0), vGlow);
                gl_FragColor = vec4(col * core * (1.5 + vGlow), core * uOpacity * 0.8);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    
    _wisps = new THREE.Points(geo, mat);
    _nightGroup.add(_wisps);
}

// ===========================================================
// PÓLEN — partículas minúsculas a flutuar nas zonas arborizadas.
// Densidade variável: alta no manto de árvores (z>5 e z<-5),
// quase nula nos caminhos centrais. Animação 100% no shader.
// ===========================================================
function _createPollen() {
    // Reduzido de 700 → 400: sprites aditivos com depthWrite:false causam
    // overdraw alto no fillrate. 400 partículas ainda parecem "ambiente".
    const COUNT = 400;
    const positions = new Float32Array(COUNT * 3);
    const phases    = new Float32Array(COUNT);
    const speeds    = new Float32Array(COUNT);
    const sizes     = new Float32Array(COUNT);

    let placed = 0, tries = 0;
    while (placed < COUNT && tries < COUNT * 8) {
        tries++;
        const x = (Math.random() * 2 - 1) * 94;
        // 50/50 norte/sul, evita o corredor central
        const sign = Math.random() < 0.5 ? 1 : -1;
        const z = sign * (6 + Math.random() * 88);
        if (_isInPath(x, z)) continue;
        // densidade alta dentro do bosque, baixa nas bermas
        const ax = Math.abs(x);
        if (ax > 90 && Math.random() < 0.7) continue;

        const i = placed++;
        positions[i*3+0] = x;
        positions[i*3+1] = 0.4 + Math.random() * 3.8;   // canopy
        positions[i*3+2] = z;
        phases[i] = Math.random() * Math.PI * 2;
        speeds[i] = 0.15 + Math.random() * 0.35;
        sizes[i]  = 0.7 + Math.random() * 1.1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, placed * 3), 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases.subarray(0, placed), 1));
    geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds.subarray(0, placed), 1));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes.subarray(0, placed), 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime:    { value: 0 },
            uOpacity: { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio || 1 },
        },
        vertexShader: `
            attribute float aPhase;
            attribute float aSpeed;
            attribute float aSize;
            varying float vTwinkle;
            uniform float uTime;
            uniform float uPixelRatio;
            void main() {
                vec3 pos = position;
                float t = uTime * aSpeed + aPhase;
                // deriva muito lenta — brisa
                pos.x += sin(t * 0.7) * 0.9;
                pos.z += cos(t * 0.5) * 0.9;
                pos.y += sin(t * 1.1) * 0.6;
                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mv;
                float d = -mv.z;
                gl_PointSize = uPixelRatio * 5.0 * aSize * (35.0 / max(d, 1.0));
                vTwinkle = 0.6 + 0.4 * sin(uTime * 2.0 + aPhase * 7.0);
            }
        `,
        fragmentShader: `
            uniform float uOpacity;
            varying float vTwinkle;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                // pólen dourado-pálido
                vec3 col = vec3(1.0, 0.95, 0.55);
                gl_FragColor = vec4(col * core * vTwinkle * 0.9, core * uOpacity * 0.55);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    _pollen = new THREE.Points(geo, mat);
    _pollen.frustumCulled = false;
    _nightGroup.add(_pollen);
}

// ===========================================================
// PÓ MÁGICO DOS CRISTAIS — Points a cair do topo dos cristais
// ===========================================================
function _createCrystalSparkles() {
    const PER = 15;                      // partículas por cristal (era 25)

    // Material partilhado por todos os clusters (mesmas uniforms — uTime e
    // uOpacity actualizam-se 4× por frame mas é negligível).
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime:    { value: 0 },
            uOpacity: { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio || 1 },
        },
        vertexShader: `
            attribute vec3  aOrigin;
            attribute float aPhase;
            attribute float aSpeed;
            attribute vec3  aColor;
            attribute float aHeight;
            varying vec3  vColor;
            varying float vAlpha;
            uniform float uTime;
            uniform float uPixelRatio;
            void main() {
                // caem de aOrigin até y=0 em loop, com pequena deriva lateral
                float life = mod(uTime * aSpeed + aPhase * 0.5, 1.0);
                float y = mix(aHeight, 0.0, life);
                float x = aOrigin.x + sin(uTime * 0.6 + aPhase) * 0.25;
                float z = aOrigin.z + cos(uTime * 0.5 + aPhase * 1.3) * 0.25;
                vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
                gl_Position = projectionMatrix * mv;
                float dist = -mv.z;
                gl_PointSize = uPixelRatio * 10.0 * (35.0 / max(dist, 1.0));
                vColor = aColor;
                // fade-in nos primeiros 20% da vida, fade-out nos últimos 30%
                vAlpha = smoothstep(0.0, 0.2, life) * smoothstep(1.0, 0.7, life);
            }
        `,
        fragmentShader: `
            uniform float uOpacity;
            varying vec3  vColor;
            varying float vAlpha;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                gl_FragColor = vec4(vColor * (0.5 + 1.5 * core), core * vAlpha * uOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    // Um Points por cristal — bounding sphere apertada permite ao three.js
    // saltar clusters fora do view frustum (quando estás virado a oeste,
    // os cristais a este nem são desenhados).
    for (const s of CRYSTAL_SPOTS) {
        const positions = new Float32Array(PER * 3);
        const phases    = new Float32Array(PER);
        const speeds    = new Float32Array(PER);
        const colors    = new Float32Array(PER * 3);
        const origins   = new Float32Array(PER * 3);
        const heights   = new Float32Array(PER);

        const col = new THREE.Color(s.color);
        for (let i = 0; i < PER; i++) {
            const ox = s.x + (Math.random() - 0.5) * 1.4;
            const oz = s.z + (Math.random() - 0.5) * 1.4;
            const oy = s.h * (0.6 + Math.random() * 0.6);
            origins[i*3]     = ox;
            origins[i*3+1]   = oy;
            origins[i*3+2]   = oz;
            positions[i*3]   = ox;
            positions[i*3+1] = oy;
            positions[i*3+2] = oz;
            phases[i]  = Math.random() * Math.PI * 2;
            speeds[i]  = 0.3 + Math.random() * 0.4;
            heights[i] = oy;
            colors[i*3]   = col.r;
            colors[i*3+1] = col.g;
            colors[i*3+2] = col.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aOrigin',  new THREE.BufferAttribute(origins, 3));
        geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
        geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds, 1));
        geo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('aHeight',  new THREE.BufferAttribute(heights, 1));

        // Bounding sphere manual à volta do cristal — raio cobre a deriva
        // horizontal (~0.5m) e a queda vertical (h metros). Com isto o
        // frustumCulled funciona correctamente apesar da animação shader.
        geo.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(s.x, s.h * 0.5, s.z),
            s.h + 1.5,
        );

        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = true; // bounding sphere já cobre a animação
        _nightGroup.add(pts);
        _crystalSparkles.push(pts);
    }
}

// ===========================================================
// RUNAS — discos mágicos no chão (ShaderMaterial), em pontos icónicos
// ===========================================================
function _createRunas() {
    // Removidas todas as runas — o utilizador retirou primeiro as da ponte
    // e agora pediu para tirar também as iguais espalhadas pelo mapa
    // (loja, taberna, ruínas SW/SE). Mantemos a função para reactivação fácil.
    const positions = [];
    for (let i = 0; i < positions.length; i++) {
        const [x, z, col] = positions[i];
        const mat = _makeRuneMaterial(col, i);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.06, z);
        _nightGroup.add(mesh);
        _runas.push({ mesh });
    }
}

function _makeRuneMaterial(colorHex, seed) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime:  { value: 0 },
            uColor: { value: new THREE.Color(colorHex) },
            uSeed:  { value: seed },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3  uColor;
            uniform float uSeed;
            varying vec2 vUv;
            void main() {
                vec2 c = vUv - 0.5;
                float dist = length(c);
                float ang  = atan(c.y, c.x);
                float mask = smoothstep(0.50, 0.42, dist);
                if (mask < 0.01) discard;
                float rays  = 0.5 + 0.5 * sin(ang * 6.0 + uTime * 0.8 + uSeed);
                rays       *= smoothstep(0.05, 0.40, dist);
                float inner = smoothstep(0.10, 0.08, abs(dist - 0.16));
                float outer = smoothstep(0.04, 0.02, abs(dist - 0.42));
                float pulse = 0.6 + 0.4 * sin(uTime * 2.2 + uSeed);
                float core  = smoothstep(0.18, 0.0, dist);
                vec3 hot = mix(uColor, vec3(1.0), 0.6);
                vec3 final = uColor * rays * 0.6 * pulse
                           + hot * (inner + outer) * (0.7 + 0.3 * pulse)
                           + hot * core * 1.8;
                gl_FragColor = vec4(final, mask * 0.85);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    });
}

// ===========================================================
// PÓS-PROCESSAMENTO — Composer + RenderPass + Bloom + Output
// ===========================================================
function _setupComposer(camera, renderer) {
    _composer = new EffectComposer(renderer);
    _composer.setSize(window.innerWidth, window.innerHeight);
    _composer.setPixelRatio(renderer.getPixelRatio());

    _composer.addPass(new RenderPass(_scene, camera));

    _bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0,      // strength (animado por _applyEnvironment — sobe até ~0.55)
        0.35,   // radius — halos contidos, sem invadir a tela
        0.88,   // threshold alto — só os elementos verdadeiramente mágicos
                // (centros dos cristais, runas, lanternas) iluminam halos;
                // o resto da cena passa sem bloom para preservar contraste.
    );
    _composer.addPass(_bloomPass);

    // Output final em sRGB
    _composer.addPass(new OutputPass());

    // Resize automático — o composer e o bloom têm de acompanhar
    window.addEventListener('resize', () => {
        const w = window.innerWidth, h = window.innerHeight;
        _composer.setSize(w, h);
        _bloomPass.setSize(w, h);
    });
}

// ===========================================================
// HELPERS
// ===========================================================
const _glowCache = {};
function _radialTexture(coreColor, haloColor) {
    const key = coreColor + '|' + haloColor;
    if (_glowCache[key]) return _glowCache[key];
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0.00, coreColor);
    g.addColorStop(0.25, haloColor);
    g.addColorStop(0.60, _toRgba(haloColor, 0.4));
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _glowCache[key] = tex;
    return tex;
}

// Desenha uma lua em quarto minguante: disco luminoso com um disco
// ligeiramente deslocado para a direita "cortado" (destination-out), de
// modo a deixar uma foice virada à esquerda — fase minguante.
function _crescentTexture(coreColor, haloColor) {
    const key = 'crescent|' + coreColor + '|' + haloColor;
    if (_glowCache[key]) return _glowCache[key];
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');

    // Disco luminoso (gradient radial — mesmo look que _radialTexture)
    const cx = size * 0.42, cy = size / 2;     // ligeiramente à esquerda
    const r  = size * 0.38;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.00, coreColor);
    g.addColorStop(0.55, haloColor);
    g.addColorStop(1.00, _toRgba(haloColor, 0.0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Recorta o lado direito com um segundo disco — sombra do corpo da lua
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx + r * 0.82, cy, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _glowCache[key] = tex;
    return tex;
}

function _toRgba(hex, a) {
    hex = hex.replace('#', '');
    const n = parseInt(hex, 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
