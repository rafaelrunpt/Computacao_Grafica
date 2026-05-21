import * as THREE from 'three';
import {
    ITENS_PERDIDOS, isAtiva, isEntregue, jaColetado, onFetchQuestChange,
    itensEstelaresRevelados,
} from '../systems/merchant-fetch-quest.js';
import { getNightT } from './night-mode.js';

const _instances = []; // { id, mesh, baseY, time, interactBox, waypoint }

// Altura do feixe-waypoint — do chão até bem alto, para o jogador o ver
// de longe por cima das árvores.
const WAYPOINT_HEIGHT = 38;

function criarMesh(item) {
    const grupo = new THREE.Group();

    // núcleo brilhante
    const matCore = new THREE.MeshStandardMaterial({
        color: item.cor, emissive: item.cor,
        emissiveIntensity: 1.8, roughness: 0.25, metalness: 0.6,
    });
    const nucleo = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), matCore);
    grupo.add(nucleo);

    // halo translúcido
    const matHalo = new THREE.MeshBasicMaterial({
        color: item.cor, transparent: true, opacity: 0.22, depthWrite: false,
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), matHalo);
    grupo.add(halo);

    // pequena base no chão
    const matBase = new THREE.MeshStandardMaterial({
        color: item.cor, emissive: item.cor, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.6,
    });
    const base = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), matBase);
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.4;
    grupo.add(base);

    // chama — a amostra arde, qual brasa estelar caída do firmamento.
    // Dois sprites aditivos: corpo exterior com a cor do item + núcleo
    // quente. A cintilação é feita em updateLostItems.
    const flameTex = _flameTexture();
    const chamaExt = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flameTex, color: new THREE.Color(item.cor),
        transparent: true, opacity: 0.6,
        depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    chamaExt.scale.set(0.95, 1.6, 1);
    chamaExt.position.y = 0.28;
    grupo.add(chamaExt);

    const chamaInt = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flameTex, color: 0xfff0c4,
        transparent: true, opacity: 0.85,
        depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    chamaInt.scale.set(0.5, 0.95, 1);
    chamaInt.position.y = 0.12;
    grupo.add(chamaInt);

    grupo.userData.nucleo   = nucleo;
    grupo.userData.halo     = halo;
    grupo.userData.chamaExt = chamaExt;
    grupo.userData.chamaInt = chamaInt;
    return grupo;
}

// Textura de chama (canvas) — partilhada por todas as amostras.
let _flameTexCache = null;
function _flameTexture() {
    if (_flameTexCache) return _flameTexCache;
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    try { ctx.filter = 'blur(3px)'; } catch {}
    // contorno de chama — base larga a afunilar num bico
    ctx.beginPath();
    ctx.moveTo(64, 122);
    ctx.quadraticCurveTo(18, 94, 40, 54);
    ctx.quadraticCurveTo(52, 28, 64, 8);
    ctx.quadraticCurveTo(76, 28, 88, 54);
    ctx.quadraticCurveTo(110, 94, 64, 122);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 122, 0, 8);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,238,205,0.85)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _flameTexCache = tex;
    return tex;
}

