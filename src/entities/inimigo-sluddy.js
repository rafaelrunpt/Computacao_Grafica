// ======================================================================
// SLUDDY — inimigo fraco inspirado no Muck (Pokémon). Corpo amorfo lilás,
// boca enorme aberta com dois "olhos" cinzentos dentro, lumps por cima
// e uma extensão lateral que parece estar a derreter. Low-poly,
// flat-shading. Expõe a mesma API do wraith (`grupo.material`).
// ======================================================================
import * as THREE from 'three';

export function criarInimigoSluddy() {
    const grupo = new THREE.Group();

    const slimeBody = new THREE.MeshStandardMaterial({
        color: 0xb89ec2,
        emissive: 0x4a2a5a,
        emissiveIntensity: 0.18,
        roughness: 0.55,
        metalness: 0.1,
        flatShading: true,
    });
    const slimeDark = new THREE.MeshStandardMaterial({
        color: 0x7a5a8a,
        roughness: 0.7,
        flatShading: true,
    });
    const mouthMat = new THREE.MeshStandardMaterial({
        color: 0x050008,
        emissive: 0x000000,
        roughness: 1.0,
        side: THREE.DoubleSide,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xc5c5d5,
        emissive: 0x202028,
        emissiveIntensity: 0.4,
        roughness: 0.35,
    });

    // ---- Corpo principal (esfera achatada) ----
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 16, 12),
        slimeBody
    );
    body.scale.set(1.4, 0.7, 1.1);
    body.position.y = 0.7;
    body.castShadow = true;
    grupo.add(body);

    // ---- "Saco" lateral — aspecto de slime a derreter para o lado ----
    const tail = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 14, 10),
        slimeBody
    );
    tail.scale.set(1.3, 0.55, 0.85);
    tail.position.set(1.45, 0.4, 0.15);
    tail.castShadow = true;
    grupo.add(tail);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), slimeBody);
    tailTip.scale.set(1.0, 0.55, 0.85);
    tailTip.position.set(2.15, 0.28, 0.18);
    tailTip.castShadow = true;
    grupo.add(tailTip);

    // ---- Bolhas/lumps por cima ----
    const lumps = [];
    const lumpPositions = [
        [-0.55, 1.04,  0.10],
        [ 0.20, 1.13, -0.35],
        [-0.10, 1.06, -0.50],
        [ 0.70, 1.05,  0.25],
        [-0.85, 0.98, -0.20],
    ];
    for (let i = 0; i < lumpPositions.length; i++) {
        const r = 0.20 + (i % 2) * 0.06 + Math.random() * 0.08;
        const lump = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), slimeBody);
        const [lx, ly, lz] = lumpPositions[i];
        lump.position.set(lx, ly, lz);
        lump.userData.baseY = ly;
        lump.castShadow = true;
        grupo.add(lump);
        lumps.push(lump);
    }

    // ---- Listras escuras a horizontal (anéis achatados a contornar o corpo) ----
    for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(
            new THREE.TorusGeometry(0.85 - i * 0.12, 0.045, 6, 24),
            slimeDark
        );
        stripe.position.y = 0.42 + i * 0.16;
        stripe.rotation.x = Math.PI / 2;
        stripe.scale.set(1.4, 1.1, 0.4);
        grupo.add(stripe);
    }

    // ---- Boca aberta — oval preto plano colado à frente do corpo ----
    // O corpo (radius 1.0, scale.z 1.1) chega a z=1.10 à frente. Colocamos
    // o disco em z=1.12 para evitar z-fight com a casca do corpo.
    const MOUTH_Z = 1.12;
    const mouthShape = new THREE.Mesh(
        new THREE.CircleGeometry(0.45, 28),
        mouthMat
    );
    mouthShape.scale.set(1.45, 0.85, 1.0);  // oval mais largo que alto
    mouthShape.position.set(0.05, 0.95, MOUTH_Z);
    grupo.add(mouthShape);

    // lábio superior — torus parcial em arco a contornar o topo da boca
    const lipTop = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.08, 8, 24, Math.PI),
        slimeBody
    );
    lipTop.scale.set(1.15, 0.7, 1.0);
    lipTop.position.set(0.05, 0.95, MOUTH_Z - 0.02);
    grupo.add(lipTop);
    // lábio inferior — outro arco invertido
    const lipBot = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.08, 8, 24, Math.PI),
        slimeBody
    );
    lipBot.scale.set(1.15, 0.7, 1.0);
    lipBot.rotation.z = Math.PI;
    lipBot.position.set(0.05, 0.95, MOUTH_Z - 0.02);
    grupo.add(lipBot);

    // ---- Dois "olhos" cinzentos dentro da boca ----
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), eyeMat);
    eyeL.scale.set(0.7, 1.4, 0.35);
    eyeL.position.set(-0.20, 1.02, MOUTH_Z + 0.02);
    grupo.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), eyeMat);
    eyeR.scale.set(0.7, 1.4, 0.35);
    eyeR.position.set(0.22, 1.02, MOUTH_Z + 0.02);
    grupo.add(eyeR);

    // ---- Gota de slime a escorrer do canto da boca ----
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), slimeBody);
    drip.scale.set(0.7, 1.5, 0.7);
    drip.position.set(0.30, 0.62, MOUTH_Z - 0.05);
    grupo.add(drip);

    // ---- Pequeno orifício/furo no topo (igual à referência) ----
    const blowhole = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 12),
        mouthMat
    );
    blowhole.rotation.x = -Math.PI / 2;
    blowhole.position.set(-0.55, 1.20, -0.45);
    grupo.add(blowhole);

    // ---- Sombra pessoal subtil (luz roxa fraca) ----
    const auraLight = new THREE.PointLight(0xa070d0, 0.45, 3.5, 2);
    auraLight.position.set(0.0, 1.0, 0.0);
    grupo.add(auraLight);

    // ---- Proxy de material para systems/combate.js ----
    const _fadeMats = [slimeBody, slimeDark, mouthMat, eyeMat];
    const _emissiveMats = [slimeBody, eyeMat];
    const _baseOpacity = new Map(_fadeMats.map(m => [m, m.opacity ?? 1]));
    const _baseEmissive = _emissiveMats.map(m => m.emissiveIntensity);
    const inimigoMat = {
        get emissiveIntensity() { return _emissiveMats[0].emissiveIntensity; },
        set emissiveIntensity(v) {
            _emissiveMats[0].emissiveIntensity = v;
            _emissiveMats[1].emissiveIntensity = v * 0.6;
        },
        get transparent() { return slimeBody.transparent; },
        set transparent(v) { _fadeMats.forEach(m => { m.transparent = v; }); },
        get opacity() { return slimeBody.opacity; },
        set opacity(v) {
            _fadeMats.forEach(m => { m.opacity = (_baseOpacity.get(m) ?? 1) * v; });
        },
        color: { setHex: () => {} },
        emissive: { setHex: () => {} },
    };
    grupo.material = inimigoMat;
    grupo.userData.body = body;
    grupo.userData.tail = tail;
    grupo.userData.lumps = lumps;
    grupo.userData.eyeL = eyeL;
    grupo.userData.eyeR = eyeR;
    grupo.userData.drip = drip;
    grupo.userData._fadeMats = _fadeMats;
    grupo.userData._emissiveMats = _emissiveMats;
    grupo.userData._baseOpacity = _baseOpacity;
    grupo.userData._baseEmissive = _baseEmissive;

    return grupo;
}

