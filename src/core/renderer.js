import * as THREE from 'three';
import { settings, onSettingChange } from '../systems/settings.js';

export const renderer = new THREE.WebGLRenderer({ 
    antialias: settings.quality !== 'baixa',
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
// Cap agressivo + escala configurável: HiDPI dá pouquíssima diferença visual
// mas custa 2-4× mais pixels. O renderScale (0.5-1.0) permite ao jogador
// baixar ainda mais a resolução em GPUs fracas.
function _applyPixelRatio() {
    const scale = settings.renderScale ?? 1.0;
    // Cap de 1.5 para média/baixa e 2.0 para alta. 
    // Ecrãs Retina chegam a 3.0-4.0, o que mata a performance sem ganho visual real.
    const maxPR = settings.quality === 'alta' ? 2.0 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPR * scale));
}
_applyPixelRatio();
onSettingChange('renderScale', _applyPixelRatio);
renderer.shadowMap.enabled = settings.quality !== 'baixa';
// PCFSoftShadowMap: kernel 3×3 suaviza os edges — elimina shimmer em sombras grandes.
// A 1024² é 4× mais barato que PCFSoft a 2048² (original), mesmo com o filtro maior.
// Em qualidade baixa usamos o filtro mais simples (PCF) para poupar GPU.
renderer.shadowMap.type = settings.quality === 'alta'
    ? THREE.PCFSoftShadowMap
    : THREE.PCFShadowMap;

// LOG DE DIAGNÓSTICO: Verificar qual GPU está a ser usada
const gl = renderer.getContext();
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
if (debugInfo) {
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer_name = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    console.log(`[GPU] Vendor: ${vendor}, Renderer: ${renderer_name}`);
}

// Sol não se move e o castelo/árvores são estáticos — desligamos a
// reactualização contínua da shadow map. Os sistemas que mexem em luzes
// ou cenas marcam needsUpdate = true por sua conta (ver transições e o
// toggle dia/noite no night-mode.js).
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true; // bake inicial
renderer.autoClear = false;
renderer.localClippingEnabled = true;
renderer.clippingPlanes = [ new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.3) ];

// ---- configurações de cor para GLB ----
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Removemos o toneMapping que estava a escurecer o jogo todo
renderer.toneMapping = THREE.NoToneMapping; 

document.body.appendChild(renderer.domElement);

export const mainCamera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);

// ----------------------------------------------------------------------
// CÂMARA ORTOGRÁFICA DO MUNDO (Req. 2 — alternância perspetiva/ortográfica)
// Espelha a posição/orientação da mainCamera; só muda a projeção.
// Tecla C alterna. Custo nulo quando inactiva (só se sincroniza quando ON).
// ----------------------------------------------------------------------
export const worldOrthoCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 2000);

// Modo de câmara: 0 = perspetiva | 1 = ortográfica de topo (C) |
//                 2 = ortográfica em ângulo (Z, estilo perspetiva)
let _camMode = 0;
export function isOrthoMode() { return _camMode !== 0; }
export function getCameraMode() { return _camMode; }
// Alterna o modo `mode` (1 ou 2): se já está activo desliga, senão activa-o.
export function setCameraMode(mode) {
    _camMode = (_camMode === mode) ? 0 : mode;
    _aplicarFrustumOrtho();
    return _camMode;
}

// Vista de topo (C): ângulo picado, enquadramento mais apertado.
const _orthoTopo = { offset: new THREE.Vector3(0, 48, 22), view: 13 };
// Vista em ângulo (Z): mesmo ângulo da perspetiva (~25°) mas câmara muito
// mais alta/recuada — em ortográfico a distância não muda a escala, por
// isso o chão preenche o ecrã todo sem faixa de céu nem corte do clipping.
const _orthoAngulo = { offset: new THREE.Vector3(0, 20, 36), view: 17 };

function _cfgAtual() { return _camMode === 1 ? _orthoTopo : _orthoAngulo; }

function _aplicarFrustumOrtho() {
    if (_camMode === 0) return;
    const aspect = window.innerWidth / window.innerHeight;
    const v = _cfgAtual().view;
    worldOrthoCamera.left   = -v * aspect;
    worldOrthoCamera.right  =  v * aspect;
    worldOrthoCamera.top    =  v;
    worldOrthoCamera.bottom = -v;
    worldOrthoCamera.updateProjectionMatrix();
}

// Devolve a câmara activa do mundo. Em ortho, posiciona-a sobre o `target`
// (jogador) com o offset do modo escolhido, de modo a que o chão preencha
// todo o ecrã.
export function getActiveWorldCamera(target = null) {
    if (_camMode === 0) return mainCamera;
    if (target) {
        const off = _cfgAtual().offset;
        worldOrthoCamera.position.set(target.x + off.x, off.y, target.z + off.z);
        worldOrthoCamera.lookAt(target.x, 0, target.z);
    }
    return worldOrthoCamera;
}

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
caseloCamera.position.set(0, 3.69, 15);
caseloCamera.lookAt(0, 4, 0);

// câmara da taverna — posição estática (capturada via free cam)
tavernCamera.position.set(-18.66, 10.74, 10.00);
tavernCamera.lookAt(-6.84, 3.91, 0.70);

// câmara do quarto — virada de frente para a cama (cama em x≈1.4, z≈-1.5)
quartoCamera.position.set(1.4, 3.2, 4.2);
quartoCamera.lookAt(1.4, 0.8, -1.5);

// câmara do combate — estática, em ângulo 3/4 a partir da esquerda para
// se ver a CARA do inimigo (estilo Pokémon); player à esq., inimigo à dir.
combateCamera.position.set(-5.6, 3.4, 10.2);
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
    _aplicarFrustumOrtho();
});
