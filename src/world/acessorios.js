// ----------------------------------------------------------------------
// Acessórios (visuais 3D) — versão partilhada entre pedestais e boss.
// Cada função devolve um THREE.Group em escala "troféu" (~0.18 raio
// para coroa). Para colocar no boss, basta scale para ~1.0–1.6.
// ----------------------------------------------------------------------
import * as THREE from 'three';

export function criarAcessorioCoroa() {
    const g = new THREE.Group();
    const matOuro  = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x4a3000, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.9 });
    const matPedra = new THREE.MeshStandardMaterial({ color: 0x88aaff, emissive: 0x3050ff, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.4 });
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 12, 28), matOuro);
    aro.rotation.x = Math.PI / 2;
    g.add(aro);
    const pontaGeo = new THREE.ConeGeometry(0.035, 0.10, 8);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = new THREE.Mesh(pontaGeo, matOuro);
        p.position.set(Math.cos(a) * 0.18, 0.045, Math.sin(a) * 0.18);
        g.add(p);
    }
    const pedra = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), matPedra);
    pedra.position.set(0, 0.01, 0.18);
    g.add(pedra);
    return g;
}

export function criarAcessorioBrincos() {
    const g = new THREE.Group();
    const matOuro = new THREE.MeshStandardMaterial({ color: 0xffd87a, emissive: 0x6a4500, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.95 });
    const matGema = new THREE.MeshStandardMaterial({ color: 0xff5fa0, emissive: 0xff2a80, emissiveIntensity: 1.8, roughness: 0.1, metalness: 0.2 });
    for (const side of [-1, 1]) {
        const par = new THREE.Group();
        const aro = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16), matOuro);
        aro.rotation.y = Math.PI / 2;
        par.add(aro);
        const gema = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), matGema);
        gema.position.y = -0.14;
        par.add(gema);
        par.position.set(side * 0.14, 0.08, 0);
        g.add(par);
    }
    return g;
}

export function criarAcessorioAureola() {
    const g = new THREE.Group();
    const matOuro = new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffd040, emissiveIntensity: 1.8, roughness: 0.15, metalness: 0.95 });
    const matGlow = new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.22 });
    const anel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 12, 36), matOuro);
    anel.rotation.x = Math.PI / 2;
    g.add(anel);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 8, 24), matGlow);
    glow.rotation.x = Math.PI / 2;
    g.add(glow);
    return g;
}

export function criarAcessorioMascara() {
    const g = new THREE.Group();
    const matBanda = new THREE.MeshStandardMaterial({ color: 0x0a0612, roughness: 0.6, metalness: 0.5, emissive: 0x10001f, emissiveIntensity: 0.5 });
    const matRuna  = new THREE.MeshStandardMaterial({ color: 0xa84bff, emissive: 0xa040ff, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.2 });
    const banda = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.08, 24, 1, true, -Math.PI * 0.55, Math.PI * 1.1),
        matBanda
    );
    banda.rotation.y = Math.PI / 2;
    g.add(banda);
    const runa = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), matRuna);
    runa.position.set(0, 0, 0.17);
    g.add(runa);
    return g;
}

export function criarAcessorioOculos() {
    const g = new THREE.Group();
    const matArma  = new THREE.MeshStandardMaterial({ color: 0x1a1020, emissive: 0x2a0040, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.7 });
    const matLente = new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x2080ff, emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
    for (const side of [-1, 1]) {
        const aro = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.015, 10, 24), matArma);
        aro.position.x = side * 0.13;
        g.add(aro);
        const lente = new THREE.Mesh(new THREE.CircleGeometry(0.092, 24), matLente);
        lente.position.set(side * 0.13, 0, 0.002);
        g.add(lente);
    }
    const ponte = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.012), matArma);
    g.add(ponte);
    return g;
}

// despachante: id (igual ao do inventário) → factory
const _FACTORIES = {
    coroa_magica:   criarAcessorioCoroa,
    brincos_vida:   criarAcessorioBrincos,
    aureola_caidos: criarAcessorioAureola,
    mascara_eclipse: criarAcessorioMascara,
    oculos_carga:   criarAcessorioOculos,
};

export function criarAcessorio(id) {
    const f = _FACTORIES[id];
    if (!f) return null;
    return f();
}
