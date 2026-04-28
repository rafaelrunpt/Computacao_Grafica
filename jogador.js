import * as THREE from 'three';

// 1. Criar o Grupo (A nossa "pasta" invisível que representa o jogador inteiro)
export const player = new THREE.Group();

// 2. O Corpo (O cubo vermelho que já tinhas)
const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.castShadow = true;
// Levantamos o corpo para não ficar enterrado no chão (metade da sua altura)
body.position.y = 0.4; 

// 3. A Cabeça (Um cubo ligeiramente mais pequeno)
const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
// Uma cor mais clara para contrastar com o equipamento vermelho
const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa }); 
const head = new THREE.Mesh(headGeo, headMat);
head.castShadow = true;

// 4. Posicionar a cabeça POR CIMA do corpo
// O topo do corpo está em 0.8. Como a cabeça tem 0.5 de altura, 
// levantamos a cabeça para ficar exatamente pousada nos ombros.
head.position.y = 1.05; 

// 5. Adicionar o Corpo e a Cabeça ao Grupo
player.add(body);
player.add(head);

// Colocar o grupo inteiro no centro do Caminho da Vila (Canto Inferior Direito)
player.position.set(22, 0, 26);
