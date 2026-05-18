// ======================================================================
// BARTENDER (goblin_shop) — NPC com fase de intro junto à porta do quarto
// e migração automática para a posição de vendedor após a intro.
// ======================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _loader = new GLTFLoader();

let _model = null;
let _introDone = false;
let _moving = false;
let _doorPos = null;
let _vendorPos = null;

export function getBartenderModel() { return _model; }
export function bartenderIntroFeita() { return _introDone; }

export function marcarBartenderIntroFeita() {
    _introDone = true;
    _moving = true;
}

/**
 * Carrega o bartender e adiciona-o à cena.
 *   scene      — THREE.Scene da taverna
 *   doorPos    — Vector3 da posição inicial (junto à porta)
 *   vendorPos  — Vector3 da posição alvo após a intro
 */
export function criarBartender(scene, doorPos, vendorPos) {
    _doorPos = doorPos.clone();
    _vendorPos = vendorPos.clone();
    _loader.load('assets/models/npcs/goblin_shop.glb', (gltf) => {
        _model = gltf.scene;
        _model.scale.setScalar(0.13);
        _model.position.copy(_doorPos);
        _model.rotation.y = Math.PI;
        _model.traverse(c => {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });
        scene.add(_model);
    }, undefined, e => console.error('Erro bartender GLB:', e));
}

export function updateBartender(dt, playerPos) {
    if (!_model) return;
    const t = performance.now() * 0.002;
    _model.position.y = Math.sin(t + 1.2) * 0.02;

    if (_moving) {
        const dx = _vendorPos.x - _model.position.x;
        const dz = _vendorPos.z - _model.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.05) {
            _model.position.x = _vendorPos.x;
            _model.position.z = _vendorPos.z;
            _moving = false;
        } else {
            const step = Math.min(2.0 * 0.016, dist);
            _model.position.x += (dx / dist) * step;
            _model.position.z += (dz / dist) * step;
            _model.rotation.y = Math.atan2(dx, dz);
        }
    } else if (_introDone && playerPos) {
        const dx = playerPos.x - _model.position.x;
        const dz = playerPos.z - _model.position.z;
        if (dx * dx + dz * dz < 16) {
            const tgt = Math.atan2(dx, dz);
            let diff = tgt - _model.rotation.y;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            _model.rotation.y += diff * 0.08;
        }
    }
}
