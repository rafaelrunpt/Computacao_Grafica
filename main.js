import * as THREE from 'three';


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lidar com o redimensionamento da janela
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});


// 2. MUNDO  BASE

// Chão base (Plano verde)
const planeGeo = new THREE.PlaneGeometry(100, 100);
const planeMat = new THREE.MeshBasicMaterial({ color: 0x228b22, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = Math.PI / 2; // Roda o plano para ficar horizontal
scene.add(plane);

// Grelha para ajudar a perceber o movimento no mundo aberto
const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);

// 3. JOGADOR (Placeholder)
// Mais tarde pode ser um modelo complexo
const playerGeo = new THREE.BoxGeometry(1, 1, 1);
const playerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Cubo vermelho
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.y = 0.5; // Levanta o cubo para não ficar enterrado no chão
scene.add(player);


// 4. MOVIMENTAÇÃO DO JOGADOR

const keys = { w: false, a: false, s: false, d: false };
const moveSpeed = 0.1;

// Detetar quando as teclas são premidas
window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
});

// Detetar quando as teclas são soltas
window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});


// 5. LOOP DE ANIMAÇÃO e CÂMARA PERSPETIVA (Seguir o Jogador)

function animate() {
    requestAnimationFrame(animate);

    // Lógica de Movimento
    if (keys.w) player.position.z -= moveSpeed;
    if (keys.s) player.position.z += moveSpeed;
    if (keys.a) player.position.x -= moveSpeed;
    if (keys.d) player.position.x += moveSpeed;

    // A câmara segue o jogador com um offset 
    const cameraOffsetX = 0;
    const cameraOffsetY = 5;
    const cameraOffsetZ = 8;

    camera.position.x = player.position.x + cameraOffsetX;
    camera.position.y = player.position.y + cameraOffsetY;
    camera.position.z = player.position.z + cameraOffsetZ;
    

    camera.lookAt(player.position);

    renderer.render(scene, camera);
}

// Iniciar o jogo
animate();