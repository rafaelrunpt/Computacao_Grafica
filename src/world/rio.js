import * as THREE from 'three';
import { matWater, madeiraTex, madeira2Tex, woodTexturesReady } from './shaders.js';

const _pendingTexUpdate = [];

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
    const riverMesh = new THREE.Mesh(new THREE.PlaneGeometry(RL, RW, 140, 16), matWater);
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

    const bridgeGroup = new THREE.Group();
    const arcSegments  = 10;
    const arcWidth     = BRIDGE_ARC_WIDTH;
    const arcHeight    = BRIDGE_ARC_HEIGHT;

    for (let i = 0; i < arcSegments; i++) {
        const t0 = i / arcSegments;
        const t1 = (i + 1) / arcSegments;
        const z0 = (t0 - 0.5) * arcWidth;
        const z1 = (t1 - 0.5) * arcWidth;
        const zCenter = (z0 + z1) / 2;
        const hCenter = arcHeight * (1 - Math.pow((2 * zCenter) / arcWidth, 2)) - 0.05;
        const segLen  = (arcWidth / arcSegments) + 0.05;

        const mWoodSeg = matWood.clone();
        mWoodSeg.map = madeiraTex.clone();
        mWoodSeg.map.wrapS = mWoodSeg.map.wrapT = THREE.RepeatWrapping;
        mWoodSeg.map.repeat.set(BW / 2, segLen / 2);
        _pendingTexUpdate.push(mWoodSeg.map);

        const seg = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.25, segLen), mWoodSeg);
        seg.position.set(0, hCenter, zCenter);
        const angle = -Math.atan2(arcHeight * -8 * zCenter / (arcWidth * arcWidth), 1);
        seg.rotation.x = angle;
        seg.castShadow = true; seg.receiveShadow = true;
        bridgeGroup.add(seg);

        for (const side of [-1, 1]) {
            const mBeam = matWoodDark.clone();
            mBeam.map = madeira2Tex.clone();
            mBeam.map.wrapS = mBeam.map.wrapT = THREE.RepeatWrapping;
            mBeam.map.repeat.set(0.5, segLen / 2);
            _pendingTexUpdate.push(mBeam.map);

            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, segLen), mBeam);
            beam.position.set(side * (BW / 2 - 0.2), hCenter - 0.3, zCenter);
            beam.rotation.x = angle;
            bridgeGroup.add(beam);
        }

        for (let j = 0; j < 2; j++) {
            const pz = z0 + (j + 0.5) * (segLen / 2);
            const ph = arcHeight * (1 - Math.pow((2 * pz) / arcWidth, 2)) + 0.08;
            const mPlank = matWood.clone();
            mPlank.map = madeiraTex.clone();
            mPlank.map.wrapS = mPlank.map.wrapT = THREE.RepeatWrapping;
            mPlank.map.repeat.set(BW / 2, 0.2);
            _pendingTexUpdate.push(mPlank.map);

            const plank = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.2, 0.08, 0.25), mPlank);
            plank.position.set((Math.random() - 0.5) * 0.1, ph, pz);
            plank.rotation.x = angle;
            plank.rotation.y = (Math.random() - 0.5) * 0.05;
            plank.castShadow = true;
            bridgeGroup.add(plank);
        }
    }
    bridgeGroup.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(bridgeGroup);
    fadeables.push(bridgeGroup);
    cullables.push(bridgeGroup);

    for (const sx of [-BW / 2 + 0.1, BW / 2 - 0.1]) {
        const nPosts = 5;
        const posts  = [];
        for (let i = 0; i < nPosts; i++) {
            const t  = i / (nPosts - 1);
            const pz = (t - 0.5) * arcWidth;
            const ph = arcHeight * (1 - Math.pow((2 * pz) / arcWidth, 2)) + 0.4;

            const mPost = matWoodDark.clone();
            mPost.map = madeira2Tex.clone();
            mPost.map.wrapS = mPost.map.wrapT = THREE.RepeatWrapping;
            mPost.map.repeat.set(0.2, 1);
            _pendingTexUpdate.push(mPost.map);

            const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), mPost);
            post.position.set(sx, ph, pz);
            post.rotation.y = Math.random() * 0.2;
            post.castShadow = true; post.receiveShadow = true;
            scene.add(post);
            fadeables.push(post);
            cullables.push(post);
            posts.push(post);

            addCol(new THREE.Box3(
                new THREE.Vector3(BX + sx - 0.2, ph - 0.75, pz - 0.11),
                new THREE.Vector3(BX + sx + 0.2, ph + 0.75, pz + 0.11)
            ));
        }

        for (let i = 0; i < nPosts - 1; i++) {
            const p1 = posts[i].position;
            const p2 = posts[i + 1].position;
            const dist = p1.distanceTo(p2);

            const mRail = matWood.clone();
            mRail.map = madeiraTex.clone();
            mRail.map.wrapS = mRail.map.wrapT = THREE.RepeatWrapping;
            mRail.map.repeat.set(dist / 2, 0.2);
            _pendingTexUpdate.push(mRail.map);

            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, dist + 0.1), mRail);
            rail.position.set(sx, (p1.y + p2.y) / 2 + 0.35, (p1.z + p2.z) / 2);
            rail.lookAt(sx, (p1.y + p2.y) / 2 + 0.35, p2.z);
            rail.castShadow = true; rail.receiveShadow = true;
            scene.add(rail);
            fadeables.push(rail);
            cullables.push(rail);

            const mRailMid = matWoodDark.clone();
            mRailMid.map = madeira2Tex.clone();
            mRailMid.map.wrapS = mRailMid.map.wrapT = THREE.RepeatWrapping;
            mRailMid.map.repeat.set(dist / 2, 0.1);
            _pendingTexUpdate.push(mRailMid.map);

            const railMid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, dist + 0.1), mRailMid);
            railMid.position.set(sx, (p1.y + p2.y) / 2 - 0.1, (p1.z + p2.z) / 2);
            railMid.lookAt(sx, (p1.y + p2.y) / 2 - 0.1, p2.z);
            railMid.castShadow = true; railMid.receiveShadow = true;
            scene.add(railMid);
            fadeables.push(railMid);
            cullables.push(railMid);

            addCol(new THREE.Box3(
                new THREE.Vector3(BX + sx - 0.1, Math.min(p1.y, p2.y) - 0.2, Math.min(p1.z, p2.z)),
                new THREE.Vector3(BX + sx + 0.1, Math.max(p1.y, p2.y) + 0.6, Math.max(p1.z, p2.z))
            ));
        }
    }

    _bridgePassage = new THREE.Box3(
        new THREE.Vector3(BX - BW / 2 + 0.4, -2, RZ - arcWidth / 2 - 0.8),
        new THREE.Vector3(BX + BW / 2 - 0.4,  4, RZ + arcWidth / 2 + 0.8)
    );

    woodTexturesReady.then(() => {
        _pendingTexUpdate.forEach(t => { t.needsUpdate = true; });
        _pendingTexUpdate.length = 0;
    });

    _criarBocaDoRio(scene, colliders, fadeables, cullables,  93, RZ, RW);
    _criarBocaDoRio(scene, colliders, fadeables, cullables, -93, RZ, RW);
}

