import * as THREE from 'three';

export class Bau {
    constructor(scene, x, y, z, itemId = 'coroa_magica', rotation = 0) {
        this._aberto   = false;
        this._coletado = false;
        this._onAbrir  = null;
        this._mesh     = null;
        this._tampa    = null;
        this._recompensa = null;
        this._interactBox = null;
        this._colliderBox = null;
        this._criar(scene, x, y, z, itemId, rotation);
    }

    getInteractBox() { return this._interactBox; }
    getColliderBox() { return this._colliderBox; }
    jaAberto()       { return this._aberto; }
    jaColetado()     { return this._coletado; }
    registarOnAbrir(fn) { this._onAbrir = fn; }

    abrir() {
        if (this._aberto || !this._mesh) return false;
        this._aberto = true;
        return true;
    }

    coletar() {
        if (!this._aberto || this._coletado || !this._mesh) return false;
        this._coletado = true;
        if (this._recompensa) this._recompensa.visible = false;
        if (this._onAbrir) this._onAbrir();
        return true;
    }

    update(dt) {
        if (!this._mesh || !this._tampa) return;

        if (!this._aberto) {
            this._mesh.userData.t = (this._mesh.userData.t || 0) + dt;
            const s = 1.0 + Math.sin(this._mesh.userData.t * 2) * 0.02;
            this._mesh.scale.setScalar(s);
        } else {
            const target = -Math.PI * 0.55;
            this._tampa.rotation.x += (target - this._tampa.rotation.x) * 0.08;
            this._mesh.scale.setScalar(1);

            if (this._recompensa && !this._coletado) {
                this._recompensa.visible = true;
                this._recompensa.position.y += (1.1 - this._recompensa.position.y) * 0.05;
                this._recompensa.rotation.y += dt * 2.5;
                if (this._recompensa.userData.brilho) {
                    this._recompensa.userData.pulse = (this._recompensa.userData.pulse || 0) + dt * 4;
                    this._recompensa.userData.brilho.material.emissiveIntensity =
                        1.5 + Math.sin(this._recompensa.userData.pulse) * 0.4;
                }
            }
        }
    }

    _criar(scene, x, y, z, itemId, rotation) {
        const grupo = new THREE.Group();
        grupo.position.set(x, y, z);
        if (rotation) grupo.rotation.y = rotation;

        const matMadeira = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.85 });
        const matFerro   = new THREE.MeshStandardMaterial({ color: 0xd4a830, roughness: 0.4, metalness: 0.7, emissive: 0x3a2400, emissiveIntensity: 0.3 });

        const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.65), matMadeira);
        base.position.y = 0.275;
        base.castShadow = true; base.receiveShadow = true;
        grupo.add(base);

        for (const xb of [-0.35, 0, 0.35]) {
            const cinta = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.68), matFerro);
            cinta.position.set(xb, 0.28, 0);
            cinta.castShadow = true;
            grupo.add(cinta);
        }

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

        const recompensaGroup = new THREE.Group();
        recompensaGroup.position.y = 0.35;
        recompensaGroup.scale.setScalar(0.7);
        recompensaGroup.visible = false;
        grupo.add(recompensaGroup);

        if (itemId === 'coroa_magica')         this._criarVisualCoroa(recompensaGroup);
        else if (itemId === 'mascara_eclipse') this._criarVisualMascara(recompensaGroup);
        else                                   this._criarVisualPocao(recompensaGroup);

        scene.add(grupo);
        this._mesh      = grupo;
        this._tampa     = tampaPivot;
        this._recompensa = recompensaGroup;
        this._mesh.userData.t = 0;

        // collider quadrado — funciona independentemente da rotação
        this._colliderBox = new THREE.Box3(
            new THREE.Vector3(x - 0.55, y,        z - 0.55),
            new THREE.Vector3(x + 0.55, y + 0.80, z + 0.55)
        );
        this._interactBox = new THREE.Box3(
            new THREE.Vector3(x - 1.4, y, z - 1.4),
            new THREE.Vector3(x + 1.4, y + 2.0, z + 1.4)
        );
    }

    _criarVisualCoroa(group) {
        const matOuro  = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x4a3000, emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.9 });
        const matPedra = new THREE.MeshStandardMaterial({ color: 0x88aaff, emissive: 0x3050ff, emissiveIntensity: 1.4, roughness: 0.1,  metalness: 0.4 });

        const aro = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 12, 28), matOuro);
        aro.rotation.x = Math.PI / 2;
        group.add(aro);

        const pontaGeo = new THREE.ConeGeometry(0.06, 0.18, 8);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const p = new THREE.Mesh(pontaGeo, matOuro);
            p.position.set(Math.cos(a) * 0.32, 0.08, Math.sin(a) * 0.32);
            group.add(p);
        }

        const pedra = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), matPedra);
        pedra.position.set(0, 0.02, 0.32);
        group.add(pedra);
        group.userData.brilho = pedra;
    }

    _criarVisualMascara(group) {
        // Versão "Eclipse Total" para o baú — consistente com entities/jogador.js
        const matCorona    = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });
        const matLuaNegra  = new THREE.MeshStandardMaterial({ color: 0x08040a, roughness: 0.9 });
        const matCrescente = new THREE.MeshStandardMaterial({ color: 0xe8d8a8, emissive: 0xf0e0b0, emissiveIntensity: 0.4 });
        const matOlho      = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88ccff, emissiveIntensity: 2.0 });

        // 1. Corona (Disco exterior brilhante)
        const corona = new THREE.Mesh(new THREE.SphereGeometry(0.30, 24, 12), matCorona);
        corona.scale.set(1.0, 1.0, 0.1);
        group.add(corona);

        // 2. Disco Negro (A Lua)
        const lua = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 12), matLuaNegra);
        lua.scale.set(1.0, 1.0, 0.15);
        lua.position.z = 0.02;
        group.add(lua);

        // 3. Crescente
        const cresc = new THREE.Mesh(new THREE.SphereGeometry(0.265, 24, 12, 0, Math.PI * 1.1), matCrescente);
        cresc.scale.set(1.0, 1.0, 0.1);
        cresc.position.set(0.04, 0, 0.04);
        cresc.rotation.z = Math.PI * 0.2;
        group.add(cresc);

        // 4. Olhos (Fendas)
        const olhoGeo = new THREE.SphereGeometry(0.02, 8, 4);
        const o1 = new THREE.Mesh(olhoGeo, matOlho);
        o1.position.set(-0.08, 0.04, 0.06);
        o1.scale.set(2, 0.4, 1);
        group.add(o1);
        const o2 = new THREE.Mesh(olhoGeo, matOlho);
        o2.position.set(0.08, 0.04, 0.06);
        o2.scale.set(2, 0.4, 1);
        group.add(o2);

        group.userData.brilho = corona;
    }

    _criarVisualPocao(group) {
        const matVidro   = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.2 });
        const matLiquido = new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xaa1122, emissiveIntensity: 1.5, roughness: 0.3 });
        const matRolha   = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.9 });

        group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12), matVidro));

        const liquido = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.28, 10), matLiquido);
        liquido.position.y = -0.02;
        group.add(liquido);

        const rolha = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), matRolha);
        rolha.position.y = 0.22;
        group.add(rolha);

        group.userData.brilho = liquido;
    }
}
