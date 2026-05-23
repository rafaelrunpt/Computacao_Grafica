// --------------------------------------------------------
// CUTSCENE — "As Amostras Estelares"
//
// Cinemática 3D que toca quando o jogador sai da loja depois de
// aceitar a quest da Alice. A câmara sobe e sobrevoa o mapa enquanto
// quatro meteoros — um por amostra, cada um com a cor do respectivo
// item — caem do céu e aterram nas posições onde os itens da quest se
// encontram, cada um com um clarão e um anel de choque.
//
// Controlo do jogador fica bloqueado; a câmara principal é conduzida
// por keyframes. Pode ser saltada com E.
// --------------------------------------------------------

import * as THREE from 'three';
import { ITENS_PERDIDOS } from '../systems/merchant-fetch-quest.js';
import { keys } from '../core/input.js';
import { tocarQuedaMeteoro, tocarImpactoMeteoro } from '../systems/audio.js';

const DURATION = 7.4;
const FOLLOW_OFFSET = new THREE.Vector3(0, 3.8, 9.5);

// --- estado ---
let _scene = null;
let _player = null;
let _active = false;
let _t = 0;
let _onComplete = null;

const _meteors = [];   // { group, head, trail, color, startT, fallDur, fromY, toY, toPos, landed }
const _impacts = [];   // { ring, flash, bornT }

// --- texturas partilhadas (canvas) ---
let _glowTex = null;
let _ringTex = null;
let _ringGeo = null;

// --- DOM (letterbox + narração) ---
let _letterTop = null, _letterBot = null, _narrEl = null;

// Narração da Alice — sincronizada com a queda dos meteoros.
const NARRACAO = [
    { t: 0.3, dur: 2.1, txt: 'Alice: "Os mistérios do abismo há muito me chamam, viajante..."' },
    { t: 2.4, dur: 2.1, txt: 'Alice: "Toda a magia deste mundo é apenas o eco de estrelas que outrora dançaram no vazio."' },
    { t: 4.6, dur: 2.6, txt: 'Alice: "Vede! O firmamento chora luz. Recolhei os fragmentos... antes que a terra os consuma!"' },
];

// Keyframes da câmara. pos/look ausentes → posição de seguimento do jogador.
const CAM_KF = [
    { t: 0.0 },
    { t: 1.7, pos: [ 16, 86, 80], look: [ -6, 3,  -6] },
    { t: 5.2, pos: [-36, 76, 54], look: [-14, 3, -18] },
    { t: DURATION },
];

// --- helpers ---
const _clamp01 = x => Math.min(1, Math.max(0, x));
const _ss = x => { x = _clamp01(x); return x * x * (3 - 2 * x); };

const _pA = new THREE.Vector3(), _pB = new THREE.Vector3();
const _lA = new THREE.Vector3(), _lB = new THREE.Vector3();
const _lookTmp = new THREE.Vector3();

export function isSpaceCutsceneActive() { return _active; }

// ===========================================================
// INIT — cria texturas, meteoros (escondidos) e o DOM.
// ===========================================================
export function initSpaceCutscene(scene, player) {
    if (_scene) return;
    _scene = scene;
    _player = player;

    _glowTex  = _makeGlowTexture();
    _ringTex  = _makeRingTexture();
    _ringGeo  = new THREE.PlaneGeometry(1, 1);

    for (let i = 0; i < ITENS_PERDIDOS.length; i++) {
        const item = ITENS_PERDIDOS[i];
        _meteors.push(_createMeteor(item, i));
    }

    _buildDOM();
}

// ===========================================================
// START — começa a cinemática.
// ===========================================================
export function startSpaceCutscene(onComplete) {
    if (_active || !_scene) { if (onComplete) onComplete(); return; }
    _active = true;
    _t = 0;
    _onComplete = onComplete || null;

    for (const m of _meteors) {
        m.landed = false;
        m.whooshed = false;
        m.group.visible = false;
        m.head.material.opacity = 0;
        m.trail.material.uniforms.uOpacity.value = 0;
    }
    _clearImpacts();

    keys.e = false; // evita salto imediato com o E que abriu a porta
    _letterTop.style.height = '9vh';
    _letterBot.style.height = '9vh';
    _narrEl.style.opacity = '0';
}

