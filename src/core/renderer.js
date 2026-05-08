import * as THREE from 'three';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

export const mainCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
export const lojaCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
export const caseloCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);

// câmara da loja — posição estática
lojaCamera.position.set(0, 9, 10);
lojaCamera.lookAt(0, 1, -2);

// câmara do castelo — posição estática
caseloCamera.position.set(0, 7, 14);
caseloCamera.lookAt(0, 2, -6);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    mainCamera.aspect  = window.innerWidth / window.innerHeight;
    lojaCamera.aspect  = window.innerWidth / window.innerHeight;
    caseloCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
    lojaCamera.updateProjectionMatrix();
    caseloCamera.updateProjectionMatrix();
});
