import * as THREE from 'three';
import { settings } from '../systems/settings.js';
import { registerLight } from '../systems/moderator.js';

// =========================================================
// AMBIENT LIGHT
// =========================================================
export const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);

// =========================================================
// DIRECTIONAL LIGHT — Sol (segue o player no loop do mundo)
// =========================================================
const _SHADOW_SIZE = { baixa: 512, media: 1024, alta: 2048 };
const _shadowSize  = _SHADOW_SIZE[settings.quality] ?? 1024;

export const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(_shadowSize, _shadowSize);
sunLight.shadow.bias       = -0.0001;
sunLight.shadow.normalBias =  0.08;

// Frustum apertado à volta do player (animateMundo actualiza-o).
// Expande-se a ±105 quando o minimapa está aberto (ver main.js).
sunLight.shadow.camera.near   =   1;
sunLight.shadow.camera.far    = 320;
sunLight.shadow.camera.left   = -32;
sunLight.shadow.camera.right  =  32;
sunLight.shadow.camera.top    =  32;
sunLight.shadow.camera.bottom = -32;

// Offset do sol em relação ao player — mantém a mesma direcção de sombra
// de (80,120,80) → origem que existia quando o sol era fixo.
export const sunOffset = new THREE.Vector3(80, 120, 80);
sunLight.position.copy(sunOffset);
sunLight.target.position.set(0, 0, 0);
sunLight.shadow.camera.layers.enable(1);

// =========================================================
// SPOTLIGHT — Holofote do herói (cutscene / interiores)
// Só visível fora do mundo exterior; a tocha do herói
// =========================================================
export const playerSpot = new THREE.SpotLight(0xfff500, 280, 22, 0.32, 1.0, 2.0);
playerSpot.castShadow = true;
playerSpot.shadow.mapSize.set(1024, 1024);
playerSpot.shadow.bias       = -0.0001;
playerSpot.shadow.normalBias =  0.05;
playerSpot.shadow.camera.near = 5;
playerSpot.shadow.camera.far  = 25;
playerSpot.shadow.camera.fov  = 40;
playerSpot.shadow.camera.layers.enable(1);

// =========================================================
// SETUP — adiciona à cena e regista no debug do moderador
// =========================================================
export function setupLuzesMundo(scene) {
    scene.add(ambientLight);
    scene.add(sunLight, sunLight.target);
    scene.add(playerSpot, playerSpot.target);

    registerLight('Mundo',   'Luz Ambiente Global',      ambientLight);
    registerLight('Mundo',   'Luz Solar (Directional)',  sunLight);
    registerLight('Jogador', 'Foco de Cutscene',         playerSpot);
}


// UPDATE — posiciona o spotlight sobre o player

export function updatePlayerSpot(player, cena) {
    const necessaria = cena !== 'mundo';
    playerSpot.visible = necessaria;
    if (necessaria) {
        playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
        playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);
    }
}
