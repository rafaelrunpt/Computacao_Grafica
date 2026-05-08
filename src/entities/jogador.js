import * as THREE from 'three';

// ---------------------------------------------------------
// 1. MATERIAIS 
// ---------------------------------------------------------
const matPele = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 });
const matCabelo = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }); 
const matCamisa = new THREE.MeshStandardMaterial({ color: 0x2b529f, roughness: 0.7 }); // Casaco Azul
const matCalcas = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 }); // Calças Escuras
const matChapeu = new THREE.MeshStandardMaterial({ color: 0x9e3b45, roughness: 0.6 }); // Boné Vermelho
const matAba = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); // Aba Branca
const matMochila = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 }); 
const matOlhos = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });

export const player = new THREE.Group();

// --- VARIÁVEIS DE ALTURA ---
const alturaPerna = 0.45;
const alturaTronco = 0.45;
const raioCabeca = 0.35;

// ---------------------------------------------------------
// 2. PERNAS E TRONCO
// ---------------------------------------------------------
// Pernas (Cápsulas)
const legGeo = new THREE.CapsuleGeometry(0.1, 0.25, 8, 16);
legGeo.translate(0, -0.225, 0); // Ponto de rotação na bacia

const leftLeg = new THREE.Mesh(legGeo, matCalcas);
leftLeg.castShadow = true;
leftLeg.position.set(-0.12, alturaPerna, 0); 

const rightLeg = new THREE.Mesh(legGeo, matCalcas);
rightLeg.castShadow = true;
rightLeg.position.set(0.12, alturaPerna, 0);

// Tronco e Mochila (Agrupados)
const bodyGroup = new THREE.Group();
bodyGroup.position.y = alturaPerna + (alturaTronco / 2); // Pousado perfeitamente nas pernas

const bodyGeo = new THREE.CylinderGeometry(0.18, 0.22, alturaTronco, 32);
const body = new THREE.Mesh(bodyGeo, matCamisa);
body.castShadow = true;
bodyGroup.add(body);

// Mochila a tiracolo
const bagGeo = new THREE.BoxGeometry(0.35, 0.22, 0.12);
const bag = new THREE.Mesh(bagGeo, matMochila);
bag.castShadow = true;
bag.position.set(0, -0.05, -0.22); // Colada às costas
bodyGroup.add(bag);

// ---------------------------------------------------------
// 3. BRAÇOS E MÃOS
// ---------------------------------------------------------
const armGeo = new THREE.CapsuleGeometry(0.07, 0.2, 8, 16);
armGeo.translate(0, -0.17, 0); // Ponto de rotação no ombro

// Braço Esquerdo (Manga + Mão)
const leftArmGroup = new THREE.Group();
const leftArm = new THREE.Mesh(armGeo, matCamisa);
leftArm.castShadow = true;
const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), matPele);
leftHand.position.y = -0.34; // Mão na ponta da manga
leftArmGroup.add(leftArm, leftHand);
leftArmGroup.position.set(-0.26, alturaPerna + alturaTronco - 0.05, 0); // Encaixado no ombro

// Braço Direito (Manga + Mão)
const rightArmGroup = new THREE.Group();
const rightArm = new THREE.Mesh(armGeo, matCamisa);
rightArm.castShadow = true;
const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), matPele);
rightHand.position.y = -0.34;
rightArmGroup.add(rightArm, rightHand);
rightArmGroup.position.set(0.26, alturaPerna + alturaTronco - 0.05, 0);

// ---------------------------------------------------------
// 4. CABEÇA, CABELO E BONÉ
// ---------------------------------------------------------
const headGroup = new THREE.Group();
headGroup.position.y = alturaPerna + alturaTronco + raioCabeca - 0.05; 

// 1. Cara 
const head = new THREE.Mesh(new THREE.SphereGeometry(raioCabeca, 32, 32), matPele);
head.castShadow = true;

// 2. Olhos 
const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), matOlhos);
leftEye.position.set(-0.12, 0.08, 0.32); 
const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), matOlhos);
rightEye.position.set(0.12, 0.08, 0.32);

// 3. Cabelo 
const hairGeo = new THREE.SphereGeometry(
    raioCabeca + 0.012, 32, 32, 
    Math.PI * 0.85,  // Começa perto da orelha direita (livra a frente)
    Math.PI * 1.3,   // Dá a volta por trás (234 graus de cabelo)
    0,               // Começa no topo (escondido debaixo do boné)
    Math.PI / 1.6    // Desce até à nuca
);
const hair = new THREE.Mesh(hairGeo, matCabelo);
hair.castShadow = true;
hair.position.y = 0;

// 4. Boné
const hatGroup = new THREE.Group();

// Cúpula do boné (Alargámos o raio para 0.38 para o cabelo não furar o teto!)
const hatDomeGeo = new THREE.CylinderGeometry(0.37, 0.38, 0.18, 32);
const hatDome = new THREE.Mesh(hatDomeGeo, matChapeu);
hatDome.castShadow = true;
hatDome.position.y = 0.28; // Pousado no topo da cabeça, a tapar a "careca"

// Aba do boné (Desenhamos apenas um ângulo de 120º virado para a frente)
// -Math.PI / 3 centra a aba geometricamente no eixo Z (frente)
const brimGeo = new THREE.CylinderGeometry(0.385, 0.385, 0.02, 32, 1, false, -Math.PI / 3, Math.PI / 1.5);
const brim = new THREE.Mesh(brimGeo, matAba);
brim.position.set(0, 0.20, 0.02); 
brim.rotation.x = -0.15; // Aba ligeiramente inclinada para cima para dar estilo

hatGroup.add(hatDome, brim);
hatGroup.rotation.x = -0.05; // Inclina o chapéu todo um bocadinho para trás

headGroup.add(head, leftEye, rightEye, hair, hatGroup);

// ---------------------------------------------------------
// 5. JUNTAR TUDO NO BONECO
// ---------------------------------------------------------
player.add(leftLeg, rightLeg, bodyGroup, leftArmGroup, rightArmGroup, headGroup);

// Guardar para a animação
player.userData.leftLeg = leftLeg;
player.userData.rightLeg = rightLeg;
player.userData.leftArm = leftArmGroup; 
player.userData.rightArm = rightArmGroup;

player.position.set(3, 0, 5);

// ---------------------------------------------------------
// 6. ANIMAÇÃO
// ---------------------------------------------------------
let walkTime = 0; 

export function updatePlayerAnimation(isMoving, deltaTime) {
    const walkSpeed = 25; 
    const stepAmplitude = 0.6; 
    const armAmplitude = 0.5; 

    if (isMoving) {
        walkTime += deltaTime * walkSpeed;

        player.userData.leftLeg.rotation.x = Math.sin(walkTime) * stepAmplitude;
        player.userData.rightLeg.rotation.x = -Math.sin(walkTime) * stepAmplitude;
        
        player.userData.leftArm.rotation.x = -Math.sin(walkTime) * armAmplitude;
        player.userData.rightArm.rotation.x = Math.sin(walkTime) * armAmplitude;

        const bounce = Math.abs(Math.sin(walkTime)) * 0.06;
        player.position.y = bounce; 

    } else {
        player.userData.leftLeg.rotation.x = 0;
        player.userData.rightLeg.rotation.x = 0;
        player.userData.leftArm.rotation.x = 0;
        player.userData.rightArm.rotation.x = 0;
        player.position.y = 0;
        walkTime = 0; 
    }
}