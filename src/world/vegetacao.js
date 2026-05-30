import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { settings } from '../systems/settings.js';

let _instancedGrass = null;
let _instancedFlowers = null;
let _battleZonesUniforms = { value: new Float32Array(10 * 4) };
let _purificationTimes = { value: new Float32Array(10) };

// Presets por nível de qualidade — escolhido no ecrã inicial.
// area = dimensão do quadrado de povoamento; sphere = raio do bounding sphere
// usado para frustum culling. Manter sphere ≈ area*0.75 evita flicker nas bordas.
// No modo ALTO, area=200 cobre praticamente todo o mapa visível e sphere=250 
// garante que não há culling agressivo, mantendo a relva "sempre lá".
const VEG_PRESETS = {
    baixa: { grass: 12000, flowers: 1200, area: 100, sphere: 80 },
    media: { grass: 45000, flowers: 3500, area: 150, sphere: 110 },
    alta:  { grass: 160000, flowers: 8500, area: 200, sphere: 250 },
};

export function criarVegetacao(scene) {
    if (_instancedGrass) return;

    // 1. Textura Rica (Apenas Relva e Flores)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Relvas
    for(let i=0; i<12; i++) {
        ctx.beginPath();
        const x = 5 + i * 10;
        ctx.moveTo(x, 128);
        ctx.quadraticCurveTo(x + (i-6)*2, 64, x + (i-6)*6 + (Math.random()-0.5)*20, 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgb(60, ${130 + Math.random() * 70}, 30)`;
        ctx.stroke();
    }
    
    // 4 tipos de flores
    const drawFlower = (cx, cy, c1, c2) => {
        ctx.fillStyle = c1;
        for(let i=0; i<6; i++) {
            const a = (i/6)*Math.PI*2;
            ctx.beginPath(); ctx.arc(cx+Math.cos(a)*8, cy+Math.sin(a)*8, 7, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2); ctx.fill();
    };
    drawFlower(145, 40, '#ffffff', '#ffcc00'); 
    drawFlower(210, 40, '#ffcc00', '#aa6600');
    drawFlower(145, 95, '#ff88cc', '#ff0066');
    drawFlower(210, 95, '#88ccff', '#0044aa');
    
    const vegTex = new THREE.CanvasTexture(canvas);
    vegTex.colorSpace = THREE.SRGBColorSpace;

    // 2. Geometria
    const planeGeo = new THREE.PlaneGeometry(0.85, 1.0); 
    planeGeo.translate(0, 0.5, 0);
    const planeGeo2 = planeGeo.clone();
    planeGeo2.rotateY(Math.PI / 2);
    const crossGeo = BufferGeometryUtils.mergeGeometries([planeGeo, planeGeo2]);
    
    const grassGeo = crossGeo.clone();
    const flowerGeo = crossGeo.clone();

    // 3. Material Lambert (não-PBR) — escolhido porque a relva sofre de
    // overdraw massivo (20-30 camadas no campo aberto). O MeshLambertMaterial
    // tem fragment shader ~4-6× mais barato que o Standard e visualmente
    // imperceptível para folhagem com alphaTest.
    const mat = new THREE.MeshLambertMaterial({
        map: vegTex,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        transparent: false,
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uBattleZones = _battleZonesUniforms;
        shader.uniforms.uPurificationTimes = _purificationTimes;
        
        shader.vertexShader = `
            uniform float uTime;
            uniform vec4 uBattleZones[10];
            uniform float uPurificationTimes[10];
            float _hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            ${shader.vertexShader}
        `.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            vec4 worldPos = instanceMatrix * vec4(position, 1.0);
            float scaleFactor = 1.0;
            float hide = 0.0;
            for(int i=0; i<10; i++) {
                float dx = worldPos.x - uBattleZones[i].x;
                float dz = worldPos.z - uBattleZones[i].y;
                float d2 = dx*dx + dz*dz;
                float r = uBattleZones[i].z;
                float noise = (_hash(worldPos.xz * 0.5) - 0.5) * 4.0;
                float effectiveR2 = (r + noise) * (r + noise) * 1.3;

                if(d2 < effectiveR2) {
                    if(uBattleZones[i].w > 0.5) hide = 1.0;
                    else if(uPurificationTimes[i] > 0.0) {
                        float distDelay = sqrt(d2) * 0.12;
                        float dt = uTime - (uPurificationTimes[i] + distDelay);
                        scaleFactor = smoothstep(0.0, 3.0, dt);
                        scaleFactor += sin(dt * 5.0) * exp(-dt * 2.0) * 0.1;
                    }
                    break;
                }
            }
            if(hide > 0.5) transformed *= 0.0;
            else {
                transformed *= clamp(scaleFactor, 0.0, 1.5);
                float sway = sin(uTime * 1.6 + worldPos.x * 0.4 + worldPos.z * 0.4) * position.y * 0.14;
                transformed.x += sway;
                transformed.z += sway * 0.22;
            }
            `
        );
        mat.userData.shader = shader;
    };

    const preset = VEG_PRESETS[settings.quality] || VEG_PRESETS.media;
    const grassCount = preset.grass;
    _instancedGrass = new THREE.InstancedMesh(grassGeo, mat, grassCount);
    // Sombras na relva são extremamente caras: cada um dos N pixels overdrawn
    // faz um shadow map lookup. Mesmo em alta deixamos desligado — visualmente
    // mal se nota porque as próprias blades já desenham silhuetas no chão.
    _instancedGrass.receiveShadow = false;

    const flowerCount = preset.flowers;
    _instancedFlowers = new THREE.InstancedMesh(flowerGeo, mat, flowerCount);

    // UVs
    const uvAttr = grassGeo.attributes.uv;
    for(let i=0; i<uvAttr.count; i++) uvAttr.setX(i, uvAttr.getX(i) * 0.5);
    
    const uvAttrF = flowerGeo.attributes.uv;
    for(let i=0; i<uvAttrF.count; i++) {
        uvAttrF.setX(i, uvAttrF.getX(i) * 0.5 + 0.5);
    }

    const PATH_W = 4.2; 
    const RIO_BANDA = 5.2; 
    const VILLAGE = { minX: -42, maxX: -18, minZ: 20, maxZ: 38 };

    // Estruturas onde não deve haver vegetação (ex.: interior de edifícios)
    const ESTRUTURAS = [
        { x: -25, z: 25, r: 6.5 },      // Loja do Mercador (reduzido de 9 para 6.5)
        { x: -44.9, z: 33.5, r: 12 }, // Gobble Inn (Taverna)
        { x: 0, z: -80, r: 16 },      // Castelo
        { x: -18, z: -42.5, r: 8.5 }, // Potion Shop (Bruxa) — margem extra para colisão
        { x: 0, z: 4.5, r: 4 },       // Guardião da Ponte
    ];

    function naFaixaCaminho(x, z) {
        if (Math.abs(x) < PATH_W) return true;
        if (z > 21 && z < 29 && x > -34 && x < 4) return true;
        if (z > -39 && z < -31 && x > -57 && x < 4) return true;
        if (z > -59 && z < -51 && x > -4 && x < 57) return true;
        if (z < -31 && z > -83 && Math.abs(x + 45) < PATH_W) return true;
        if (z < -50 && z > -89 && Math.abs(x - 45) < PATH_W) return true;
        return false;
    }

    function naEstrutura(x, z) {
        for (const e of ESTRUTURAS) {
            const dx = x - e.x, dz = z - e.z;
            if (dx*dx + dz*dz < e.r * e.r) return true;
        }
        // Excluir também o centro da vila para manter limpo
        if (x > VILLAGE.minX && x < VILLAGE.maxX && z > VILLAGE.minZ && z < VILLAGE.maxZ) return true;
        return false;
    }

    const dummy = new THREE.Object3D();
    
    // Povoar Relva
    for(let i=0; i<grassCount; i++) {
        const x = (Math.random()-0.5)*preset.area, z = (Math.random()-0.5)*preset.area;
        if (Math.abs(z) < RIO_BANDA + (Math.random()-0.5)*2.0 || naFaixaCaminho(x, z) || naEstrutura(x, z)) { i--; continue; }
        dummy.position.set(x, 0, z);
        dummy.rotation.y = Math.random()*Math.PI;
        dummy.scale.setScalar(0.4 + Math.random()*1.0);
        dummy.updateMatrix();
        _instancedGrass.setMatrixAt(i, dummy.matrix);
        _instancedGrass.setColorAt(i, new THREE.Color(0.85+Math.random()*0.15, 0.85+Math.random()*0.15, 0.85+Math.random()*0.15));
    }

    // Flores
    for(let i=0; i<flowerCount; i++) {
        const x = (Math.random()-0.5)*preset.area, z = (Math.random()-0.5)*preset.area;
        if (Math.abs(z) < RIO_BANDA + 1.0 || naFaixaCaminho(x, z) || naEstrutura(x, z)) { i--; continue; }
        dummy.position.set(x, 0, z);
        dummy.rotation.y = Math.random()*Math.PI;
        dummy.scale.setScalar(0.4 + Math.random()*0.6);
        dummy.updateMatrix();
        _instancedFlowers.setMatrixAt(i, dummy.matrix);
        _instancedFlowers.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.6, 0.7));
    }

    // Bounding sphere ajustada à área de povoamento para que o frustum culling
    // esconda a relva quando o jogador não a vê, sem flicker nas bordas.
    const bigSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), preset.sphere);
    _instancedGrass.geometry.boundingSphere = bigSphere;
    _instancedFlowers.geometry.boundingSphere = bigSphere;

    scene.add(_instancedGrass);
    scene.add(_instancedFlowers);
}