function _criarBocaDoRio(scene, colliders, fadeables, cullables, cx, cz, riverWidth) {
    function addCol(box) { colliders.push({ box, isRiver: false }); }

    const matBoulder       = new THREE.MeshStandardMaterial({ color: 0x7a716a, roughness: 0.95, flatShading: true });
    const matBoulderEscuro = new THREE.MeshStandardMaterial({ color: 0x4a443e, roughness: 1.0,  flatShading: true });

    const grupo = new THREE.Group();

    const z0 = cz - riverWidth / 2 - 1.2;
    const z1 = cz + riverWidth / 2 + 1.2;
    const passos = 7;
    for (let i = 0; i < passos; i++) {
        const t = i / (passos - 1);
        const z = z0 + (z1 - z0) * t;
        const baseR = 1.6 + Math.abs(t - 0.5) * 2.4;
        const r = baseR + (Math.random() - 0.5) * 0.5;
        const escuro = (i + 1) % 3 === 0;
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), escuro ? matBoulderEscuro : matBoulder);
        const dx = (Math.random() - 0.5) * 1.2;
        const yScale = 1.1 + Math.random() * 0.5;
        m.position.set(cx + dx, r * yScale * 0.7 - 0.2, z + (Math.random() - 0.5) * 0.6);
        m.rotation.set(Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.6);
        m.scale.y = yScale;
        m.castShadow = true; m.receiveShadow = true;
        grupo.add(m);

        addCol(new THREE.Box3(
            new THREE.Vector3(m.position.x - r * 0.7, 0, m.position.z - r * 0.7),
            new THREE.Vector3(m.position.x + r * 0.7, r * 2.2, m.position.z + r * 0.7)
        ));
    }

    const dir = Math.sign(cx) || 1;
    const grande = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8, 0), matBoulder);
    grande.position.set(cx + dir * 2.2, 2.6, cz + (Math.random() - 0.5) * 0.6);
    grande.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5);
    grande.scale.set(1.0, 1.4, 1.1);
    grande.castShadow = true; grande.receiveShadow = true;
    grupo.add(grande);
    addCol(new THREE.Box3(
        new THREE.Vector3(grande.position.x - 3, 0, grande.position.z - 3),
        new THREE.Vector3(grande.position.x + 3, 5.5, grande.position.z + 3)
    ));

    const matMist = new THREE.MeshBasicMaterial({ color: 0xeaf0f6, transparent: true, opacity: 0.28, depthWrite: false });
    const mist = new THREE.Mesh(new THREE.SphereGeometry(3.0, 16, 12), matMist);
    mist.position.set(cx, 1.4, cz);
    mist.scale.set(1.0, 0.6, 1.6);
    grupo.add(mist);

    const mist2 = new THREE.Mesh(new THREE.SphereGeometry(4.0, 16, 12), matMist.clone());
    mist2.material.opacity = 0.14;
    mist2.position.set(cx + dir * 0.6, 1.8, cz);
    mist2.scale.set(1.1, 0.5, 1.7);
    grupo.add(mist2);

    grupo.userData.cullCenter = new THREE.Vector3(cx, 1.5, cz);
    scene.add(grupo);
    fadeables.push(grupo);
    cullables.push(grupo);
}
