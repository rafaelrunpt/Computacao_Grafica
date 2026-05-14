import * as THREE from 'three';
import {
    ITENS_PERDIDOS, isAtiva, isEntregue, jaColetado, onFetchQuestChange,
} from '../systems/merchant-fetch-quest.js';

const _instances = []; // { id, mesh, baseY, time, interactBox }

function criarMesh(item) {
    const grupo = new THREE.Group();

    // núcleo brilhante
    const matCore = new THREE.MeshStandardMaterial({
        color: item.cor, emissive: item.cor,
        emissiveIntensity: 1.8, roughness: 0.25, metalness: 0.6,
    });
    const nucleo = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), matCore);
    grupo.add(nucleo);

    // halo translúcido
    const matHalo = new THREE.MeshBasicMaterial({
        color: item.cor, transparent: true, opacity: 0.22, depthWrite: false,
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), matHalo);
    grupo.add(halo);

    // pequena base no chão
    const matBase = new THREE.MeshStandardMaterial({
        color: item.cor, emissive: item.cor, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.6,
    });
    const base = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), matBase);
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.4;
    grupo.add(base);

    grupo.userData.nucleo = nucleo;
    grupo.userData.halo   = halo;
    return grupo;
}

export function criarLostItems(scene) {
    for (const item of ITENS_PERDIDOS) {
        const mesh = criarMesh(item);
        const baseY = 0.9;
        mesh.position.set(item.pos.x, baseY, item.pos.z);
        mesh.visible = false;
        scene.add(mesh);

        const interactBox = new THREE.Box3(
            new THREE.Vector3(item.pos.x - 1.2, 0,   item.pos.z - 1.2),
            new THREE.Vector3(item.pos.x + 1.2, 2.2, item.pos.z + 1.2),
        );

        _instances.push({ id: item.id, item, mesh, baseY, time: Math.random() * 6, interactBox });
    }
    atualizarVisibilidade();
    onFetchQuestChange(atualizarVisibilidade);
}

function atualizarVisibilidade() {
    const visivelGeral = isAtiva() && !isEntregue();
    for (const inst of _instances) {
        inst.mesh.visible = visivelGeral && !jaColetado(inst.id);
    }
}

export function updateLostItems(dt) {
    for (const inst of _instances) {
        if (!inst.mesh.visible) continue;
        inst.time += dt;
        inst.mesh.position.y = inst.baseY + Math.sin(inst.time * 2.0) * 0.18;
        inst.mesh.rotation.y += dt * 1.4;
        if (inst.mesh.userData.halo) {
            const s = 1.0 + Math.sin(inst.time * 2.6) * 0.08;
            inst.mesh.userData.halo.scale.setScalar(s);
        }
        if (inst.mesh.userData.nucleo) {
            inst.mesh.userData.nucleo.material.emissiveIntensity =
                1.5 + Math.sin(inst.time * 3.2) * 0.5;
        }
    }
}

export function getLostItemAt(pb) {
    for (const inst of _instances) {
        if (!inst.mesh.visible) continue;
        if (pb.intersectsBox(inst.interactBox)) return inst;
    }
    return null;
}
