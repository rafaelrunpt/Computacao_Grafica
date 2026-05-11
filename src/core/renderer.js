import * as THREE from 'three';
import { settings, onSettingChange } from '../systems/settings.js';

export const renderer = new THREE.WebGLRenderer({ antialias: settings.quality !== 'baixa' });
renderer.setSize(window.innerWidth, window.innerHeight);
// cap do pixelRatio: em ecrãs HiDPI poupa MUITO sem diferença visual notória
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = settings.quality !== 'baixa';
renderer.shadowMap.type = settings.quality === 'alta' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

export const mainCamera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
export const lojaCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
export const caseloCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
export const combateCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 60);

// câmara da loja — posição estática
lojaCamera.position.set(0, 9, 10);
lojaCamera.lookAt(0, 1, -2);

// câmara do castelo — posição estática
caseloCamera.position.set(0, 7, 14);
caseloCamera.lookAt(0, 2, -6);

// câmara do combate — estática, lateral, enquadra player (esq.) e inimigo (dir.)
combateCamera.position.set(0.2, 3.4, 8.2);
combateCamera.lookAt(0.2, 1.0, 0);

// reagir a mudanças de FOV e qualidade em tempo real
onSettingChange('fov', (v) => {
    mainCamera.fov = v;
    mainCamera.updateProjectionMatrix();
});
onSettingChange('quality', (v) => {
    renderer.shadowMap.enabled = v !== 'baixa';
    renderer.shadowMap.type = v === 'alta' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.needsUpdate = true;
});

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    mainCamera.aspect    = window.innerWidth / window.innerHeight;
    lojaCamera.aspect    = window.innerWidth / window.innerHeight;
    caseloCamera.aspect  = window.innerWidth / window.innerHeight;
    combateCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
    lojaCamera.updateProjectionMatrix();
    caseloCamera.updateProjectionMatrix();
    combateCamera.updateProjectionMatrix();
});
