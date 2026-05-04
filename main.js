import * as THREE from 'three';
import { criarMapa, verificaColisao, shopDoorInteract, riverMesh } from './mapa.js';
import { player, updatePlayerAnimation } from './jogador.js';
import { verificarEncontro, estadoJogo } from './combate.js';
import { renderizarMinimapa } from './minimapa.js';

// --------------------------------------------------------
// 1. CONFIGURAÇÃO BASE (O Palco)
// --------------------------------------------------------
const scene = new THREE.Scene();
const clock = new THREE.Clock();
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
// Luz ambiente reduzida para dar profundidade e contraste às ondinhas!
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.bias = -0.001;
sunLight.shadow.normalBias = 0.05;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
scene.add(sunLight);
scene.add(sunLight.target);

// --------------------------------------------------------
// 3. INPUTS E ESTADO DO JOGO
// --------------------------------------------------------
const keys = { w: false, a: false, s: false, d: false, e: false };
let mapaAberto = false; 
const moveSpeed = 0.15;
const rotationSpeed = 0.2; // Suavidade da rotação do boneco

// --------------------------------------------------------
// INTERAÇÃO COM A LOJA
// --------------------------------------------------------
const promptEl = document.createElement('div');
promptEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;padding:8px 18px;border-radius:8px;font-family:sans-serif;font-size:16px;display:none;pointer-events:none;';
document.body.appendChild(promptEl);

function showPrompt(msg) {
    promptEl.textContent = msg;
    promptEl.style.display = 'block';
}
function hidePrompt() {
    promptEl.style.display = 'none';
}
function enterShop() {
    console.log('A entrar na loja...');
    // Aqui vai a lógica de transição para a loja
}

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
// CONFIGURAÇÃO DE CORES DA ÁGUA
// --------------------------------------------------------
const corBase = new THREE.Color(0x004488);   // Azul Escuro (vales das ondas)
const corCrista = new THREE.Color(0x1ca3ec); // Azul Claro (topos das ondas)
const corMistura = new THREE.Color();

// --------------------------------------------------------
// 4. LOOP DE ANIMAÇÃO
// --------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    // Calcular o tempo (deltaTime) no início de cada frame
    const deltaTime = clock.getDelta();
    let isMoving = false; // Começamos por assumir que está parado

    // --- LÓGICA DE MOVIMENTO (ESTILO POKÉMON) ---
    if (!estadoJogo.emCombate && !mapaAberto) {
        let dirX = 0;
        let dirZ = 0;

        if (keys.w) dirZ -= 1; // Norte
        if (keys.s) dirZ += 1; // Sul
        if (keys.a) dirX -= 1; // Oeste
        if (keys.d) dirX += 1; // Este

        if (dirX !== 0 || dirZ !== 0) {
            // Informamos que o jogador se está a tentar mover
            isMoving = true;

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

        // --- INTERAÇÃO COM A PORTA DA LOJA ---
        const playerRadius = 0.25;
        const playerBox = new THREE.Box3(
            new THREE.Vector3(player.position.x - playerRadius, 0, player.position.z - playerRadius),
            new THREE.Vector3(player.position.x + playerRadius, 1.7, player.position.z + playerRadius)
        );
        if (shopDoorInteract && playerBox.intersectsBox(shopDoorInteract)) {
            showPrompt('Pressiona E para entrar');
            if (keys.e) enterShop();
        } else {
            hidePrompt();
        }
    }

    // --- ATUALIZAR ANIMAÇÃO DO JOGADOR ---
    // Mesmo que isMoving seja false, passamos o deltaTime para ele animar o estado "Idle" (parado)
    updatePlayerAnimation(isMoving, deltaTime);

   // --- ANIMAÇÃO DO RIO (Fluxo Esquerda -> Direita) ---
   if (riverMesh) {
    const t = clock.getElapsedTime();
    const pos = riverMesh.geometry.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        
        // Movimento da onda. O - t * 2.0 fá-la andar da esquerda para a direita
        const ondaX = Math.sin(x * 0.6 - t * 2.0) * 0.025; 
        const ondaY = Math.cos(y * 1.5 + t * 0.5) * 0.015;
        
        pos.setZ(i, ondaX + ondaY);
    }
    pos.needsUpdate = true;
    riverMesh.geometry.computeVertexNormals(); // Recalcular as sombras nas ondas
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
// 5. INICIALIZAÇÃO
// --------------------------------------------------------
criarMapa(scene);
scene.add(player);
animate();