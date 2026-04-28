import * as THREE from 'three';
import { criarMapa, verificaColisao } from './mapa.js';
import { player } from './jogador.js';
import { verificarEncontro, estadoJogo } from './combate.js';
import { renderizarMinimapa } from './minimapa.js';
import { carregarAssets } from './assets.js'; // Novo módulo de assets

// --------------------------------------------------------
// 1. CONFIGURAÇÃO BASE (O Palco)
// --------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Desativamos a limpeza automática para gerir múltiplas câmaras (jogo + minimapa)
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

const mainCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    mainCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
});

// --------------------------------------------------------
// 2. ILUMINAÇÃO (Sol que segue o jogador)
// --------------------------------------------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.bias = -0.001;
sunLight.shadow.normalBias = 0.05;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -15;
scene.add(sunLight);
scene.add(sunLight.target);

// --------------------------------------------------------
// 3. INPUTS E ESTADO DO JOGO
// --------------------------------------------------------
const keys = { w: false, a: false, s: false, d: false };
let mapaAberto = false; 
const moveSpeed = 0.15;
const rotationSpeed = 0.2; // Suavidade da rotação do boneco

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    
    // Abrir/Fechar mapa grande com a tecla M
    if (key === 'm' && !estadoJogo.emCombate) {
        mapaAberto = !mapaAberto;
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// --------------------------------------------------------
// 4. LOOP DE ANIMAÇÃO
// --------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    // --- LÓGICA DE MOVIMENTO (ESTILO POKÉMON) ---
    if (!estadoJogo.emCombate && !mapaAberto) {
        let dirX = 0;
        let dirZ = 0;

        if (keys.w) dirZ -= 1; // Norte
        if (keys.s) dirZ += 1; // Sul
        if (keys.a) dirX -= 1; // Oeste
        if (keys.d) dirX += 1; // Este

        if (dirX !== 0 || dirZ !== 0) {
            // 1. Rotação Suave para a direção do movimento
            const targetAngle = Math.atan2(dirX, dirZ);
            let angleDiff = targetAngle - player.rotation.y;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            player.rotation.y += angleDiff * rotationSpeed;

            // 2. Cálculo do Movimento Normalizado
            const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
            const moveX = (dirX / length) * moveSpeed;
            const moveZ = (dirZ / length) * moveSpeed;

            // 3. Colisões e Aplicação de Posição
            if (!verificaColisao(player.position.x + moveX, player.position.z)) {
                player.position.x += moveX;
            }
            if (!verificaColisao(player.position.x, player.position.z + moveZ)) {
                player.position.z += moveZ;
            }

            // 4. Verificar encontros na relva
            verificarEncontro(player.position.x, player.position.z);
        }
    }

    // --- ATUALIZAÇÃO DA CÂMARA (ESTILO POKÉMON X/Y) ---
    // Offset fixo diagonal (Atrás e acima do jogador)
    const cameraOffset = new THREE.Vector3(0, 10, 8);
    const targetCameraPos = player.position.clone().add(cameraOffset);
    
    // Seguimento fluido
    mainCamera.position.lerp(targetCameraPos, 0.1);
    mainCamera.lookAt(player.position);

    // --- ATUALIZAÇÃO DO SOL ---
    sunLight.position.set(player.position.x + 10, 20, player.position.z + 10);
    sunLight.target.position.copy(player.position);

    // --- RENDERIZAÇÃO ---
    // Limpar o frame anterior (obrigatório desligar a tesoura antes)
    renderer.setScissorTest(false); 
    renderer.clear();

    if (mapaAberto) {
        // Renderizar apenas o mapa grande no centro
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, true);
    } else {
        // 1. Ecrã Principal do Jogo
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.render(scene, mainCamera);

        // 2. Minimapa Quadrado no canto inferior esquerdo
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, false);
    }
}

// --------------------------------------------------------
// 5. INICIALIZAÇÃO (Esperar pelos Assets)
// --------------------------------------------------------
carregarAssets().then(() => {
    console.log("Assets 3D carregados com sucesso.");
    
    // Gerar o mapa (agora com acesso aos modelos 3D clonados)
    criarMapa(scene);
    
    // Adicionar o jogador (Corpo + Cabeça) à cena
    scene.add(player);
    
    // Começar o jogo
    animate();
}).catch(err => {
    console.error("Erro crítico ao carregar os assets do jogo:", err);
});