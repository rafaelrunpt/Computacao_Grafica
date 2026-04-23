import * as THREE from 'three';
import { criarMapa, verificaColisao } from './mapa.js';
import { player } from './jogador.js';
import { verificarEncontro, estadoJogo } from './combate.js';
import { renderizarMinimapa } from './minimapa.js';

// --------------------------------------------------------
// 1. CONFIGURAÇÃO BASE (O Palco)
// --------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const mainCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    mainCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
});

// --------------------------------------------------------
// 2. CONSTRUIR O MUNDO E ILUMINAÇÃO
// --------------------------------------------------------
criarMapa(scene); // O Maestro chama o construtor do mapa
scene.add(player); // O Maestro coloca o jogador no palco

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(15, 30, 15);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
sunLight.shadow.camera.left = -20;
sunLight.shadow.camera.right = 20;
sunLight.shadow.camera.top = 20;
sunLight.shadow.camera.bottom = -20;
scene.add(sunLight);

// --------------------------------------------------------
// 3. INPUTS DO TECLADO
// --------------------------------------------------------
const keys = { w: false, a: false, s: false, d: false };
const moveSpeed = 0.15;

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
});

// --------------------------------------------------------
// 4. O LOOP PRINCIPAL (Onde a magia acontece a 60 FPS)
// --------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    // --- LÓGICA DE MOVIMENTO E ROTAÇÃO ---
    if (!estadoJogo.emCombate) {
        let dirX = 0;
        let dirZ = 0;

        // Descobrir a direção do vetor (1, -1 ou 0)
        if (keys.w) dirZ -= 1;
        if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1;
        if (keys.d) dirX += 1;

        // Se o jogador estiver a tentar mover-se
        if (dirX !== 0 || dirZ !== 0) {
            
            // 1. ROTAÇÃO: Faz a cabeça/corpo rodar para a direção do movimento
            // Math.atan2 calcula o ângulo em radianos baseado nos eixos X e Z
            const angulo = Math.atan2(dirX, dirZ);
            player.rotation.y = angulo;

            // 2. Normalizar a velocidade (para não andar mais rápido nas diagonais)
            const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
            const moveX = (dirX / length) * moveSpeed;
            const moveZ = (dirZ / length) * moveSpeed;

            let proximoX = player.position.x + moveX;
            let proximoZ = player.position.z + moveZ;

            // 3. Aplicar movimento com deslize nas paredes
            if (!verificaColisao(proximoX, player.position.z)) {
                player.position.x = proximoX;
            }
            if (!verificaColisao(player.position.x, proximoZ)) {
                player.position.z = proximoZ;
            }

            // 4. Avisar o sistema de combate que demos um passo
            verificarEncontro(player.position.x, player.position.z);
        }
    }

    // --- ATUALIZAR CÂMARA PRINCIPAL ---
    // Mantém-se sempre atrás e acima do jogador
    mainCamera.position.set(player.position.x, player.position.y + 6, player.position.z + 8);
    mainCamera.lookAt(player.position);

    // --- DESENHAR OS DOIS ECRÃS ---
    // 1. Desenhar o mundo normal em ecrã inteiro
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(scene, mainCamera);

    // 2. Desenhar o Minimapa no canto (Chamando a função do minimapa.js)
    renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight);
}

// Iniciar o jogo
animate();