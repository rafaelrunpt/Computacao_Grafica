// ======================================================================
// NÚCLEO CORROMPIDO — inimigo procedural complexo (tema: corrupção).
// ----------------------------------------------------------------------
// Substitui o antigo "Sluddy" (que era simples demais). É um "objeto" /
// construto flutuante de corrupção:
//   • núcleo de energia a pulsar, envolto numa CASCA DE ROCHA FRACTURADA
//   • um OLHO de corrupção que glara pela abertura frontal da casca
//   • dois ANÉIS RÚNICOS de metal escuro a orbitar em planos diferentes
//   • ESPINHOS de corrupção a irromper da casca
//   • CRISTAIS corrompidos em órbita
//   • TENTÁCULOS a chicotear por baixo
//   • NÉVOA/aura aditiva roxa
// ----------------------------------------------------------------------
// Texturas: reaproveita SÓ ficheiros que já existem (zero assets novos):
//   boss/skin/Rock035            → casca fracturada + tentáculos
//   boss/Rock020_Claws           → espinhos + juntas dos tentáculos
//   boss/Metal_Dark/Metal046A    → anéis rúnicos + órbita do olho
//   castelo/.../PaintedMetal002  → cristais em órbita
// ----------------------------------------------------------------------
// Mantém a API dos inimigos de combate:
//   • grupo.material — proxy (emissiveIntensity / transparent / opacity)
//   • updateInimigoNucleo(grupo, dt, t, basePos)
//   • resetInimigoNucleo(grupo)
// ======================================================================
import * as THREE from 'three';
import { registerLight } from '../systems/moderator.js';

const _texLoader = new THREE.TextureLoader();
const _Z = new THREE.Vector3(0, 0, 1);
const _Y = new THREE.Vector3(0, 1, 0);

// Carrega o trio Color/Normal/Roughness de um set de textura existente.
function _carregarSet(base, repeat = [1, 1]) {
    // Texturas do castelo e do boss estão em WebP (-90% no disco).
    const map          = _texLoader.load(base + 'Color.webp');
    const normalMap    = _texLoader.load(base + 'NormalGL.webp');
    const roughnessMap = _texLoader.load(base + 'Roughness.webp');
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normalMap, roughnessMap]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
    }
    return { map, normalMap, roughnessMap };
}

// Tentáculo: cadeia de Groups encadeados — rodar cada elo faz a ponta
// "chicotear". Devolve { root, segs }.
function _criarTentaculo(matSeg, matJunta) {
    const N = 5, segLen = 0.22;
    const root = new THREE.Group();
    const segs = [];
    let parent = root;
    for (let i = 0; i < N; i++) {
        const seg = new THREE.Group();
        if (i > 0) seg.position.y = -segLen;
        const r0 = 0.13 * (1 - i / N)       + 0.03;   // raio no topo do elo
        const r1 = 0.13 * (1 - (i + 1) / N) + 0.03;   // raio na base do elo
        const elo = new THREE.Mesh(
            new THREE.CylinderGeometry(r0, r1, segLen, 6), matSeg
        );
        elo.position.y = -segLen / 2;
        elo.castShadow = true;
        seg.add(elo);
        if (i < N - 1) {
            const junta = new THREE.Mesh(
                new THREE.SphereGeometry(r1 * 1.3, 6, 5), matJunta
            );
            junta.position.y = -segLen;
            seg.add(junta);
        } else {
            const ponta = new THREE.Mesh(
                new THREE.ConeGeometry(r1 * 1.5, 0.18, 6), matJunta
            );
            ponta.position.y = -segLen - 0.07;
            ponta.rotation.x = Math.PI;
            ponta.castShadow = true;
            seg.add(ponta);
        }
        parent.add(seg);
        segs.push(seg);
        parent = seg;
    }
    return { root, segs };
}

