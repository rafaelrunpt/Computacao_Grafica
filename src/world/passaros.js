// --------------------------------------------------------
// PASSAROS.JS — Aves procedurais (InstancedMesh para performance extrema)
// --------------------------------------------------------
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { settings } from '../systems/settings.js';

let _instancedBirds = null;
let _birdsData = []; // { active: bool, pos: Vector3, dir: Vector3, speed }
const MAX_BIRDS = 45;
const ALTURA = 5.8;
const SPAWN_INTERVAL = 15.0; // Um tempo de respiro longo entre hordas (15s)
let _spawnTimer = 0;

// ---- Sistema de Pólen Místico (Partículas) ----
let _pollenPoints = null;
const POLLEN_COUNT = 400;
const POLLEN_LIFE = 3.5; // Segundos até desaparecer
let _pollenIdx = 0;
let _pollenBirths = null;
let _pollenVels = null;
let _pollenPositions = null;
let _pollenColors = null;

const POLLEN_PALETTE = [
    new THREE.Color(0x88ffaa), // Verde místico
    new THREE.Color(0x88ccff), // Azul etéreo
    new THREE.Color(0xffaa88), // Âmbar suave
    new THREE.Color(0xff88ff), // Rosa mágico
    new THREE.Color(0xffff88), // Dourado pálido
];

let _pollenNeedsUpdate = false;
let _pollenUpdateMin = Infinity;
let _pollenUpdateMax = -1;

export function initPassaros(scene) {
    if (_instancedBirds) return;

    // 1. Geometria: Um par de asas em "V"
    const wingGeo = new THREE.PlaneGeometry(0.35, 0.2);
    wingGeo.translate(0.175, 0, 0); // pivot na base da asa
    
    const asaE = wingGeo.clone();
    const asaD = wingGeo.clone();
    asaD.scale(-1, 1, 1);
    
    const sideE = new Float32Array(asaE.attributes.position.count).fill(-1);
    const sideD = new Float32Array(asaD.attributes.position.count).fill(1);
    asaE.setAttribute('aSide', new THREE.BufferAttribute(sideE, 1));
    asaD.setAttribute('aSide', new THREE.BufferAttribute(sideD, 1));

    const birdGeo = BufferGeometryUtils.mergeGeometries([asaE, asaD]);
    
    // 2. Material Lambert
    const mat = new THREE.MeshLambertMaterial({ 
        color: 0x050505, 
        side: THREE.DoubleSide 
    });

    const onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = `
            uniform float uTime;
            attribute float aSide;
            ${shader.vertexShader}
        `.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float seed = instanceMatrix[3][0] + instanceMatrix[3][2];
            float phase = uTime * 14.0 + seed * 3.0;
            float angle = sin(phase) * 0.85;
            float s = sin(angle * aSide);
            float c = cos(angle * aSide);
            mat2 rot = mat2(c, -s, s, c);
            transformed.xy = rot * transformed.xy;
            `
        );
        mat.userData.shader = shader;
    };

    mat.onBeforeCompile = onBeforeCompile;

    _instancedBirds = new THREE.InstancedMesh(birdGeo, mat, MAX_BIRDS);
    _instancedBirds.castShadow = false; // Sombras removidas por questões de performance
    _instancedBirds.receiveShadow = false;
    _instancedBirds.frustumCulled = false; 

    scene.add(_instancedBirds);

    for (let i = 0; i < MAX_BIRDS; i++) {
        _birdsData.push({ 
            active: false,
            pos: new THREE.Vector3(),
            dir: new THREE.Vector3(),
            color: new THREE.Color() // Cor da horda para o pólen
        });
    }

    // 3. Inicializar Pólen (Partículas GPU-friendly)
    _initPollen(scene);
}

function _initPollen(scene) {
    const geo = new THREE.BufferGeometry();
    _pollenPositions = new Float32Array(POLLEN_COUNT * 3);
    _pollenVels = new Float32Array(POLLEN_COUNT * 3);
    _pollenColors = new Float32Array(POLLEN_COUNT * 3);
    _pollenBirths = new Float32Array(POLLEN_COUNT).fill(-1000); // Mortas

    geo.setAttribute('position', new THREE.BufferAttribute(_pollenPositions, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(_pollenVels, 3));
    // IMPORTANTE: usar o nome standard 'color' para o vertexColors funcionar!
    geo.setAttribute('color', new THREE.BufferAttribute(_pollenColors, 3));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(_pollenBirths, 1));

    // Textura circular suave (estilo pirilampo)
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const pollTex = new THREE.CanvasTexture(canvas);

    const mat = new THREE.PointsMaterial({
        size: 0.35,
        map: pollTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true // O Three.js passa o atributo 'color' automaticamente
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uLife = { value: POLLEN_LIFE };
        shader.vertexShader = `
            uniform float uTime;
            uniform float uLife;
            attribute vec3 aVel;
            attribute float aBirth;
            varying float vAlpha;
            ${shader.vertexShader}
        `.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float age = uTime - aBirth;
            float lifeProgress = clamp(age / uLife, 0.0, 1.0);
            vAlpha = 1.0 - lifeProgress;
            
            // Movimento: v0*t + 0.5*g*t^2 (queda suave)
            vec3 p = position + aVel * age;
            p.y -= 0.5 * age * age; // gravidade ligeira
            p.x += sin(uTime * 1.5 + aBirth) * 0.2 * age; // oscilação lateral
            
            transformed = p;
            `
        ).replace(
            'gl_PointSize = size;',
            `gl_PointSize = size * (1.0 + sin(uTime * 4.0 + aBirth) * 0.2);`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <output_fragment>',
            `
            if (vAlpha <= 0.0) discard;
            gl_FragColor.a *= vAlpha;
            #include <output_fragment>
            `
        );
        mat.userData.shader = shader;
    };

    _pollenPoints = new THREE.Points(geo, mat);
    _pollenPoints.frustumCulled = false;
    scene.add(_pollenPoints);
}

