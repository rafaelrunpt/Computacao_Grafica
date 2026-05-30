// --------------------------------------------------------
// COGUMELOS BRILHANTES — decoração bioluminescente espalhada
// pelo sul do mapa (zona wraith). Em clusters de 3-7 cogumelos,
// com cores variadas (teal/azul/roxo) que pulsam suavemente.
// Cada cluster tem uma PointLight subtil para reforçar o glow.
// Não tem interacção — puramente atmosfera.
// --------------------------------------------------------

import * as THREE from 'three';

const CLUSTERS = [
    { x:  40, z: -14, n: 5 },
    { x:  36, z: -28, n: 4 },
    { x:  48, z: -38, n: 6 },
    { x: -22, z: -55, n: 4 },
    { x: -34, z: -68, n: 5 },
    { x: -50, z: -28, n: 5 },
    { x: -62, z: -38, n: 6 },
    { x:   8, z: -78, n: 4 },
    { x: -16, z: -78, n: 4 },
    { x:  66, z: -56, n: 5 },
];

const CORES = [0x60ffe0, 0x80c8ff, 0xc080ff, 0xa0ffc0];

const _caps = [];   // { mesh, baseEmissive, fase }
const _lights = []; // { light, fase }

let _rngState = 0;
function _rand() {
    _rngState = (Math.imul(_rngState || 31337, 48271) + 1) | 0;
    return ((_rngState >>> 0) % 100000) / 100000;
}

// Geometrias partilhadas (todos os caps usam o mesmo modelo, varia cor/escala)
const _stemGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.30, 6);
const _capGeo  = new THREE.SphereGeometry(0.18, 10, 8);
const _stemMat = new THREE.MeshStandardMaterial({ color: 0xe0d8c0, roughness: 0.95 });

let _instStem = null;
const _instCapsByColor = new Map(); // cor -> InstancedMesh
const _capData = []; // { meshIndex, colorKey, baseEmissive, fase }

export function criarCogumelos(scene) {
    _rngState = 31337;
    
    // Contagem total para o InstancedMesh
    let totalN = 0;
    for (const cluster of CLUSTERS) totalN += cluster.n;

    // Stem instancing
    _instStem = new THREE.InstancedMesh(_stemGeo, _stemMat, totalN);
    _instStem.castShadow = true;
    scene.add(_instStem);

    // Preparar dados para caps por cor
    const capsByColor = new Map();
    for (const cluster of CLUSTERS) {
        for (let i = 0; i < cluster.n; i++) {
            const cor = CORES[Math.floor(_rand() * CORES.length)];
            if (!capsByColor.has(cor)) capsByColor.set(cor, []);
            capsByColor.get(cor).push({ cluster, i });
        }
    }

    const dummy = new THREE.Object3D();
    let globalIdx = 0;

    for (const [cor, items] of capsByColor) {
        const capMat = new THREE.MeshStandardMaterial({
            color: cor,
            emissive: cor,
            emissiveIntensity: 0.75,
            roughness: 0.55,
        });
        const instCap = new THREE.InstancedMesh(_capGeo, capMat, items.length);
        instCap.castShadow = true;
        scene.add(instCap);
        _instCapsByColor.set(cor, instCap);

        for (let j = 0; j < items.length; j++) {
            const { cluster } = items[j];
            _rngState = 31337 + globalIdx * 7; // determinismo para reconstruir x,z
            const ang = _rand() * Math.PI * 2;
            const r   = _rand() * 1.4;
            const x   = cluster.x + Math.cos(ang) * r;
            const z   = cluster.z + Math.sin(ang) * r;
            const esc = 0.55 + _rand() * 0.85;

            // Matrix para Stem
            dummy.position.set(x, 0.15 * esc, z);
            dummy.rotation.set(0, _rand() * Math.PI * 2, 0);
            dummy.scale.setScalar(esc);
            dummy.updateMatrix();
            _instStem.setMatrixAt(globalIdx, dummy.matrix);

            // Matrix para Cap
            dummy.position.set(x, 0.32 * esc, z);
            dummy.scale.set(esc, esc * 0.55, esc);
            dummy.updateMatrix();
            instCap.setMatrixAt(j, dummy.matrix);

            _capData.push({ 
                instCap, 
                idx: j, 
                baseEmissive: 0.75, 
                fase: _rand() * Math.PI * 2 
            });
            globalIdx++;
        }
    }

    _instStem.instanceMatrix.needsUpdate = true;
    for (const im of _instCapsByColor.values()) im.instanceMatrix.needsUpdate = true;

    // 1 luz por cluster (cor do cogumelo "líder", subtil para não pesar)
    for (const cluster of CLUSTERS) {
        _rngState = 31337 + cluster.x + cluster.z;
        const luzCor = CORES[Math.floor(_rand() * CORES.length)];
        const light = new THREE.PointLight(luzCor, 0.55, 5.5, 2.0);
        light.position.set(cluster.x, 0.45, cluster.z);
        light.castShadow = false;
        scene.add(light);
        _lights.push({ light, fase: _rand() * Math.PI * 2, baseInt: 0.55 });
    }
}

export function updateCogumelos(_dt) {
    const t = performance.now() * 0.001;
    // Infelizmente o InstancedMesh não permite mudar emissiveIntensity por instância 
    // sem shaders customizados, por isso pulsamos o material inteiro (afeta todos daquela cor).
    for (const [cor, im] of _instCapsByColor) {
        im.material.emissiveIntensity = 0.75 * (0.78 + 0.28 * Math.sin(t * 1.3 + cor));
    }
    for (let i = 0; i < _lights.length; i++) {
        const l = _lights[i];
        l.light.intensity = l.baseInt * (0.78 + 0.30 * Math.sin(t * 1.5 + l.fase));
    }
}