// Anel rúnico: tiltGroup (inclinação fixa) → spinGroup (roda no update).
function _criarAnel(radius, runeCount, matAnel, matRuna) {
    const tiltGroup = new THREE.Group();
    const spinGroup = new THREE.Group();
    tiltGroup.add(spinGroup);
    const torus = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.055, 8, 44), matAnel
    );
    torus.rotation.x = Math.PI / 2;          // anel deitado (plano XZ)
    torus.castShadow = true;
    spinGroup.add(torus);
    for (let i = 0; i < runeCount; i++) {
        const a = (i / runeCount) * Math.PI * 2;
        const cx = Math.cos(a) * radius, cz = Math.sin(a) * radius;
        const runa = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), matRuna);
        runa.position.set(cx, 0, cz);
        spinGroup.add(runa);
        const garra = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), matAnel);
        garra.position.set(cx, -0.16, cz);
        garra.rotation.x = Math.PI;
        garra.castShadow = true;
        spinGroup.add(garra);
    }
    return { tiltGroup, spinGroup };
}

export function criarInimigoNucleo() {
    const grupo = new THREE.Group();
    grupo.name = 'inimigo-nucleo';
    const coreY = 1.5;                       // altura do núcleo (coord. local)

    // ---- MATERIAIS (texturas reaproveitadas) ----
    const matCasca = new THREE.MeshStandardMaterial({
        ..._carregarSet('assets/textures/boss/skin/Rock035_1K-PNG_'),
        color: 0x7a52a0, roughness: 0.9, metalness: 0.2,
        emissive: 0x1c0738, emissiveIntensity: 0.55,
    });
    const matEspinho = new THREE.MeshStandardMaterial({
        ..._carregarSet('assets/textures/boss/Rock020_Claws/Rock020_1K-PNG_'),
        color: 0x5a3a80, roughness: 0.85, metalness: 0.25,
        emissive: 0x180530, emissiveIntensity: 0.4,
    });
    const matAnel = new THREE.MeshStandardMaterial({
        ..._carregarSet('assets/textures/boss/Metal_Dark/Metal046A_1K-PNG_', [3, 1]),
        color: 0x9070b5, roughness: 0.4, metalness: 0.95,
        emissive: 0x2a0a50, emissiveIntensity: 0.35,
    });
    const matCristal = new THREE.MeshStandardMaterial({
        ..._carregarSet('assets/textures/castelo/cristal/PaintedMetal002_1K-PNG/PaintedMetal002_1K-PNG_'),
        color: 0xc070ff, roughness: 0.3, metalness: 0.6,
        emissive: 0x7028d0, emissiveIntensity: 0.9,
    });
    const matNucleo = new THREE.MeshStandardMaterial({
        color: 0x2a0052, emissive: 0xb464ff, emissiveIntensity: 1.6,
        roughness: 0.3, metalness: 0.1,
    });
    const matHalo = new THREE.MeshBasicMaterial({
        color: 0x9a4cff, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const matOlho = new THREE.MeshStandardMaterial({
        color: 0x3a0012, emissive: 0xff3a62, emissiveIntensity: 1.9,
        roughness: 0.25, metalness: 0.0,
    });
    const matPupila = new THREE.MeshStandardMaterial({
        color: 0x08000c, roughness: 0.45, metalness: 0.2,
    });
    const matRuna = new THREE.MeshStandardMaterial({
        color: 0x3a1064, emissive: 0xc06cff, emissiveIntensity: 1.7,
        roughness: 0.4, metalness: 0.1,
    });

    // ---- NÚCLEO + halo de energia ----
    const nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), matNucleo);
    nucleo.position.y = coreY;
    grupo.add(nucleo);
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 1), matHalo);
    halo.position.y = coreY;
    grupo.add(halo);

    const coreLight = new THREE.PointLight(0xb060ff, 1.6, 6.5, 2);
    coreLight.position.set(0, coreY, 0.3);
    grupo.add(coreLight);
    registerLight('Inimigo - Núcleo', 'Luz do Núcleo', coreLight);

    // ---- CASCA FRACTURADA — lascas de rocha à volta do núcleo. A frente
    // (dir.z alto) fica aberta para o olho glarar lá de dentro. ----
    const shards = [];
    const shellR = 0.72;
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const tier = (i % 3 - 1) * 0.65;
        const dir = new THREE.Vector3(Math.cos(a), tier, Math.sin(a)).normalize();
        if (dir.z > 0.45) continue;                       // abertura frontal
        const shard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), matCasca);
        shard.scale.set(1.1 + (i % 3) * 0.15, 0.9 + (i % 2) * 0.2, 0.4);
        const base = dir.clone().multiplyScalar(shellR);
        base.y += coreY;
        shard.position.copy(base);
        shard.quaternion.setFromUnitVectors(_Z, dir);     // eixo fino = radial
        shard.rotateZ((i * 1.7) % Math.PI);               // irregularidade
        shard.castShadow = true;
        shard.userData = { dir, base: base.clone(), phase: i * 0.9 };
        grupo.add(shard);
        shards.push(shard);
    }
    // lascas no topo e no fundo (cobertura)
    for (const ty of [1.8, -1.7]) {
        const dir = new THREE.Vector3(0.12, ty, 0.05).normalize();
        const shard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), matCasca);
        shard.scale.set(1.2, 0.85, 0.4);
        const base = dir.clone().multiplyScalar(shellR * 0.95);
        base.y += coreY;
        shard.position.copy(base);
        shard.quaternion.setFromUnitVectors(_Z, dir);
        shard.castShadow = true;
        shard.userData = { dir, base: base.clone(), phase: ty };
        grupo.add(shard);
        shards.push(shard);
    }

    // ---- ESPINHOS DE CORRUPÇÃO a irromper da casca ----
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        const tier = (i % 2 === 0) ? 0.32 : -0.42;
        const dir = new THREE.Vector3(Math.cos(a), tier, Math.sin(a)).normalize();
        const h = 0.42 + (i % 3) * 0.2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, h, 6), matEspinho);
        spike.quaternion.setFromUnitVectors(_Y, dir);
        spike.position.copy(dir).multiplyScalar(shellR + h * 0.42);
        spike.position.y += coreY;
        spike.castShadow = true;
        grupo.add(spike);
    }

    // ---- OLHO DE CORRUPÇÃO (na abertura frontal, +Z) ----
    const olhoGrupo = new THREE.Group();
    olhoGrupo.position.set(0, coreY, 0.82);
    grupo.add(olhoGrupo);
    const socket = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 8, 24), matAnel);
    socket.castShadow = true;
    olhoGrupo.add(socket);
    const piscar = new THREE.Group();                     // grupo que pestaneja
    olhoGrupo.add(piscar);
    const globo = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 16), matOlho);
    piscar.add(globo);
    const pupila = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.36, 0.08), matPupila);
    pupila.position.z = 0.27;
    piscar.add(pupila);

    // ---- ANÉIS RÚNICOS em órbita ----
    const aneis = [];
    {
        const a1 = _criarAnel(1.28, 6, matAnel, matRuna);
        a1.tiltGroup.position.y = coreY;
        a1.tiltGroup.rotation.set(0.42, 0, 0.18);
        grupo.add(a1.tiltGroup);
        aneis.push({ spin: a1.spinGroup, spd: 0.6 });

        const a2 = _criarAnel(1.02, 5, matAnel, matRuna);
        a2.tiltGroup.position.y = coreY;
        a2.tiltGroup.rotation.set(-0.5, 0, -0.35);
        grupo.add(a2.tiltGroup);
        aneis.push({ spin: a2.spinGroup, spd: -0.95 });
    }

    // ---- CRISTAIS CORROMPIDOS em órbita ----
    const orbitais = [];
    for (let i = 0; i < 5; i++) {
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), matCristal);
        cr.scale.set(0.7, 1.7, 0.7);
        cr.castShadow = true;
        grupo.add(cr);
        orbitais.push({
            mesh: cr,
            ang: (i / 5) * Math.PI * 2,
            rad: 1.05 + (i % 3) * 0.2,
            spd: 0.5 + (i % 2) * 0.4,
            phase: i * 1.3,
        });
    }

    // ---- TENTÁCULOS pendurados do núcleo ----
    const tentaculos = [];
    const NT = 4;
    for (let i = 0; i < NT; i++) {
        const a = (i / NT) * Math.PI * 2 + 0.7;
        const { root, segs } = _criarTentaculo(matCasca, matEspinho);
        root.position.set(Math.cos(a) * 0.4, coreY - 0.34, Math.sin(a) * 0.4);
        root.rotation.y = -a;
        grupo.add(root);
        tentaculos.push({ segs, phase: i * 1.9 });
    }

    // ---- PROXY DE MATERIAL (API esperada por systems/combate.js) ----
    const _fadeMats = [matCasca, matEspinho, matAnel, matCristal, matNucleo,
                       matHalo, matOlho, matPupila, matRuna];
    const _emissiveMats = [matNucleo, matOlho];          // brilham no flash de dano
    const _baseOpacity = new Map(_fadeMats.map(m => [m, m.opacity ?? 1]));
    const _baseEmissive = _emissiveMats.map(m => m.emissiveIntensity);
    grupo.material = {
        get emissiveIntensity() { return matNucleo.emissiveIntensity; },
        set emissiveIntensity(v) {
            matNucleo.emissiveIntensity = v;
            matOlho.emissiveIntensity   = v * 1.15;
        },
        get transparent() { return matNucleo.transparent; },
        set transparent(v) { _fadeMats.forEach(m => { m.transparent = v; }); },
        get opacity() { return matNucleo.opacity; },
        set opacity(v) {
            _fadeMats.forEach(m => { m.opacity = (_baseOpacity.get(m) ?? 1) * v; });
        },
        color:    { setHex: () => {} },
        emissive: { setHex: () => {} },
    };

    grupo.userData = {
        coreY,
        nucleo, halo, shards, aneis, orbitais, tentaculos,
        olho: piscar, pupila, pupilaBaseY: 0,
        matRuna,
        _fadeMats, _emissiveMats, _baseOpacity, _baseEmissive,
    };
    return grupo;
}