export function setVegetacaoZonas(zonasBoxes) {
    for (let i = 0; i < zonasBoxes.length && i < 10; i++) {
        const box = zonasBoxes[i];
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const r = Math.max(size.x, size.z) / 2;
        _battleZonesUniforms.value[i * 4 + 0] = center.x;
        _battleZonesUniforms.value[i * 4 + 1] = center.z;
        _battleZonesUniforms.value[i * 4 + 2] = r;
        _battleZonesUniforms.value[i * 4 + 3] = 1.0;
        _purificationTimes.value[i] = 0.0;
    }
}

export function atualizarVegetacaoZonas(activeZonesBoxes) {
    const currentTime = performance.now() * 0.001;
    for (let i = 0; i < 10; i++) {
        const x = _battleZonesUniforms.value[i * 4 + 0];
        const z = _battleZonesUniforms.value[i * 4 + 1];
        if (x === 0 && z === 0) continue;
        const pos = new THREE.Vector3(x, 0, z);
        let aindaAtiva = false;
        for (const box of activeZonesBoxes) {
            if (box.getCenter(new THREE.Vector3()).distanceTo(pos) < 1.0) {
                aindaAtiva = true;
                break;
            }
        }
        if (_battleZonesUniforms.value[i * 4 + 3] > 0.5 && !aindaAtiva) _purificationTimes.value[i] = currentTime;
        else if (aindaAtiva) _purificationTimes.value[i] = 0.0;
        _battleZonesUniforms.value[i * 4 + 3] = aindaAtiva ? 1.0 : 0.0;
    }
}

export function updateVegetacao(dt) {
    const currentTime = performance.now() * 0.001;
    if (_instancedGrass && _instancedGrass.material.userData.shader) {
        _instancedGrass.material.userData.shader.uniforms.uTime.value = currentTime;
    }
}
