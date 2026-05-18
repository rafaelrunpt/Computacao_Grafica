// ======================================================================
// MERCADOR (merchant.glb) — NPC do interior da loja.
// ======================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _loader = new GLTFLoader();
let _model = null;
let _basePos = null;
let _interactBox = null;

export function getMercadorModel() { return _model; }
export function getMercadorInteractBox() { return _interactBox; }

/**
 * Carrega o mercador e define a sua interact-box.
 *   scene  — THREE.Scene da loja
 *   pos    — Vector3 da posição fixa
 */
export function criarMercador(scene, pos) {
    _basePos = pos.clone();
    _loader.load('assets/models/npcs/merchant.glb', (gltf) => {
        _model = gltf.scene;
        // X/Z um pouco maiores que Y para dar volume sem aumentar a altura
        _model.scale.set(0.055, 0.035, 0.055);
        _model.position.copy(_basePos);
        _model.rotation.y = 0;
        _model.traverse(c => {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });
        scene.add(_model);

        _interactBox = new THREE.Box3(
            new THREE.Vector3(_basePos.x - 2.0, _basePos.y - 0.5, _basePos.z - 2.2),
            new THREE.Vector3(_basePos.x + 2.0, _basePos.y + 2.2, _basePos.z + 2.2),
        );
    }, undefined, e => console.error('Erro merchant GLB:', e));
}

export function updateMercador(_dt, playerPos) {
    if (!_model || !_basePos) return;
    _model.position.y = _basePos.y + Math.sin(performance.now() * 0.002) * 0.02;
    if (playerPos) {
        const dx = playerPos.x - _basePos.x;
        const dz = playerPos.z - _basePos.z;
        if (dx * dx + dz * dz < 9) {
            const target = Math.atan2(dx, dz);
            let diff = target - _model.rotation.y;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            _model.rotation.y += diff * 0.08;
        }
    }
}