/**
 * Animação por frame do Núcleo Corrompido.
 *   grupo   — group devolvido por criarInimigoNucleo
 *   dt      — deltaTime
 *   t       — tempo acumulado da cena
 *   basePos — posição "alvo" actual (mutada pelo combate-scene)
 */
export function updateInimigoNucleo(grupo, dt, t, basePos) {
    const ud = grupo.userData;

    // flutuação + balanço lento
    grupo.position.x = basePos.x;
    grupo.position.z = basePos.z;
    grupo.position.y = basePos.y + Math.sin(t * 1.3) * 0.16;
    grupo.rotation.y = -Math.PI / 2 + Math.sin(t * 0.35) * 0.14;
    grupo.rotation.z = Math.sin(t * 0.7) * 0.03;

    // núcleo + halo a pulsar (só ESCALA — o emissiveIntensity fica
    // reservado ao flash de dano gerido por systems/combate.js).
    if (ud.nucleo) ud.nucleo.scale.setScalar(1 + Math.sin(t * 3.0) * 0.07);
    if (ud.halo) {
        ud.halo.scale.setScalar(1 + Math.sin(t * 3.0 + 0.6) * 0.13);
        ud.halo.rotation.y += dt * 0.5;
        ud.halo.rotation.x += dt * 0.32;
    }

    // casca fracturada a "respirar" ao longo da normal radial
    for (const s of ud.shards) {
        const d = 0.03 + Math.sin(t * 1.6 + s.userData.phase) * 0.06;
        s.position.copy(s.userData.base).addScaledVector(s.userData.dir, d);
    }

    // anéis rúnicos a rodar + runas a cintilar
    for (const an of ud.aneis) an.spin.rotation.y += dt * an.spd;
    if (ud.matRuna) ud.matRuna.emissiveIntensity = 1.5 + Math.sin(t * 4.2) * 0.7;

    // cristais em órbita
    for (const c of ud.orbitais) {
        c.ang += dt * c.spd;
        c.mesh.position.set(
            Math.cos(c.ang) * c.rad,
            ud.coreY + Math.sin(t * 1.4 + c.phase) * 0.4,
            Math.sin(c.ang) * c.rad
        );
        c.mesh.rotation.y += dt * 1.6;
        c.mesh.rotation.z += dt * 1.1;
    }

    // tentáculos a chicotear (amplitude cresce para a ponta)
    for (const tent of ud.tentaculos) {
        for (let i = 0; i < tent.segs.length; i++) {
            const amp = 0.05 + 0.13 * (i / tent.segs.length);
            tent.segs[i].rotation.x = Math.sin(t * 2.1 + tent.phase + i * 0.7) * amp;
            tent.segs[i].rotation.z = Math.cos(t * 1.7 + tent.phase + i * 0.5) * amp;
        }
    }

    // olho — pestanejo periódico + deriva da pupila
    if (ud.olho) {
        const cyc = t % 3.6;
        const blink = cyc > 3.4 ? Math.abs(Math.cos((cyc - 3.4) / 0.2 * Math.PI)) : 1;
        ud.olho.scale.y = Math.max(0.07, blink);
        if (ud.pupila) {
            ud.pupila.position.x = Math.sin(t * 0.9) * 0.07;
            ud.pupila.position.y = ud.pupilaBaseY + Math.cos(t * 0.7) * 0.05;
        }
    }
}

