import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { matWater, madeiraTex, madeira2Tex, areiaTex } from './shaders.js';

// As texturas de madeira carregam-se assincronamente. Antes clonávamos a
// textura por peça (76 clones) para variar o `repeat` — isso disparava 76×
// o warning "Texture marked for update but no image data found" no arranque
// e desperdiçava memória GPU + texture binds.
// Agora partilhamos uma única textura por tipo de madeira; o `repeat` é
// uniforme em toda a ponte (visualmente imperceptível em peças pequenas).

const BRIDGE_WIDTH     = 5.2;
const BRIDGE_ARC_WIDTH = 7.4;
const BRIDGE_ARC_HEIGHT = 0.6;
export const BRIDGE_Z  = 0;

let _bridgePassage = null;
export function getBridgePassage() { return _bridgePassage; }

export function getBridgeHeight(x, z) {
    const dx = Math.abs(x);
    const dz = Math.abs(z - BRIDGE_Z);
    if (dx > BRIDGE_WIDTH / 2 || dz > BRIDGE_ARC_WIDTH / 2) return 0;
    const h = BRIDGE_ARC_HEIGHT * (1 - Math.pow((2 * dz) / BRIDGE_ARC_WIDTH, 2)) - 0.05;
    return Math.max(0, h + 0.15);
}