export function isPassarosAtivos() {
    for(let i=0; i<MAX_BIRDS; i++) if(_birdsData[i].active) return true;
    return false;
}

const _dummy = new THREE.Object3D();

export function updatePassaros(dt, player) {
    if (!_instancedBirds || !player) return;

    const time = performance.now() * 0.001;
    
    if (_instancedBirds.material.userData.shader) {
        _instancedBirds.material.userData.shader.uniforms.uTime.value = time;
    }
    if (_pollenPoints.material.userData.shader) {
        _pollenPoints.material.userData.shader.uniforms.uTime.value = time;
    }

    _spawnTimer += dt;
    if (_spawnTimer >= SPAWN_INTERVAL) {
        _spawnTimer = 0;
        _tentarSpawn(player);
    }

    let needsUpdate = false;
    _pollenNeedsUpdate = false;
    _pollenUpdateMin = Infinity;
    _pollenUpdateMax = -1;
    const isNight = settings.nightMode;

    for (let i = 0; i < MAX_BIRDS; i++) {
        const b = _birdsData[i];
        if (!b.active) continue;

        b.pos.addScaledVector(b.dir, b.speed * dt);
        
        if (b.pos.distanceTo(player.position) > 85) {
            b.active = false;
            _dummy.position.set(0, -100, 0);
            _dummy.updateMatrix();
            _instancedBirds.setMatrixAt(i, _dummy.matrix);
            needsUpdate = true;
            continue;
        }

        // Emitir pólen à noite (usa a cor da horda atual)
        if (isNight && Math.random() < 0.15) {
            _emitirPolen(b.pos, b.color);
        }

        _dummy.position.copy(b.pos);
        _dummy.lookAt(b.pos.x + b.dir.x, b.pos.y + b.dir.y, b.pos.z + b.dir.z);
        _dummy.updateMatrix();
        _instancedBirds.setMatrixAt(i, _dummy.matrix);
        needsUpdate = true;
    }
    
    if (needsUpdate) {
        _instancedBirds.instanceMatrix.needsUpdate = true;
    }

    // Otimização: Atualizar apenas o intervalo (range) dos buffers modificado neste frame
    if (_pollenNeedsUpdate) {
        let min = _pollenUpdateMin;
        let max = _pollenUpdateMax;
        
        // Se o buffer deu a volta (wrap around)
        if (max < min) {
            min = 0;
            max = POLLEN_COUNT - 1;
        }
        
        const count = (max - min) + 1;
        const offset = min;
        const offset3 = min * 3;
        const count3 = count * 3;

        const posAttr = _pollenPoints.geometry.attributes.position;
        posAttr.updateRange.offset = offset3;
        posAttr.updateRange.count = count3;
        posAttr.needsUpdate = true;

        const velAttr = _pollenPoints.geometry.attributes.aVel;
        velAttr.updateRange.offset = offset3;
        velAttr.updateRange.count = count3;
        velAttr.needsUpdate = true;

        const colAttr = _pollenPoints.geometry.attributes.color;
        colAttr.updateRange.offset = offset3;
        colAttr.updateRange.count = count3;
        colAttr.needsUpdate = true;

        const birthAttr = _pollenPoints.geometry.attributes.aBirth;
        birthAttr.updateRange.offset = offset;
        birthAttr.updateRange.count = count;
        birthAttr.needsUpdate = true;
    }
}

