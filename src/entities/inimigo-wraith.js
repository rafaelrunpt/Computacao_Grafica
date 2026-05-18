// ======================================================================
// WRAITH INIMIGO — figura encapuzada com chamas roxas usada em combate.
// ----------------------------------------------------------------------
// • Constrói o group procedural (robe, capuz, asas, garras, chamas, névoa).
// • Anexa um proxy material em `.material` para preservar a API antiga
//   usada por systems/combate.js (`emissiveIntensity`, `opacity`, ...).
// • Expõe `updateInimigoWraith(grupo, dt, time, basePos)` para a anim.
// ======================================================================
import * as THREE from 'three';

export function criarInimigoWraith() {
    const grupo = new THREE.Group();

    const wraithDark = new THREE.MeshStandardMaterial({
        color: 0x080310, roughness: 0.95, metalness: 0.05,
    });
    const wraithCloth = new THREE.MeshStandardMaterial({
        color: 0x1a0930, emissive: 0x3d0e75, emissiveIntensity: 0.55,
        roughness: 1, metalness: 0,
    });
    const wingMat = new THREE.MeshStandardMaterial({
        color: 0x4a1880, emissive: 0x9040e0, emissiveIntensity: 1.0,
        transparent: true, opacity: 0.8, side: THREE.DoubleSide, roughness: 0.5,
    });
    const flameMat = new THREE.MeshBasicMaterial({
        color: 0xa050ff, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mistMat = new THREE.MeshBasicMaterial({
        color: 0x6520b0, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xc080ff });

    // Robe (corpo cónico, alargado em baixo)
    const robe = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 2.2, 14, 1, true),
        wraithCloth
    );
    robe.position.y = 1.0;
    robe.castShadow = true;
    grupo.add(robe);

    // Cintura
    const belt = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.06, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x6a6a78, roughness: 0.6 })
    );
    belt.position.y = 1.45;
    belt.rotation.x = Math.PI / 2;
    grupo.add(belt);

    // Tronco
    const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.58, 0.95, 12, 1, true),
        wraithCloth
    );
    torso.position.y = 1.92;
    torso.castShadow = true;
    grupo.add(torso);

    // Ombros / capa
    const shoulders = new THREE.Mesh(
        new THREE.ConeGeometry(0.7, 0.5, 12, 1, true),
        wraithDark
    );
    shoulders.position.y = 2.15;
    shoulders.castShadow = true;
    grupo.add(shoulders);

    // Capuz
    const hood = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.9, 12),
        wraithDark
    );
    hood.position.y = 2.78;
    hood.rotation.x = 0.15;
    hood.castShadow = true;
    grupo.add(hood);

    // Rosto brilhante
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), glowMat);
    face.position.set(0, 2.55, 0.18);
    grupo.add(face);
    const faceLight = new THREE.PointLight(0xa060ff, 1.0, 2.2, 2);
    faceLight.position.set(0, 2.55, 0.25);
    grupo.add(faceLight);

    // Braços + garras
    function braco(side) {
        const manga = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 1.05, 8, 1, true),
            wraithCloth
        );
        manga.position.set(0.55 * side, 1.55, 0.1);
        manga.rotation.z = side * 0.45;
        manga.castShadow = true;
        grupo.add(manga);

        const garra = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), glowMat);
        garra.position.set(0.82 * side, 1.05, 0.12);
        grupo.add(garra);
    }
    braco(-1); braco(1);

    // Asas
    function asa(side) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(0.7 * side, 0.3, 1.4 * side, 0.0, 1.6 * side, -0.6);
        shape.bezierCurveTo(1.2 * side, -0.5, 0.8 * side, -0.9, 0.4 * side, -1.2);
        shape.bezierCurveTo(0.25 * side, -0.8, 0.1 * side, -0.4, 0, 0);
        const g = new THREE.ShapeGeometry(shape);
        const m = new THREE.Mesh(g, wingMat);
        m.position.set(0.35 * side, 2.0, -0.25);
        m.rotation.y = side * -0.35;
        return m;
    }
    const asaL = asa(-1);
    const asaR = asa(1);
    grupo.add(asaL, asaR);

    // Chamas roxas em volta da cabeça
    const flames = [];
    for (let i = 0; i < 12; i++) {
        const g = new THREE.ConeGeometry(0.08 + Math.random() * 0.05, 0.45 + Math.random() * 0.45, 6);
        const m = new THREE.Mesh(g, flameMat);
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
        const rad = 0.32 + Math.random() * 0.18;
        m.position.set(Math.cos(a) * rad, 2.95 + Math.random() * 0.25, Math.sin(a) * rad);
        m.userData = {
            baseY: m.position.y,
            phase: Math.random() * Math.PI * 2,
            baseScale: 0.8 + Math.random() * 0.5,
        };
        m.scale.setScalar(m.userData.baseScale);
        flames.push(m);
        grupo.add(m);
    }

    // Nevoa rotativa
    const mistGroup = new THREE.Group();
    mistGroup.position.y = 1.2;
    for (let i = 0; i < 16; i++) {
        const g = new THREE.PlaneGeometry(1.7, 1.7);
        const m = new THREE.Mesh(g, mistMat);
        const a = (i / 16) * Math.PI * 2;
        const rad = 0.95 + Math.random() * 0.35;
        m.position.set(Math.cos(a) * rad, (Math.random() - 0.3) * 1.6, Math.sin(a) * rad);
        m.rotation.y = -a + Math.PI / 2;
        m.rotation.z = Math.random() * Math.PI * 2;
        mistGroup.add(m);
    }
    grupo.add(mistGroup);

    const mistGroup2 = new THREE.Group();
    mistGroup2.position.y = 0.4;
    for (let i = 0; i < 12; i++) {
        const g = new THREE.PlaneGeometry(2.1, 1.4);
        const m = new THREE.Mesh(g, mistMat);
        const a = (i / 12) * Math.PI * 2;
        const rad = 1.3 + Math.random() * 0.3;
        m.position.set(Math.cos(a) * rad, (Math.random() - 0.5) * 0.8, Math.sin(a) * rad);
        m.rotation.y = -a + Math.PI / 2;
        mistGroup2.add(m);
    }
    grupo.add(mistGroup2);

    // luz roxa pessoal
    const auraLight = new THREE.PointLight(0x9040ff, 1.6, 5.5, 2);
    auraLight.position.set(0, 1.4, 0);
    grupo.add(auraLight);

    // Proxy de material para preservar a API usada por systems/combate.js
    const _fadeMats = [wraithDark, wraithCloth, wingMat, flameMat, mistMat, glowMat,
                       belt.material, face.material];
    const _emissiveMats = [wraithCloth, wingMat];
    const _baseOpacity = new Map(_fadeMats.map(m => [m, m.opacity ?? 1]));
    const _baseEmissive = _emissiveMats.map(m => m.emissiveIntensity);
    const inimigoMat = {
        get emissiveIntensity() { return _emissiveMats[0].emissiveIntensity; },
        set emissiveIntensity(v) {
            _emissiveMats[0].emissiveIntensity = v;
            _emissiveMats[1].emissiveIntensity = v * 1.4;
        },
        get transparent() { return wraithCloth.transparent; },
        set transparent(v) { _fadeMats.forEach(m => { m.transparent = v; }); },
        get opacity() { return wraithCloth.opacity; },
        set opacity(v) {
            _fadeMats.forEach(m => { m.opacity = (_baseOpacity.get(m) ?? 1) * v; });
        },
        color: { setHex: () => {} },
        emissive: { setHex: () => {} },
    };
    grupo.material = inimigoMat;
    grupo.userData.flames = flames;
    grupo.userData.mistGroup = mistGroup;
    grupo.userData.mistGroup2 = mistGroup2;
    grupo.userData.asaL = asaL;
    grupo.userData.asaR = asaR;
    grupo.userData._baseOpacity = _baseOpacity;
    grupo.userData._baseEmissive = _baseEmissive;
    grupo.userData._emissiveMats = _emissiveMats;
    grupo.userData._fadeMats = _fadeMats;

    return grupo;
}

