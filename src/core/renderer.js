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
export const quartoCamera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 60);
export const combateCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 60);
// boss fight — câmara cinematográfica de frente para o boss com o
// player visível em primeiro plano (over-shoulder ligeiro).
export const combateBossCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);

// câmara da loja — posição estática
lojaCamera.position.set(0, 9, 10);
lojaCamera.lookAt(0, 1, -2);

// câmara do castelo — posição estática
caseloCamera.position.set(0, 7, 14);
caseloCamera.lookAt(0, 2, -6);

// câmara da taverna — posição estática (capturada via free cam)
tavernCamera.position.set(-18.66, 10.74, 10.00);
tavernCamera.lookAt(-6.84, 3.91, 0.70);

// câmara do quarto — virada de frente para a cama (cama em x≈1.4, z≈-1.5)
quartoCamera.position.set(1.4, 3.2, 4.2);
quartoCamera.lookAt(1.4, 0.8, -1.5);

// câmara do combate — estática, lateral, enquadra player (esq.) e inimigo (dir.)
combateCamera.position.set(0.2, 3.4, 8.2);
combateCamera.lookAt(0.2, 1.0, 0);

// câmara do boss — boss em (0,0,-3.5), player em (0,0,2.0).
// Centrada (x=0) e com pouca inclinação vertical (~12°) para preservar
// a distinção altura/chão: aéreos vêm de cima, rasantes do chão e
// laterais/varreduras ao nível do peito ficam todos visivelmente
// separados em Y.
combateBossCamera.fov = 62;
combateBossCamera.position.set(0, 4.0, 11.0);
combateBossCamera.lookAt(0, 1.4, -1.5);
combateBossCamera.updateProjectionMatrix();

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
    quartoCamera.aspect  = window.innerWidth / window.innerHeight;
    combateCamera.aspect = window.innerWidth / window.innerHeight;
    combateBossCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
    lojaCamera.updateProjectionMatrix();
    caseloCamera.updateProjectionMatrix();
    tavernCamera.updateProjectionMatrix();
    quartoCamera.updateProjectionMatrix();
    combateCamera.updateProjectionMatrix();
    combateBossCamera.updateProjectionMatrix();
});
