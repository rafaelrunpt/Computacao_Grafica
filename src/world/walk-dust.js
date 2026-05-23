// --------------------------------------------------------
// RASTO DE POEIRA DO JOGADOR
//
// Pool de partículas reciclado: a CPU emite uma rajada quando o
// jogador se desloca acima de uma velocidade mínima; o vertex-shader
// anima a vida de cada partícula (sobe, alarga, desvanece) a partir
// do uTime e do aBorn — custo de luz ZERO.
//
// Extraído de night-mode.js para correr também no mundo de DIA, não
// apenas de noite (o módulo nocturno só é inicializado em modo noite).
// --------------------------------------------------------

import * as THREE from 'three';

const POOL      = 140;
const LIFE      = 0.45;
const EMIT_DT   = 0.05;
const MIN_SPEED = 0.6;

let _points = null;
let _player = null;
let _time = 0;
let _idx = 0;
let _emitAcc = 0;
const _lastPos = new THREE.Vector3();
let _posKnown = false;

export function initWalkDust(scene, player) {
    if (_points) return;
    _player = player;

    const N = POOL;
    const positions = new Float32Array(N * 3);
    const borns     = new Float32Array(N);
    const vels      = new Float32Array(N * 3);

    // todas começam "mortas" (born muito antigo)
    for (let i = 0; i < N; i++) borns[i] = -1000;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aBorn',    new THREE.BufferAttribute(borns, 1));
    geo.setAttribute('aVel',     new THREE.BufferAttribute(vels, 3));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime:       { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio || 1 },
            uLife:       { value: LIFE },
        },
        vertexShader: `
            attribute float aBorn;
            attribute vec3  aVel;
            varying float vLife;
            uniform float uTime;
            uniform float uLife;
            uniform float uPixelRatio;
            void main() {
                float age = uTime - aBorn;
                float life = age / uLife;          // 0..1
                if (life < 0.0 || life > 1.0) {
                    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // off-screen
                    gl_PointSize = 0.0;
                    vLife = 1.0;
                    return;
                }
                vec3 pos = position + aVel * age;
                // gravidade leve para não voar demais
                pos.y += -0.6 * age * age;
                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mv;
                float d = -mv.z;
                gl_PointSize = uPixelRatio * (2.0 + 4.0 * life) * (35.0 / max(d, 1.0));
                vLife = life;
            }
        `,
        fragmentShader: `
            varying float vLife;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.05, d);
                // fade-in rápido nos primeiros 10%, fade-out longo
                float a = smoothstep(0.0, 0.1, vLife) * smoothstep(1.0, 0.4, vLife);
                // tom de terra/poeira
                vec3 col = vec3(0.62, 0.52, 0.38);
                gl_FragColor = vec4(col, core * a * 0.55);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
    });

    _points = new THREE.Points(geo, mat);
    _points.frustumCulled = false; // animação shader move-as fora da bounding
    scene.add(_points);
}

function _emit(px, py, pz) {
    const geo = _points.geometry;
    const positions = geo.attributes.position;
    const borns     = geo.attributes.aBorn;
    const vels      = geo.attributes.aVel;

    const i = _idx;
    _idx = (_idx + 1) % POOL;

    // jitter à volta do pé — contido
    const ox = (Math.random() - 0.5) * 0.25;
    const oz = (Math.random() - 0.5) * 0.25;
    positions.array[i*3+0] = px + ox;
    positions.array[i*3+1] = py + 0.05;
    positions.array[i*3+2] = pz + oz;

    // velocidade — explosão lateral suave + subir baixinho
    const ang = Math.random() * Math.PI * 2;
    const r   = 0.25 + Math.random() * 0.4;
    vels.array[i*3+0] = Math.cos(ang) * r * 0.5;
    vels.array[i*3+1] = 0.45 + Math.random() * 0.35;
    vels.array[i*3+2] = Math.sin(ang) * r * 0.5;

    borns.array[i] = _time;

    positions.needsUpdate = true;
    borns.needsUpdate     = true;
    vels.needsUpdate      = true;
}

export function updateWalkDust(dt) {
    if (!_points || !_player) return;
    _time += dt;
    _points.material.uniforms.uTime.value = _time;

    const px = _player.position.x, py = _player.position.y, pz = _player.position.z;

    if (!_posKnown) {
        _lastPos.set(px, py, pz);
        _posKnown = true;
        return;
    }

    const dx = px - _lastPos.x;
    const dz = pz - _lastPos.z;
    const horiz = Math.hypot(dx, dz);
    const speed = horiz / Math.max(dt, 1e-4);

    if (speed > MIN_SPEED) {
        _emitAcc += dt;
        while (_emitAcc >= EMIT_DT) {
            _emitAcc -= EMIT_DT;
            _emit(px, py, pz);
        }
    } else {
        _emitAcc = 0;
    }

    _lastPos.set(px, py, pz);
}
