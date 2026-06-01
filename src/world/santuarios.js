// --------------------------------------------------------
// SANTUÁRIOS DAS RUÍNAS — 4 pequenos altares espalhados pelo mapa.
// Cada um dá +5 HP máximo PERMANENTE (não reseta ao dormir). O pedestal
// é sólido (colide com o jogador). Visual: pedestal de pedra com uma
// runa flutuante em cima — começa apagada; só ilumina durante a
// animação de activação (raio luminoso de 2 segundos) e volta a
// apagar-se no fim.
// --------------------------------------------------------

import * as THREE from 'three';
import { registerLight } from '../systems/moderator.js';

const POSICOES = [
    { id: 's_ne', x:  62, z:  52 },   // canto NE — depois das zonas norte
    { id: 's_se', x:  54, z: -72 },   // canto SE — perto do bau da máscara
    { id: 's_so', x: -68, z: -64 },   // canto SO — entre wraith zones
    { id: 's_no', x: -73, z:  53 },   // canto NO — afastado da vila
];

const RUNA_COR_ATIVA   = 0xc080ff;
const RUNA_COR_GASTA   = 0x4a3050;

const BURST_DUR = 2.0;

const _lista = []; // { id, x, z, box, ativado, _runa, _light, _grupo, _burst }

// Burst de activação — raio vertical brilhante + onda no chão durante 2s.
function _criarBurst(cor) {
    const grupo = new THREE.Group();

    const rayMat = new THREE.MeshBasicMaterial({
        color: cor, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    });
    const ray = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 70, 24, 1, true),
        rayMat,
    );
    ray.position.y = 35;
    grupo.add(ray);

    // núcleo interior mais luminoso (branco quente)
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    });
    const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 70, 16, 1, true),
        coreMat,
    );
    core.position.y = 35;
    grupo.add(core);

    // onda expansiva no chão
    const shockMat = new THREE.MeshBasicMaterial({
        color: cor, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    });
    const shock = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.9, 48),
        shockMat,
    );
    shock.rotation.x = -Math.PI / 2;
    shock.position.y = 0.12;
    grupo.add(shock);

    grupo.visible = false;
    grupo.userData = { ray, core, shock, rayMat, coreMat, shockMat, t: 0, active: false };
    return grupo;
}

function _criarUm(scene, p, addCollider, i) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);

    // base larga (degrau)
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.05, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 1.0, flatShading: true }),
    );
    base.position.y = 0.09;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    // pedestal
    const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 0.85, 10),
        new THREE.MeshStandardMaterial({ color: 0x3a3640, roughness: 0.95, flatShading: true }),
    );
    ped.position.y = 0.60;
    ped.castShadow = true;
    ped.receiveShadow = true;
    g.add(ped);

    // topo (laje)
    const topo = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.18, 0.85),
        new THREE.MeshStandardMaterial({ color: 0x5a5560, roughness: 0.85 }),
    );
    topo.position.y = 1.12;
    topo.castShadow = true;
    topo.receiveShadow = true;
    g.add(topo);

    // runa flutuante (torus deitado) — começa acesa, indicando que está disponível
    const runa = new THREE.Mesh(
        new THREE.TorusGeometry(0.30, 0.06, 8, 24),
        new THREE.MeshStandardMaterial({
            color:    RUNA_COR_ATIVA,
            emissive: RUNA_COR_ATIVA,
            emissiveIntensity: 2.8,
            roughness: 0.45,
        }),
    );
    runa.rotation.x = Math.PI / 2;
    runa.position.y = 1.60;
    g.add(runa);

    // luz suave — acesa, indicando que está disponível
    const light = new THREE.PointLight(RUNA_COR_ATIVA, 3.2, 7.5, 1.8);
    light.position.y = 1.6;
    g.add(light);
    registerLight('Mundo - Santuários', `Luz Santuário ${i}`, light);

    // burst de activação (2s) — escondido até ser activado
    const burst = _criarBurst(RUNA_COR_ATIVA);
    g.add(burst);

    scene.add(g);

    // Caixa de interacção (mais larga — onde aparece o prompt)
    const box = new THREE.Box3(
        new THREE.Vector3(p.x - 1.8, 0, p.z - 1.8),
        new THREE.Vector3(p.x + 1.8, 2.6, p.z + 1.8),
    );

    // Caixa sólida (pedestal+base) para colisão — mais apertada para
    // o jogador poder aproximar-se sem ficar preso no glow.
    if (addCollider) {
        addCollider(new THREE.Box3(
            new THREE.Vector3(p.x - 0.85, 0,    p.z - 0.85),
            new THREE.Vector3(p.x + 0.85, 1.30, p.z + 0.85),
        ));
    }

    return {
        id: p.id, x: p.x, z: p.z, box, ativado: false,
        _runa: runa, _light: light, _grupo: g,
        _burst: burst,
    };
}

