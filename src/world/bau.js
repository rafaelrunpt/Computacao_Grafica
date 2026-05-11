// --------------------------------------------------------
// BAÚ ESCONDIDO — modelo, animação e estado de abertura
// --------------------------------------------------------
import * as THREE from 'three';

let _mesh = null;
let _tampa = null;
let _recompensa = null;
let _aberto = false;
let _coletado = false;
let _onAbrir = null;
let _interactBox = null;

export function getBauInteractBox() { return _interactBox; }
export function bauJaAberto() { return _aberto; }
export function bauJaColetado() { return _coletado; }
export function registarOnBauAbrir(fn) { _onAbrir = fn; }

export function abrirBau() {
    if (_aberto || !_mesh) return false;
    _aberto = true;
    return true;
}

export function coletarBau() {
    if (!_aberto || _coletado || !_mesh) return false;
    _coletado = true;
    if (_recompensa) _recompensa.visible = false;
    if (_onAbrir) _onAbrir();
    return true;
}

export function updateBau(deltaTime) {
    if (!_mesh || !_tampa) return;
    
    if (!_aberto) {
        _mesh.userData.t = (_mesh.userData.t || 0) + deltaTime;
        const s = 1.0 + Math.sin(_mesh.userData.t * 2) * 0.02;
        _mesh.scale.setScalar(s);
    } else {
        // Abrir a tampa
        const target = -Math.PI * 0.55;
        _tampa.rotation.x += (target - _tampa.rotation.x) * 0.08;
        _mesh.scale.setScalar(1);

        // Animacao da recompensa (sair e rodar) enquanto não coletada
        if (_recompensa && !_coletado) {
            _recompensa.visible = true;
            // Sobe suavemente
            const targetY = 1.1;
            _recompensa.position.y += (targetY - _recompensa.position.y) * 0.05;
            // Roda continuamente
            _recompensa.rotation.y += deltaTime * 2.5;
            
            // Brilho da pedra
            if (_recompensa.userData.pedra) {
                _recompensa.userData.pulse = (_recompensa.userData.pulse || 0) + deltaTime * 4;
                const p = 1.0 + Math.sin(_recompensa.userData.pulse) * 0.4;
                _recompensa.userData.pedra.material.emissiveIntensity = 1.5 + p;
            }
        }
    }
}

// Cria o baú em (x,z) e devolve os boxes para o mapa registar como colliders.
export function criarBau(scene, x, z) {
    const grupo = new THREE.Group();
    grupo.position.set(x, 0, z);

    const matMadeira = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.85 });
    const matFerro   = new THREE.MeshStandardMaterial({ color: 0xd4a830, roughness: 0.4, metalness: 0.7, emissive: 0x3a2400, emissiveIntensity: 0.3 });

    // Base do baú
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.65), matMadeira);
    base.position.y = 0.275;
    base.castShadow = true; base.receiveShadow = true;
    grupo.add(base);

    // Cintas de metal
    for (const xb of [-0.35, 0, 0.35]) {
        const cinta = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.68), matFerro);
        cinta.position.set(xb, 0.28, 0);
        cinta.castShadow = true;
        grupo.add(cinta);
    }

    // Tampa do baú
    const tampaPivot = new THREE.Group();
    tampaPivot.position.set(0, 0.55, -0.325);
    grupo.add(tampaPivot);

    const tampa = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.65), matMadeira);
    tampa.position.set(0, 0.09, 0.325);
    tampa.castShadow = true;
    tampaPivot.add(tampa);

    const fech = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), matFerro);
    fech.position.set(0, 0.04, 0.66);
    tampaPivot.add(fech);

    // ---- Recompensa Visual (Coroa Mágica) ----
    const recompensaGroup = new THREE.Group();
    recompensaGroup.position.y = 0.35; // Começa dentro do baú
    recompensaGroup.scale.setScalar(0.7);
    recompensaGroup.visible = false;
    grupo.add(recompensaGroup);

    const matCoroaOuro = new THREE.MeshStandardMaterial({
        color: 0xffd24a, emissive: 0x4a3000, emissiveIntensity: 0.4,
        roughness: 0.25, metalness: 0.9,
    });
    const matCoroaPedra = new THREE.MeshStandardMaterial({
        color: 0x88aaff, emissive: 0x3050ff, emissiveIntensity: 1.4,
        roughness: 0.1, metalness: 0.4,
    });

    // Aro
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 12, 28), matCoroaOuro);
    aro.rotation.x = Math.PI / 2;
    recompensaGroup.add(aro);

    // Pontas
    const pontaGeo = new THREE.ConeGeometry(0.06, 0.18, 8);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = new THREE.Mesh(pontaGeo, matCoroaOuro);
        p.position.set(Math.cos(a) * 0.32, 0.08, Math.sin(a) * 0.32);
        recompensaGroup.add(p);
    }

    // Pedra
    const pedra = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), matCoroaPedra);
    pedra.position.set(0, 0.02, 0.32);
    recompensaGroup.add(pedra);
    recompensaGroup.userData.pedra = pedra;

    scene.add(grupo);

    _mesh = grupo;
    _tampa = tampaPivot;
    _recompensa = recompensaGroup;
    _mesh.userData.t = 0;

    const colliderBox = new THREE.Box3(
        new THREE.Vector3(x - 0.55, 0, z - 0.4),
        new THREE.Vector3(x + 0.55, 0.8, z + 0.4)
    );
    _interactBox = new THREE.Box3(
        new THREE.Vector3(x - 1.4, 0, z - 1.4),
        new THREE.Vector3(x + 1.4, 2.0, z + 1.4)
    );

    return { colliderBox, interactBox: _interactBox };
}