/**
 * Animação por frame do wraith.
 *   grupo  — group devolvido por criarInimigoWraith
 *   dt     — deltaTime
 *   t      — tempo acumulado da cena
 *   basePos — posição "alvo" actual (mutada pelo combate-scene)
 */
export function updateInimigoWraith(grupo, dt, t, basePos) {
    grupo.position.y = basePos.y + Math.sin(t * 1.4) * 0.12;
    grupo.rotation.y = -Math.PI / 2 + 0.35 + Math.sin(t * 0.5) * 0.15;
    grupo.rotation.z = Math.sin(t * 0.8) * 0.04;

    const mist1 = grupo.userData.mistGroup;
    const mist2 = grupo.userData.mistGroup2;
    if (mist1) mist1.rotation.y += dt * 0.45;
    if (mist2) mist2.rotation.y -= dt * 0.28;

    const asaL = grupo.userData.asaL;
    const asaR = grupo.userData.asaR;
    if (asaL && asaR) {
        const flap = Math.sin(t * 2.2) * 0.18;
        asaL.rotation.y = -0.35 + flap;
        asaR.rotation.y =  0.35 - flap;
    }

    const flames = grupo.userData.flames;
    if (flames) {
        for (const f of flames) {
            const u = f.userData;
            f.position.y = u.baseY + Math.sin(t * 5 + u.phase) * 0.08;
            const s = u.baseScale * (0.85 + Math.sin(t * 6 + u.phase) * 0.2);
            f.scale.set(s, s * (1.0 + Math.sin(t * 4 + u.phase) * 0.15), s);
        }
    }
}

/** Repõe o wraith ao estado visual inicial. */
export function resetInimigoWraith(grupo) {
    grupo.rotation.set(0, -Math.PI / 2 + 0.35, 0);
    grupo.scale.set(1, 1, 1);
    const ud = grupo.userData;
    ud._fadeMats.forEach(m => {
        m.opacity = ud._baseOpacity.get(m) ?? 1;
        m.transparent = (ud._baseOpacity.get(m) ?? 1) < 1;
    });
    ud._emissiveMats.forEach((m, i) => { m.emissiveIntensity = ud._baseEmissive[i]; });
}