function _emitirPolen(pos, color) {
    const i = _pollenIdx;
    const time = performance.now() * 0.001;
    
    _pollenPositions[i * 3 + 0] = pos.x;
    _pollenPositions[i * 3 + 1] = pos.y;
    _pollenPositions[i * 3 + 2] = pos.z;
    
    // Velocidade inicial errática e lenta
    _pollenVels[i * 3 + 0] = (Math.random() - 0.5) * 0.6;
    _pollenVels[i * 3 + 1] = (Math.random() - 0.5) * 0.2; // Variação em Y
    _pollenVels[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    
    _pollenColors[i * 3 + 0] = color.r;
    _pollenColors[i * 3 + 1] = color.g;
    _pollenColors[i * 3 + 2] = color.b;

    _pollenBirths[i] = time;
    
    if (i < _pollenUpdateMin) _pollenUpdateMin = i;
    if (i > _pollenUpdateMax) _pollenUpdateMax = i;
    
    _pollenIdx = (_pollenIdx + 1) % POLLEN_COUNT;
    _pollenNeedsUpdate = true;
}

function _tentarSpawn(player) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(player.quaternion);
    
    const targetDist = 5 + Math.random() * 15;
    // Offset lateral para que a horda não passe sempre exactamente em cima da cabeça do herói
    const lateralOffset = (Math.random() - 0.5) * 25; 
    
    const targetCenter = player.position.clone()
        .addScaledVector(forward, targetDist)
        .addScaledVector(right, lateralOffset);
    
    const num = 5 + Math.floor(Math.random() * 6);
    const side = Math.random() > 0.5 ? 1 : -1;
    const baseDir = right.clone().multiplyScalar(side).addScaledVector(forward, (Math.random() - 0.5) * 0.4).normalize();
    
    // Cor partilhada por esta horda
    const hordaColor = POLLEN_PALETTE[Math.floor(Math.random() * POLLEN_PALETTE.length)];
    
    for (let i = 0; i < num; i++) {
        const slot = _birdsData.find(b => !b.active);
        if (!slot) break;

        slot.active = true;
        slot.pos.copy(targetCenter).add(new THREE.Vector3(
            -side * (35 + Math.random() * 10),
            ALTURA + (Math.random() - 0.5) * 2.2,
            (Math.random() - 0.5) * 12
        ));
        slot.dir.copy(baseDir);
        slot.speed = 15 + Math.random() * 7;
        slot.color.copy(hordaColor);
    }
}