export function criarSantuarios(scene, addCollider) {
    for (let i = 0; i < POSICOES.length; i++) {
        _lista.push(_criarUm(scene, POSICOES[i], addCollider, i));
    }
}

export function getSantuarios() { return _lista; }

// Marca o santuário como activado (visual mudado, luz apagada).
// Retorna true se efectivamente foi activado agora.
export function ativarSantuario(idx) {
    const s = _lista[idx];
    if (!s || s.ativado) return false;
    s.ativado = true;
    // dispara o raio de 2 segundos — a runa/luz mantém-se apagada
    if (s._burst) {
        s._burst.visible = true;
        s._burst.userData.t = 0;
        s._burst.userData.active = true;
    }
    return true;
}

// Reseta todos — chamado quando o jogador dorme.
export function resetSantuarios() {
    let n = 0;
    for (const s of _lista) {
        if (!s.ativado) continue;
        s.ativado = false;
        
        // Voltar a acender indicando que está novamente disponível
        s._runa.material.color.setHex(RUNA_COR_ATIVA);
        s._runa.material.emissive.setHex(RUNA_COR_ATIVA);
        s._runa.material.emissiveIntensity = 2.8;
        s._light.intensity = 3.2;

        if (s._burst) {
            s._burst.visible = false;
            s._burst.userData.active = false;
        }
        n++;
    }
    return n;
}

export function updateSantuarios(dt) {
    for (const s of _lista) {
        // Quando o debug desliga a luz, apaga também o emissive da runa.
        if (!s._light.visible) {
            s._runa.material.emissiveIntensity = 0;
            continue;
        }
        // Restaurar emissive base para santuários disponíveis (não activados, fora do burst).
        if (!s.ativado && !(s._burst && s._burst.userData.active)) {
            s._runa.material.emissiveIntensity = 2.8;
        }

        // burst de activação (2s) — fade-in rápido, fade-out longo
        const b = s._burst;
        if (b && b.userData.active) {
            b.userData.t += dt;
            const tt = b.userData.t;
            if (tt >= BURST_DUR) {
                b.visible = false;
                b.userData.active = false;
                b.userData.rayMat.opacity = 0;
                b.userData.coreMat.opacity = 0;
                b.userData.shockMat.opacity = 0;
                // Apaga a runa e a luz (santuário foi consumido)
                s._runa.material.color.setHex(RUNA_COR_GASTA);
                s._runa.material.emissive.setHex(RUNA_COR_GASTA);
                s._runa.material.emissiveIntensity = 0.15;
                s._light.intensity = 0;
            } else {
                const k = tt / BURST_DUR;           // 0..1
                // envelope visual do burst (raio/onda): sobe em 0.12s, depois desce
                const fadeIn  = Math.min(1, tt / 0.12);
                const fadeOut = Math.pow(1 - k, 1.6);
                const env = fadeIn * fadeOut;
                
                b.userData.rayMat.opacity   = 0.85 * env;
                b.userData.coreMat.opacity  = 1.00 * env;
                // raio gira ligeiramente
                b.userData.ray.rotation.y  += dt * 0.8;
                b.userData.core.rotation.y -= dt * 1.4;
                // onda no chão — expande e desvanece
                const sc = 0.6 + k * 6.5;
                b.userData.shock.scale.set(sc, sc, 1);
                b.userData.shockMat.opacity = 0.9 * Math.pow(1 - k, 0.8);

                // A runa (aureola) e a luz mantêm-se acesas e intensificam com o burst
                s._runa.material.emissiveIntensity = 2.8 + 1.2 * fadeIn;
                s._light.intensity = 3.2 + 1.0 * fadeIn;
            }
        }
    }
}
