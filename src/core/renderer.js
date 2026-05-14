import * as THREE from 'three';
import { settings, onSettingChange } from '../systems/settings.js';

export const renderer = new THREE.WebGLRenderer({ antialias: settings.quality !== 'baixa' });
renderer.setSize(window.innerWidth, window.innerHeight);
// Cap agressivo: HiDPI dá pouquíssima diferença visual mas custa 2-4× mais pixels.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
renderer.shadowMap.enabled = true;
// PCFSoftShadowMap: kernel 3×3 suaviza os edges — elimina shimmer em sombras grandes.
// A 1024² é 4× mais barato que PCFSoft a 2048² (original), mesmo com o filtro maior.
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

// ---- configurações de cor para GLB ----
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Removemos o toneMapping que estava a escurecer o jogo todo
renderer.toneMapping = THREE.NoToneMapping; 

document.body.appendChild(renderer.domElement);

export const mainCamera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
export const lojaCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
export const caseloCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
export const tavernCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
export const combateCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 60);

// câmara da loja — posição estática
lojaCamera.position.set(0, 9, 10);
lojaCamera.lookAt(0, 1, -2);

// câmara do castelo — posição estática
caseloCamera.position.set(0, 7, 14);
caseloCamera.lookAt(0, 2, -6);

// câmara da taverna — posição estática (capturada via free cam)
tavernCamera.position.set(-18.66, 10.74, 10.00);
tavernCamera.lookAt(-6.84, 3.91, 0.70);

// câmara do combate — estática, lateral, enquadra player (esq.) e inimigo (dir.)
combateCamera.position.set(0.2, 3.4, 8.2);
combateCamera.lookAt(0.2, 1.0, 0);

// reagir a mudanças de FOV e qualidade em tempo real
onSettingChange('fov', (v) => {
    mainCamera.fov = v;
    mainCamera.updateProjectionMatrix();
});
onSettingChange('quality', (_v) => {
    renderer.shadowMap.needsUpdate = true;
});

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    mainCamera.aspect    = window.innerWidth / window.innerHeight;
    lojaCamera.aspect    = window.innerWidth / window.innerHeight;
    caseloCamera.aspect  = window.innerWidth / window.innerHeight;
    tavernCamera.aspect  = window.innerWidth / window.innerHeight;
    combateCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
    lojaCamera.updateProjectionMatrix();
    caseloCamera.updateProjectionMatrix();
    tavernCamera.updateProjectionMatrix();
    combateCamera.updateProjectionMatrix();
});
