// ======================================================================
// ESTALAJADEIRO (goblin_animations) — NPC atrás do balcão da taverna.
// ======================================================================
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _loader = new GLTFLoader();
let _model = null;

export function getEstalajadeiroModel() { return _model; }

export function criarEstalajadeiro(scene, pos) {
    _loader.load('assets/models/npcs/goblin_animations.glb', (gltf) => {
        _model = gltf.scene;
        _model.scale.setScalar(0.02);
        _model.position.copy(pos);
        _model.position.y = 0;
        _model.rotation.y = -Math.PI / 2;
        _model.traverse(c => {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });
        scene.add(_model);
    }, undefined, e => console.error('Erro estalajadeiro GLB:', e));
}

export function updateEstalajadeiro(dt) {
    if (!_model) return;
    const t = performance.now() * 0.002;
    _model.position.y = Math.sin(t) * 0.02;
}