export function criarRio(scene, colliders, fadeables, cullables) {
    function addCol(box, isRiver = false) { colliders.push({ box, isRiver }); }

    const RW = 6, RL = 210, RZ = BRIDGE_Z;

    // Leito de areia por baixo da água. Clone da textura partilhada porque
    // precisamos de um repeat denso e dedicado ao rio (a partilhada está
    // calibrada para o shader do terreno).
    const sandTex = areiaTex.clone();
    // Não marcamos needsUpdate aqui — partilhamos `source` com areiaTex e o
    // upload acontece quando a imagem original carregar (evita warning
    // "Texture marked for update but no image data found").
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.repeat.set(RL / 4, RW / 4);   // ~4 m por tile, anisotropia razoável
    const matSandBed = new THREE.MeshStandardMaterial({
        map: sandTex,
        color: 0xb8a682,        // areia molhada — mais escura/ocre que a margem
        roughness: 1.0,
    });
    const sandBed = new THREE.Mesh(new THREE.PlaneGeometry(RL, RW + 0.4, 1, 1), matSandBed);
    sandBed.rotation.x = -Math.PI / 2;
    sandBed.position.set(0, 0.02, RZ);    // logo abaixo da água (y=0.05)
    sandBed.receiveShadow = true;
    scene.add(sandBed);

    const riverMesh = new THREE.Mesh(new THREE.PlaneGeometry(RL, RW, 1, 1), matWater);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(0, 0.05, RZ);
    riverMesh.receiveShadow = true;
    scene.add(riverMesh);

    addCol(new THREE.Box3(
        new THREE.Vector3(-RL / 2, -1, RZ - RW / 2),
        new THREE.Vector3( RL / 2,  2, RZ + RW / 2)
    ), true);

    const BX = 0;
    const BW = BRIDGE_WIDTH;

    const matWood = new THREE.MeshStandardMaterial({
        map: madeiraTex, color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide,
    });
    const matWoodDark = new THREE.MeshStandardMaterial({
        map: madeira2Tex, color: 0x888888, roughness: 0.95, side: THREE.DoubleSide,
    });

    const arcSegments  = 10;
    const arcWidth     = BRIDGE_ARC_WIDTH;
    const arcHeight    = BRIDGE_ARC_HEIGHT;

    const woodGeos = [];
    const darkWoodGeos = [];

    for (let i = 0; i < arcSegments; i++) {
        const t0 = i / arcSegments;
        const t1 = (i + 1) / arcSegments;
        const z0 = (t0 - 0.5) * arcWidth;
        const z1 = (t1 - 0.5) * arcWidth;
        const zCenter = (z0 + z1) / 2;
        const hCenter = arcHeight * (1 - Math.pow((2 * zCenter) / arcWidth, 2)) - 0.05;
        const segLen  = (arcWidth / arcSegments) + 0.05;
        const angle = -Math.atan2(arcHeight * -8 * zCenter / (arcWidth * arcWidth), 1);

        const segGeo = new THREE.BoxGeometry(BW, 0.25, segLen);
        const m4 = new THREE.Matrix4().compose(
            new THREE.Vector3(0, hCenter, zCenter),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle),
            new THREE.Vector3(1, 1, 1)
        );
        segGeo.applyMatrix4(m4);
        woodGeos.push(segGeo);

        for (const side of [-1, 1]) {
            const beamGeo = new THREE.BoxGeometry(0.3, 0.6, segLen);
            const mBeam = new THREE.Matrix4().compose(
                new THREE.Vector3(side * (BW / 2 - 0.2), hCenter - 0.3, zCenter),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle),
                new THREE.Vector3(1, 1, 1)
            );
            beamGeo.applyMatrix4(mBeam);
            darkWoodGeos.push(beamGeo);
        }

        for (let j = 0; j < 2; j++) {
            const pz = z0 + (j + 0.5) * (segLen / 2);
            const ph = arcHeight * (1 - Math.pow((2 * pz) / arcWidth, 2)) + 0.08;
            const plankGeo = new THREE.BoxGeometry(BW + 0.2, 0.08, 0.25);
            const mPlank = new THREE.Matrix4().compose(
                new THREE.Vector3((Math.random() - 0.5) * 0.1, ph, pz),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, (Math.random() - 0.5) * 0.05, 0)),
                new THREE.Vector3(1, 1, 1)
            );
            plankGeo.applyMatrix4(mPlank);
            woodGeos.push(plankGeo);
        }
    }
    for (const sx of [-BW / 2 + 0.1, BW / 2 - 0.1]) {
        const nPosts = 5;
        const postsInSide  = [];
        for (let i = 0; i < nPosts; i++) {
            const t  = i / (nPosts - 1);
            const pz = (t - 0.5) * arcWidth;
            const ph = arcHeight * (1 - Math.pow((2 * pz) / arcWidth, 2)) + 0.4;

            const postGeo = new THREE.BoxGeometry(0.22, 1.5, 0.22);
            const mPost = new THREE.Matrix4().compose(
                new THREE.Vector3(sx, ph, pz),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 0.2),
                new THREE.Vector3(1, 1, 1)
            );
            postGeo.applyMatrix4(mPost);
            darkWoodGeos.push(postGeo);

            postsInSide.push({ position: new THREE.Vector3(sx, ph, pz) });

            addCol(new THREE.Box3(
                new THREE.Vector3(BX + sx - 0.2, ph - 0.75, pz - 0.11),
                new THREE.Vector3(BX + sx + 0.2, ph + 0.75, pz + 0.11)
            ));
        }

        for (let i = 0; i < nPosts - 1; i++) {
            const p1 = postsInSide[i].position;
            const p2 = postsInSide[i + 1].position;
            const dist = p1.distanceTo(p2);

            const railGeo = new THREE.BoxGeometry(0.15, 0.15, dist + 0.1);
            const railMidGeo = new THREE.BoxGeometry(0.12, 0.12, dist + 0.1);

            const dummy = new THREE.Object3D();
            
            dummy.position.set(sx, (p1.y + p2.y) / 2 + 0.35, (p1.z + p2.z) / 2);
            dummy.lookAt(sx, (p1.y + p2.y) / 2 + 0.35, p2.z);
            dummy.updateMatrix();
            railGeo.applyMatrix4(dummy.matrix);
            woodGeos.push(railGeo);

            dummy.position.set(sx, (p1.y + p2.y) / 2 - 0.1, (p1.z + p2.z) / 2);
            dummy.lookAt(sx, (p1.y + p2.y) / 2 - 0.1, p2.z);
            dummy.updateMatrix();
            railMidGeo.applyMatrix4(dummy.matrix);
            darkWoodGeos.push(railMidGeo);

            addCol(new THREE.Box3(
                new THREE.Vector3(BX + sx - 0.1, Math.min(p1.y, p2.y) - 0.2, Math.min(p1.z, p2.z)),
                new THREE.Vector3(BX + sx + 0.1, Math.max(p1.y, p2.y) + 0.6, Math.max(p1.z, p2.z))
            ));
        }
    }

    // Merge e adiciona ponte
    const mergedWoodGeo = BufferGeometryUtils.mergeGeometries(woodGeos);
    const bridgeWood = new THREE.Mesh(mergedWoodGeo, matWood);
    bridgeWood.castShadow = true; bridgeWood.receiveShadow = true;
    scene.add(bridgeWood);
    fadeables.push(bridgeWood);
    cullables.push(bridgeWood);

    const mergedDarkWoodGeo = BufferGeometryUtils.mergeGeometries(darkWoodGeos);
    const bridgeDarkWood = new THREE.Mesh(mergedDarkWoodGeo, matWoodDark);
    bridgeDarkWood.castShadow = true; bridgeDarkWood.receiveShadow = true;
    scene.add(bridgeDarkWood);
    fadeables.push(bridgeDarkWood);
    cullables.push(bridgeDarkWood);

    _bridgePassage = new THREE.Box3(
        new THREE.Vector3(BX - BW / 2 + 0.4, -2, RZ - arcWidth / 2 - 0.8),
        new THREE.Vector3(BX + BW / 2 - 0.4,  4, RZ + arcWidth / 2 + 0.8)
    );

    _criarBocaDoRio(scene, colliders, fadeables, cullables,  93, RZ, RW);
    _criarBocaDoRio(scene, colliders, fadeables, cullables, -93, RZ, RW);
}

