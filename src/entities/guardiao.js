// ======================================================================
// GUARDIÃO DA PONTE — entidade que bloqueia o acesso ao norte do mapa
// até o jogador ter nível suficiente / convencê-lo.
// ----------------------------------------------------------------------
// O módulo gere a malha procedural, a animação de caminhada quando
// concede passagem, e expõe a interact-box para o sistema de diálogo.
// ======================================================================
import * as THREE from 'three';

let _mesh = null;
let _colliderBox = null;
let _moving = false;
let _walkTime = 0;
let _phase = 0;             // 0:idle 1:rotação 2:andar 3:reorientação
let _passou = false;

export let guardianInteractBox = null;

export function isGuardiaoPassagemConcedida() { return _passou; }
export function getGuardianMesh() { return _mesh; }
export function getGuardianColliderBox() { return _colliderBox; }

function _atualizarInteractBoxPos() {
    if (!_mesh) return;
    const p = _mesh.position;
    guardianInteractBox = new THREE.Box3(
        new THREE.Vector3(p.x - 1.4, 0, p.z - 1.4),
        new THREE.Vector3(p.x + 1.4, 2.5, p.z + 1.4)
    );
}

/**
 * Constrói o guardião e adiciona-o à cena.
 *   scene      — THREE.Scene
 *   options.addCollider(box)        — registar collider no sistema do mapa
 *   options.fadeables               — array de fadeables (para fade quando tapa o jogador)
 *   options.cullables               — array de cullables (frontal culling)
 */
export function criarGuardiao(scene, { addCollider, fadeables, cullables } = {}) {
    const GX = 0, GZ = 4.5;

    const matArmor = new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 0.6, metalness: 0.4 });
    const matHelm  = new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 0.5, metalness: 0.6 });
    const matCloak = new THREE.MeshStandardMaterial({ color: 0x7a1a1a, roughness: 0.85 });
    const matEye   = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.8 });

    const g = new THREE.Group();

    // pernas
    const legGeo = new THREE.CapsuleGeometry(0.11, 0.28, 8, 8);
    legGeo.translate(0, -0.24, 0);
    const lLeg = new THREE.Mesh(legGeo, matArmor); lLeg.position.set(-0.13, 0.52, 0);
    const rLeg = new THREE.Mesh(legGeo, matArmor); rLeg.position.set( 0.13, 0.52, 0);
    g.add(lLeg, rLeg);
    g.userData.lLeg = lLeg; g.userData.rLeg = rLeg;

    // tronco
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.50, 16), matArmor);
    torso.position.set(0, 0.77, 0);
    g.add(torso);

    // capa
    const capeGeo = new THREE.CylinderGeometry(0.24, 0.35, 0.52, 12, 1, true, Math.PI * 0.1, Math.PI * 1.8);
    const cape = new THREE.Mesh(capeGeo, matCloak);
    cape.position.set(0, 0.77, 0);
    g.add(cape);

    // braços
    const armGeo = new THREE.CapsuleGeometry(0.08, 0.22, 8, 8);
    armGeo.translate(0, -0.19, 0);
    const lArm = new THREE.Mesh(armGeo, matArmor); lArm.position.set(-0.32, 0.97, 0); lArm.rotation.z =  0.3;
    const rArm = new THREE.Mesh(armGeo, matArmor); rArm.position.set( 0.32, 0.97, 0); rArm.rotation.z = -0.3;
    g.add(lArm, rArm);
    g.userData.lArm = lArm; g.userData.rArm = rArm;

    // lança
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), matArmor);
    spear.position.set(0.45, 1.1, -0.1);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), matHelm);
    tip.position.set(0.45, 2.25, -0.1);
    g.add(spear, tip);

    // cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 16), matArmor);
    head.position.set(0, 1.40, 0);
    g.add(head);

    // elmo
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 0.22, 16), matHelm);
    helm.position.set(0, 1.56, 0);
    const helmTop = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matHelm);
    helmTop.position.set(0, 1.56, 0);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.55), matCloak);
    crest.position.set(0, 1.82, 0);
    g.add(helm, helmTop, crest);

    // olhos brilhantes
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matEye);
    lEye.position.set(-0.10, 1.42, 0.27);
    const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matEye);
    rEye.position.set( 0.10, 1.42, 0.27);
    g.add(lEye, rEye);

    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    g.position.set(GX, 0, GZ);
    g.rotation.y = 0;
    scene.add(g);
    fadeables?.push(g);
    cullables?.push(g);
    _mesh = g;

    // barreira invisível na saída norte da ponte
    _colliderBox = new THREE.Box3(
        new THREE.Vector3(-2.2, -1, 3.0),
        new THREE.Vector3( 2.2,  4, 3.6)
    );
    addCollider?.(_colliderBox);

    // interact box do lado sul (o jogador aproxima-se vindo de z positivo)
    guardianInteractBox = new THREE.Box3(
        new THREE.Vector3(GX - 1.5, 0, GZ),
        new THREE.Vector3(GX + 1.5, 2.5, GZ + 3.0)
    );

    return g;
}