// --------------------------------------------------------
// WAYPOINT NOCTURNO — feixe circular de luz do chão ao céu, mais um
// anel pulsante no solo, para o jogador localizar o item de longe.
// Só aparece de noite (a opacidade segue a transição dia→noite).
// --------------------------------------------------------
function criarWaypoint(item) {
    const grupo = new THREE.Group();
    const cor = new THREE.Color(item.cor);

    // ---- feixe vertical (cilindro oco, aditivo) ----
    const beamMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime:    { value: 0 },
            uOpacity: { value: 0 },
            uColor:   { value: cor },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3  uColor;
            varying vec2 vUv;
            void main() {
                // desvanece de baixo (forte) para cima (céu)
                float vFade = pow(1.0 - vUv.y * 0.9, 1.4);
                // pulsos de luz a subir pelo feixe
                float pulse = sin(vUv.y * 16.0 - uTime * 3.2) * 0.5 + 0.5;
                pulse = pow(pulse, 3.0);
                float a = (vFade * 0.45 + pulse * vFade) * uOpacity;
                gl_FragColor = vec4(uColor * (0.8 + 1.4 * pulse), a);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, WAYPOINT_HEIGHT, 20, 1, true),
        beamMat,
    );
    beam.position.y = WAYPOINT_HEIGHT / 2;
    grupo.add(beam);

    // ---- anel pulsante no chão ----
    const ringMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime:    { value: 0 },
            uOpacity: { value: 0 },
            uColor:   { value: cor },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3  uColor;
            varying vec2 vUv;
            void main() {
                float d = length(vUv - 0.5) * 2.0;   // 0..1 do centro à borda
                if (d > 1.0) discard;
                // anéis concêntricos a expandir
                float ring = fract(d * 1.5 - uTime * 0.8);
                ring = smoothstep(0.0, 0.15, ring) * smoothstep(0.6, 0.2, ring);
                float edge = smoothstep(1.0, 0.45, d);   // desvanece na borda
                gl_FragColor = vec4(uColor * 1.6, ring * edge * uOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    grupo.add(ring);

    grupo.userData.beamMat = beamMat;
    grupo.userData.ringMat = ringMat;
    grupo.visible = false;
    return grupo;
}

export function criarLostItems(scene) {
    for (const item of ITENS_PERDIDOS) {
        const mesh = criarMesh(item);
        const baseY = 0.9;
        mesh.position.set(item.pos.x, baseY, item.pos.z);
        mesh.visible = false;
        scene.add(mesh);

        const waypoint = criarWaypoint(item);
        waypoint.position.set(item.pos.x, 0, item.pos.z);
        scene.add(waypoint);

        const interactBox = new THREE.Box3(
            new THREE.Vector3(item.pos.x - 1.2, 0,   item.pos.z - 1.2),
            new THREE.Vector3(item.pos.x + 1.2, 2.2, item.pos.z + 1.2),
        );

        _instances.push({
            id: item.id, item, mesh, baseY, time: Math.random() * 6,
            interactBox, waypoint, wpTime: Math.random() * 6,
        });
    }
    atualizarVisibilidade();
    onFetchQuestChange(atualizarVisibilidade);
}

function atualizarVisibilidade() {
    // Os itens só surgem depois de a cinemática das amostras terminar —
    // antes disso nem o mesh nem o waypoint aparecem.
    const visivelGeral = isAtiva() && !isEntregue() && itensEstelaresRevelados();
    for (const inst of _instances) {
        inst.mesh.visible = visivelGeral && !jaColetado(inst.id);
    }
}

export function updateLostItems(dt) {
    const nightT = getNightT();
    for (const inst of _instances) {
        if (!inst.mesh.visible) {
            if (inst.waypoint) inst.waypoint.visible = false;
            continue;
        }
        inst.time += dt;
        inst.mesh.position.y = inst.baseY + Math.sin(inst.time * 2.0) * 0.18;
        inst.mesh.rotation.y += dt * 1.4;
        if (inst.mesh.userData.halo) {
            const s = 1.0 + Math.sin(inst.time * 2.6) * 0.08;
            inst.mesh.userData.halo.scale.setScalar(s);
        }
        if (inst.mesh.userData.nucleo) {
            inst.mesh.userData.nucleo.material.emissiveIntensity =
                1.5 + Math.sin(inst.time * 3.2) * 0.5;
        }

        // chama — cintilação irregular (vários sin de frequências distintas)
        const cExt = inst.mesh.userData.chamaExt;
        const cInt = inst.mesh.userData.chamaInt;
        if (cExt && cInt) {
            const ft = inst.time;
            cExt.material.opacity = 0.5 + 0.25 * Math.sin(ft * 9.0)
                                        + 0.10 * Math.sin(ft * 17.0);
            cExt.scale.set(
                0.88 + 0.10 * Math.sin(ft * 13.0),
                1.50 + 0.28 * Math.sin(ft * 10.0 + 1.3),
                1,
            );
            cInt.material.opacity = 0.70 + 0.25 * Math.sin(ft * 15.0 + 0.7);
            cInt.scale.set(
                0.46 + 0.07 * Math.sin(ft * 19.0),
                0.90 + 0.16 * Math.sin(ft * 12.0),
                1,
            );
        }

        // waypoint nocturno — só visível de noite, opacidade segue a transição
        if (inst.waypoint) {
            const mostrar = nightT > 0.01;
            inst.waypoint.visible = mostrar;
            if (mostrar) {
                inst.wpTime += dt;
                const { beamMat, ringMat } = inst.waypoint.userData;
                beamMat.uniforms.uTime.value    = inst.wpTime;
                beamMat.uniforms.uOpacity.value = nightT;
                ringMat.uniforms.uTime.value    = inst.wpTime;
                ringMat.uniforms.uOpacity.value = nightT;
            }
        }
    }
}

export function getLostItemAt(pb) {
    for (const inst of _instances) {
        if (!inst.mesh.visible) continue;
        if (pb.intersectsBox(inst.interactBox)) return inst;
    }
    return null;
}