function _criarBocaDoRio(scene, colliders, fadeables, cullables, cx, cz, riverWidth) {
    function addCol(box) { colliders.push({ box, isRiver: false }); }

    const matBoulder       = new THREE.MeshStandardMaterial({ color: 0x7a716a, roughness: 0.95, flatShading: true });
    const matBoulderEscuro = new THREE.MeshStandardMaterial({ color: 0x4a443e, roughness: 1.0,  flatShading: true });

    const boulderGeos = [];
    const boulderDarkGeos = [];

    const z0 = cz - riverWidth / 2 - 1.2;
    const z1 = cz + riverWidth / 2 + 1.2;
    const passos = 7;
    for (let i = 0; i < passos; i++) {
        const t = i / (passos - 1);
        const z = z0 + (z1 - z0) * t;
        const baseR = 1.6 + Math.abs(t - 0.5) * 2.4;
        const r = baseR + (Math.random() - 0.5) * 0.5;
        const escuro = (i + 1) % 3 === 0;

        const geo = new THREE.DodecahedronGeometry(r, 0);
        const dx = (Math.random() - 0.5) * 1.2;
        const yScale = 1.1 + Math.random() * 0.5;
        const m4 = new THREE.Matrix4().compose(
            new THREE.Vector3(cx + dx, r * yScale * 0.7 - 0.2, z + (Math.random() - 0.5) * 0.6),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.6)),
            new THREE.Vector3(1, yScale, 1)
        );
        geo.applyMatrix4(m4);
        if (escuro) boulderDarkGeos.push(geo); else boulderGeos.push(geo);

        addCol(new THREE.Box3(
            new THREE.Vector3(cx + dx - r * 0.7, 0, z + (Math.random() - 0.5) * 0.6 - r * 0.7),
            new THREE.Vector3(cx + dx + r * 0.7, r * 2.2, z + (Math.random() - 0.5) * 0.6 + r * 0.7)
        ));
    }

    const dir = Math.sign(cx) || 1;
    const grandeGeo = new THREE.DodecahedronGeometry(3.8, 0);
    const mGrande = new THREE.Matrix4().compose(
        new THREE.Vector3(cx + dir * 2.2, 2.6, cz + (Math.random() - 0.5) * 0.6),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5)),
        new THREE.Vector3(1.0, 1.4, 1.1)
    );
    grandeGeo.applyMatrix4(mGrande);
    boulderGeos.push(grandeGeo);

    addCol(new THREE.Box3(
        new THREE.Vector3(cx + dir * 2.2 - 3, 0, cz + (Math.random() - 0.5) * 0.6 - 3),
        new THREE.Vector3(cx + dir * 2.2 + 3, 5.5, cz + (Math.random() - 0.5) * 0.6 + 3)
    ));

    const mergedBoulders = BufferGeometryUtils.mergeGeometries(boulderGeos);
    const bouldersMesh = new THREE.Mesh(mergedBoulders, matBoulder);
    bouldersMesh.castShadow = true; bouldersMesh.receiveShadow = true;
    scene.add(bouldersMesh);
    fadeables.push(bouldersMesh);
    cullables.push(bouldersMesh);

    if (boulderDarkGeos.length > 0) {
        const mergedDark = BufferGeometryUtils.mergeGeometries(boulderDarkGeos);
        const darkMesh = new THREE.Mesh(mergedDark, matBoulderEscuro);
        darkMesh.castShadow = true; darkMesh.receiveShadow = true;
        scene.add(darkMesh);
        fadeables.push(darkMesh);
        cullables.push(darkMesh);
    }

    const matMist = new THREE.MeshBasicMaterial({ color: 0xeaf0f6, transparent: true, opacity: 0.28, depthWrite: false });
    const mist = new THREE.Mesh(new THREE.SphereGeometry(3.0, 16, 12), matMist);
    mist.position.set(cx, 1.4, cz);
    mist.scale.set(1.0, 0.6, 1.6);
    scene.add(mist);

    const mist2 = new THREE.Mesh(new THREE.SphereGeometry(4.0, 16, 12), matMist.clone());
    mist2.material.opacity = 0.14;
    mist2.position.set(cx + dir * 0.6, 1.8, cz);
    mist2.scale.set(1.1, 0.5, 1.7);
    scene.add(mist2);
}
