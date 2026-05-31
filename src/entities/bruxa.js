import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let _mageGroup = null;
let _mixer = null;
let _t = 0;

export function criarBruxa(scene, pos) {
    _mageGroup = new THREE.Group();
    _mageGroup.position.set(pos.x, pos.y, pos.z);
    scene.add(_mageGroup);

    const loader = new GLTFLoader();
    loader.load('assets/models/npcs/mage.gltf', (gltf) => {
        const model = gltf.scene;
        
        // Ajuste de escala e orientação se necessário
        model.scale.setScalar(0.85); 
        model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        _mageGroup.add(model);

        // Configuração de animações se existirem no GLTF
        if (gltf.animations && gltf.animations.length > 0) {
            _mixer = new THREE.AnimationMixer(model);
            // Tenta tocar a primeira animação (geralmente Idle)
            const action = _mixer.clipAction(gltf.animations[0]);
            action.play();
        }
    }, undefined, (error) => {
        console.error('Erro ao carregar mage.gltf:', error);
    });
}

export function updateBruxa(dt, playerPos) {
    if (!_mageGroup) return;
    _t += dt;

    if (_mixer) _mixer.update(dt);

    // Flutuação leve para manter o ar místico
    _mageGroup.position.y += Math.sin(_t * 2) * 0.001;

    // Olhar para o jogador
    if (playerPos) {
        const dx = playerPos.x - _mageGroup.position.x;
        const dz = playerPos.z - _mageGroup.position.z;
        const distSq = dx * dx + dz * dz;
        
        if (distSq < 25) { 
            const targetAngle = Math.atan2(dx, dz);
            let diff = targetAngle - _mageGroup.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            _mageGroup.rotation.y += diff * 0.1;
        }
    }
}