// ===========================================================
// UPDATE — chamado todos os frames a partir de animateMundo.
// ===========================================================
export function updateSpaceCutscene(dt, camera) {
    if (!_active) return false;

    // saltar com E
    if (keys.e) { keys.e = false; _t = DURATION; }

    _t += dt;

    _updateMeteors();
    _updateImpacts();
    _updateCamera(camera);
    _updateNarracao();

    if (_t >= DURATION) _finish();
    return true;
}

// ===========================================================
// METEOROS
// ===========================================================
function _createMeteor(item, idx) {
    const grupo = new THREE.Group();
    const color = new THREE.Color(item.cor);

    const head = new THREE.Sprite(new THREE.SpriteMaterial({
        map: _glowTex, color, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    head.scale.set(3.6, 3.6, 1);
    grupo.add(head);

    // Cauda — cilindro vertical REAL (não billboard). Um sprite esticado
    // mantém-se sempre alinhado com o ecrã, pelo que, com a câmara em
    // ângulo, parecia desviar-se para o lado do item. Um cilindro existe
    // de facto no espaço do mundo: fica sempre na coluna vertical, no
    // mesmo x/z do item, só com y mais acima.
    const TRAIL_LEN = 18;
    const trailMat = new THREE.ShaderMaterial({
        uniforms: {
            uColor:   { value: color },
            uOpacity: { value: 0 },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3  uColor;
            uniform float uOpacity;
            varying vec2 vUv;
            void main() {
                // forte junto à cabeça (base), desvanece em direcção ao céu
                float f = 1.0 - vUv.y;
                float a = pow(f, 1.6) * uOpacity;
                gl_FragColor = vec4(uColor * (0.7 + 0.6 * f), a);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    });
    const trail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.95, TRAIL_LEN, 16, 1, true),
        trailMat,
    );
    trail.position.y = TRAIL_LEN / 2;   // base do cilindro junto à cabeça
    grupo.add(trail);

    grupo.visible = false;
    _scene.add(grupo);

    return {
        group: grupo, head, trail, color,
        startT: 0.9 + idx * 0.55,
        fallDur: 1.7,
        fromY: 135,
        toY: 0.7,
        toPos: new THREE.Vector3(item.pos.x, 0.7, item.pos.z),
        landed: false,
        whooshed: false,
    };
}

function _updateMeteors() {
    for (const m of _meteors) {
        const local = (_t - m.startT) / m.fallDur;
        if (local <= 0) { m.group.visible = false; continue; }

        if (local < 1) {
            // assobio da queda (uma vez, no início)
            if (!m.whooshed) {
                m.whooshed = true;
                if (_t < DURATION - 0.1) tocarQuedaMeteoro();
            }
            // queda com aceleração (ease-in)
            m.group.visible = true;
            const e = local * local;
            const y = m.fromY + (m.toY - m.fromY) * e;
            m.group.position.set(m.toPos.x, y, m.toPos.z);
            const op = Math.min(1, local * 4);
            m.head.material.opacity = op;
            m.trail.material.uniforms.uOpacity.value = op * 0.9;
        } else {
            if (!m.landed) {
                m.landed = true;
                m.whooshed = true;
                _spawnImpact(m.toPos, m.color);
                if (_t < DURATION - 0.1) tocarImpactoMeteoro();
            }
            // desvanece a cabeça/cauda logo após o impacto
            const fade = Math.min(1, (local - 1) / 0.35);
            m.group.position.set(m.toPos.x, m.toY, m.toPos.z);
            m.head.material.opacity = (1 - fade);
            m.trail.material.uniforms.uOpacity.value = (1 - fade) * 0.9;
            m.group.visible = fade < 1;
        }
    }
}

// ===========================================================
// IMPACTO — anel de choque + clarão no solo
// ===========================================================
const IMPACT_LIFE = 1.1;

function _spawnImpact(pos, color) {
    const ringMat = new THREE.MeshBasicMaterial({
        map: _ringTex, color, transparent: true, opacity: 0.85,
        depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(_ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.12, pos.z);
    ring.scale.set(2, 2, 2);
    _scene.add(ring);

    const flash = new THREE.Sprite(new THREE.SpriteMaterial({
        map: _glowTex, color: 0xffffff, transparent: true, opacity: 1,
        depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    flash.position.set(pos.x, 1.2, pos.z);
    flash.scale.set(3, 3, 1);
    _scene.add(flash);

    _impacts.push({ ring, flash, bornT: _t });
}

function _updateImpacts() {
    for (let i = _impacts.length - 1; i >= 0; i--) {
        const imp = _impacts[i];
        const age = _t - imp.bornT;
        if (age >= IMPACT_LIFE) { _destroyImpact(imp); _impacts.splice(i, 1); continue; }

        const n = age / IMPACT_LIFE;
        const s = 2 + _ss(n) * 16;
        imp.ring.scale.set(s, s, s);
        imp.ring.material.opacity = (1 - n) * 0.85;

        const fn = Math.min(1, age / 0.35);
        imp.flash.scale.set(2.5 + fn * 5, 2.5 + fn * 5, 1);
        imp.flash.material.opacity = Math.max(0, 1 - age / 0.45);
    }
}

function _destroyImpact(imp) {
    _scene.remove(imp.ring);
    _scene.remove(imp.flash);
    imp.ring.material.dispose();
    imp.flash.material.dispose();
}

function _clearImpacts() {
    for (const imp of _impacts) _destroyImpact(imp);
    _impacts.length = 0;
}

// ===========================================================
// CÂMARA — interpolação por keyframes (smoothstep)
// ===========================================================
function _resolvePos(kf, out) {
    if (kf.pos) return out.set(kf.pos[0], kf.pos[1], kf.pos[2]);
    return out.copy(_player.position).add(FOLLOW_OFFSET);
}
function _resolveLook(kf, out) {
    if (kf.look) return out.set(kf.look[0], kf.look[1], kf.look[2]);
    return out.set(_player.position.x, _player.position.y + 1.2, _player.position.z);
}

function _updateCamera(camera) {
    let i = 0;
    while (i < CAM_KF.length - 2 && _t > CAM_KF[i + 1].t) i++;
    const a = CAM_KF[i], b = CAM_KF[i + 1];
    const u = _ss((_t - a.t) / (b.t - a.t));

    _resolvePos(a, _pA);  _resolvePos(b, _pB);
    _resolveLook(a, _lA); _resolveLook(b, _lB);

    camera.position.lerpVectors(_pA, _pB, u);
    _lookTmp.lerpVectors(_lA, _lB, u);
    camera.lookAt(_lookTmp);
}

// ===========================================================
// NARRAÇÃO
// ===========================================================
function _updateNarracao() {
    let txt = '', op = 0;
    for (const n of NARRACAO) {
        const age = _t - n.t;
        if (age < 0 || age > n.dur) continue;
        txt = n.txt;
        op = _ss(age / 0.3) * _ss((n.dur - age) / 0.4);
        break;
    }
    if (txt && _narrEl.textContent !== txt) _narrEl.textContent = txt;
    _narrEl.style.opacity = String(op);
}

// ===========================================================
// FIM
// ===========================================================
function _finish() {
    _active = false;
    for (const m of _meteors) {
        m.group.visible = false;
        m.head.material.opacity = 0;
        m.trail.material.uniforms.uOpacity.value = 0;
    }
    _clearImpacts();
    _letterTop.style.height = '0';
    _letterBot.style.height = '0';
    _narrEl.style.opacity = '0';
    const cb = _onComplete;
    _onComplete = null;
    if (cb) cb();
}

// ===========================================================
// DOM — barras de letterbox + linha de narração
// ===========================================================
function _buildDOM() {
    const barCss = `
        position: fixed; left: 0; right: 0; height: 0;
        background: #000; z-index: 150; pointer-events: none;
        transition: height 0.6s ease;
    `;
    _letterTop = document.createElement('div');
    _letterTop.style.cssText = barCss + 'top: 0;';
    _letterBot = document.createElement('div');
    _letterBot.style.cssText = barCss + 'bottom: 0;';

    _narrEl = document.createElement('div');
    _narrEl.style.cssText = `
        position: fixed; left: 0; right: 0; bottom: 12vh;
        text-align: center; z-index: 151; pointer-events: none;
        font-family: 'Courier New', monospace; font-size: 22px;
        color: #ffe9a8; letter-spacing: 1px;
        text-shadow: 0 0 14px #b98bff, 0 0 28px #6b4bd6, 2px 2px 0 #000;
        opacity: 0; transition: opacity 0.25s;
    `;
    document.body.appendChild(_letterTop);
    document.body.appendChild(_letterBot);
    document.body.appendChild(_narrEl);
}

// ===========================================================
// TEXTURAS PROCEDURAIS
// ===========================================================
function _makeGlowTexture() {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function _makeRingTexture() {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0.00, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(0.74, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.86, 'rgba(255,255,255,0.45)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