/** Cede passagem: remove o collider e arranca a anim de caminhada lateral. */
export function removerGuardiao(removeCollider) {
    if (_passou) return;
    if (_colliderBox) {
        removeCollider?.(_colliderBox);
        _colliderBox = null;
    }
    _passou = true;
    _moving = true;
}

/** Anim por frame (rotação→andar→reorientação→idle). */
export function updateGuardiao(deltaTime) {
    if (!_mesh || !_moving) return;

    if (_phase === 0) _phase = 1;

    if (_phase === 1) {
        const targetRot = Math.PI / 2;
        let diff = targetRot - _mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;

        const rotSpeed = 5 * deltaTime;
        if (Math.abs(diff) < rotSpeed) {
            _mesh.rotation.y = targetRot;
            _phase = 2;
        } else {
            _mesh.rotation.y += Math.sign(diff) * rotSpeed;
        }
    }

    if (_phase === 2) {
        const targetX = 3.2;
        const speed = 1.5;

        if (_mesh.position.x < targetX) {
            _mesh.position.x += speed * deltaTime;

            _walkTime += deltaTime * 20;
            const amp = 0.5;
            if (_mesh.userData.lLeg) _mesh.userData.lLeg.rotation.x = Math.sin(_walkTime) * amp;
            if (_mesh.userData.rLeg) _mesh.userData.rLeg.rotation.x = -Math.sin(_walkTime) * amp;
            if (_mesh.userData.lArm) _mesh.userData.lArm.rotation.x = -Math.sin(_walkTime) * amp * 0.5;
            if (_mesh.userData.rArm) _mesh.userData.rArm.rotation.x = Math.sin(_walkTime) * amp * 0.5;

            _mesh.position.y = Math.abs(Math.sin(_walkTime)) * 0.05;
        } else {
            _phase = 3;
            if (_mesh.userData.lLeg) _mesh.userData.lLeg.rotation.x = 0;
            if (_mesh.userData.rLeg) _mesh.userData.rLeg.rotation.x = 0;
            if (_mesh.userData.lArm) _mesh.userData.lArm.rotation.x = 0;
            if (_mesh.userData.rArm) _mesh.userData.rArm.rotation.x = 0;
            _mesh.position.y = 0;
        }
    }

    if (_phase === 3) {
        const targetX = 3, targetZ = 20;
        const dx = targetX - _mesh.position.x;
        const dz = targetZ - _mesh.position.z;
        const targetRot = Math.atan2(dx, dz);

        let diff = targetRot - _mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;

        const rotSpeed = 4 * deltaTime;
        if (Math.abs(diff) < rotSpeed) {
            _mesh.rotation.y = targetRot;
            _moving = false;
            _phase = 0;
            _atualizarInteractBoxPos();
        } else {
            _mesh.rotation.y += Math.sign(diff) * rotSpeed;
        }
    }
}