export function updateInimigoSluddy(grupo, dt, t, basePos) {
    // Fica colado ao chão. O basePos do combate inclui o offset usado pelo
    // wraith (y≈0.85). Anulamos esse offset para deixar a base do modelo
    // (que já sai a y=0 em coordenadas locais) assente no chão.
    grupo.position.x = basePos.x;
    grupo.position.z = basePos.z;
    grupo.position.y = (basePos.y - 0.85) + Math.sin(t * 1.6) * 0.03;
    // Wobble subtil de tronco
    grupo.rotation.y = -Math.PI / 2 + 0.05 + Math.sin(t * 0.4) * 0.08;
    grupo.rotation.z = Math.sin(t * 1.1) * 0.04;

    // Respiração — escalar o corpo num eixo
    const body = grupo.userData.body;
    if (body) {
        const k = 1 + Math.sin(t * 2.2) * 0.045;
        body.scale.set(1.4 * k, 0.7 * (2 - k), 1.1 * k);
    }
    // O "saco" lateral oscila ligeiramente
    const tail = grupo.userData.tail;
    if (tail) {
        tail.rotation.z = Math.sin(t * 1.3) * 0.08;
    }
    // Lumps "respiram" desalinhadamente
    const lumps = grupo.userData.lumps;
    if (lumps) {
        for (let i = 0; i < lumps.length; i++) {
            const l = lumps[i];
            l.position.y = l.userData.baseY + Math.sin(t * 3 + i * 1.7) * 0.03;
            l.scale.setScalar(1 + Math.sin(t * 2.6 + i) * 0.04);
        }
    }
    // Pestanejar dos olhos cinzentos
    const eyeL = grupo.userData.eyeL;
    const eyeR = grupo.userData.eyeR;
    if (eyeL && eyeR) {
        const cycle = (t % 4.0);
        const blink = cycle > 3.85 ? Math.cos((cycle - 3.85) / 0.15 * Math.PI * 2) : 1;
        const sy = Math.max(0.1, blink) * 1.0;
        eyeL.scale.y = sy;
        eyeR.scale.y = sy;
    }
    // Gota a alongar/encolher
    const drip = grupo.userData.drip;
    if (drip) {
        const stretch = 1.5 + Math.sin(t * 3.5) * 0.4;
        drip.scale.y = stretch;
        drip.position.y = 0.62 - (stretch - 1.5) * 0.05;
    }
}

export function resetInimigoSluddy(grupo) {
    grupo.rotation.set(0, 0, 0);
    grupo.scale.set(1, 1, 1);
    const ud = grupo.userData;
    ud._fadeMats.forEach(m => {
        m.opacity = ud._baseOpacity.get(m) ?? 1;
        m.transparent = (ud._baseOpacity.get(m) ?? 1) < 1;
    });
    ud._emissiveMats.forEach((m, i) => { m.emissiveIntensity = ud._baseEmissive[i]; });
}