/**
 * Animação de ataque do Núcleo.
 *   tipo: 'lascas' | 'praga' | 'esmagamento'
 */
export function animarAtaqueNucleo(grupo, tipo = 'lascas', dur = 1000) {
    const ud = grupo.userData;
    const t0 = performance.now();
    const baseScale = 1.0;

    function step(now) {
        const e = (now - t0) / dur;
        if (e >= 1) { 
            grupo.scale.setScalar(baseScale);
            grupo.position.y = 0; // será resetado pelo updateInimigoNucleo no próximo frame
            return; 
        }

        // Bell curve para windup
        const pulse = Math.sin(e * Math.PI);

        if (tipo === 'lascas') {
            // Vibração das lascas e aceleração dos anéis
            for (const s of ud.shards) {
                const vib = Math.sin(now * 0.05 + s.userData.phase) * 0.15 * pulse;
                s.position.addScaledVector(s.userData.dir, vib);
            }
            for (const an of ud.aneis) {
                an.spin.rotation.y += pulse * 0.45;
            }
            // Recuo no disparo
            if (e > 0.6) {
                const recoil = Math.sin((e - 0.6) / 0.4 * Math.PI) * 0.8;
                grupo.position.z += recoil;
            }
        } 
        else if (tipo === 'praga') {
            // Inchaço do núcleo e chicoteamento frenético
            const swell = 1.0 + pulse * 0.35;
            grupo.scale.setScalar(swell);
            
            for (const tent of ud.tentaculos) {
                for (let i = 0; i < tent.segs.length; i++) {
                    const frenesi = Math.sin(now * 0.02 + tent.phase + i) * 0.6 * pulse;
                    tent.segs[i].rotation.x += frenesi;
                }
            }
            if (ud.nucleo) ud.nucleo.scale.setScalar(1 + pulse * 0.5);
        }
        else if (tipo === 'esmagamento') {
            // Sobe alto e esmaga o chão
            if (e < 0.6) {
                // Windup: sobe devagar
                const rise = Math.pow(e / 0.6, 2) * 2.5;
                grupo.position.y = rise;
                grupo.scale.setScalar(1.0 + (e / 0.6) * 0.2);
                // Anéis giram loucamente
                for (const an of ud.aneis) an.spin.rotation.y += e * 0.8;
            } else {
                // Slam: desce rápido
                const slam = (1.0 - (e - 0.6) / 0.4) * 2.5;
                grupo.position.y = Math.max(0, slam);
                // Impacto de escala no final
                const squash = 1.2 - Math.sin((e - 0.6) / 0.4 * Math.PI) * 0.4;
                grupo.scale.set(1.1, squash, 1.1);
            }
        }

        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/** Repõe o Núcleo Corrompido ao estado visual inicial. */
export function resetInimigoNucleo(grupo) {
    grupo.rotation.set(0, -Math.PI / 2, 0);
    grupo.scale.set(1, 1, 1);
    const ud = grupo.userData;
    ud._fadeMats.forEach(m => {
        m.opacity = ud._baseOpacity.get(m) ?? 1;
        m.transparent = (ud._baseOpacity.get(m) ?? 1) < 1;
    });
    ud._emissiveMats.forEach((m, i) => { m.emissiveIntensity = ud._baseEmissive[i]; });
    if (ud.matRuna) ud.matRuna.emissiveIntensity = 1.7;
}
