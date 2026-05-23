// ======================================================================
// DEBUG DE MODELOS — cena isolada para inspeccionar modelos 3D do jogo.
// ----------------------------------------------------------------------
// Antes só mostrava o boss; agora é um visualizador genérico — escolhe-se
// o modelo pelo menu de debug (tecla 'ç' → secção "DEBUG DE MODELOS").
// Modelos disponíveis: boss, núcleo corrompido, wraith.
// ======================================================================
import * as THREE from 'three';
import { criarBoss, updateBoss } from '../entities/boss.js';
import { criarInimigoNucleo, updateInimigoNucleo } from '../entities/inimigo-nucleo.js';
import { criarInimigoWraith, updateInimigoWraith } from '../entities/inimigo-wraith.js';

export const bossDebugScene = new THREE.Scene();
bossDebugScene.background = new THREE.Color(0x050505);

// Lighting for texture analysis
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
bossDebugScene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(5, 10, 7.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
bossDebugScene.add(sun);

const rimLight = new THREE.PointLight(0xaa88ff, 1.5, 15);
rimLight.position.set(-5, 5, -5);
bossDebugScene.add(rimLight);

// Ground to see shadows
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
bossDebugScene.add(ground);

// Grid helper for scale
const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
bossDebugScene.add(grid);

export const bossDebugCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
bossDebugCamera.position.set(0, 3.6, 9);
bossDebugCamera.lookAt(0, 2.2, 0);

// ----------------------------------------------------------------------
// REGISTO DE MODELOS
// ----------------------------------------------------------------------
// Cada modelo tem:
//   • label  — nome mostrado no menu de debug
//   • cam    — enquadramento da câmara { pos:[x,y,z], look:[x,y,z] }
//   • ativar() — garante o modelo nesta cena, visível; devolve { update }
//   • desativar() — esconde o modelo
// Os modelos são construídos on-demand (1.ª vez que são escolhidos).
const _basePos = new THREE.Vector3(0, 0.85, 0);   // marca usada pelos inimigos
let _t = 0;

const MODELOS = {
    boss: {
        label: 'Boss',
        cam: { pos: [0, 3.6, 9], look: [0, 2.2, 0] },
        _inst: null,
        ativar() {
            // o boss é um singleton partilhado com o combate — criarBoss
            // reaproveita-o e move-o para esta cena.
            const root = criarBoss(bossDebugScene, new THREE.Vector3(0, 0, 0));
            root.visible = true;
            root.rotation.set(0, 0, 0);
            this._inst = { root, update: (dt) => updateBoss(dt) };
            return this._inst;
        },
        desativar() { if (this._inst) this._inst.root.visible = false; },
    },
    nucleo: {
        label: 'Núcleo Corrompido',
        cam: { pos: [-8.5, 3.2, 0.5], look: [0, 2.2, 0] },
        _inst: null,
        ativar() {
            if (!this._inst) {
                const root = criarInimigoNucleo();
                bossDebugScene.add(root);
                this._inst = { root, update: (dt) => updateInimigoNucleo(root, dt, _t, _basePos) };
            }
            this._inst.root.visible = true;
            return this._inst;
        },
        desativar() { if (this._inst) this._inst.root.visible = false; },
    },
    wraith: {
        label: 'Wraith',
        cam: { pos: [-9, 3.4, 2.2], look: [0, 2.0, 0] },
        _inst: null,
        ativar() {
            if (!this._inst) {
                const root = criarInimigoWraith();
                bossDebugScene.add(root);
                this._inst = { root, update: (dt) => updateInimigoWraith(root, dt, _t, _basePos) };
            }
            this._inst.root.visible = true;
            return this._inst;
        },
        desativar() { if (this._inst) this._inst.root.visible = false; },
    },
};

let _modeloSel = 'boss';

/** Lista de modelos disponíveis (para o menu de debug). */
export function getDebugModelos() {
    return Object.keys(MODELOS).map(id => ({ id, label: MODELOS[id].label }));
}

/** Id do modelo actualmente seleccionado. */
export function getDebugModeloAtivo() { return _modeloSel; }

/** Escolhe/troca o modelo mostrado na cena de debug. */
export function setDebugModel(nome) {
    if (!MODELOS[nome]) return;
    for (const id of Object.keys(MODELOS)) MODELOS[id].desativar();
    _modeloSel = nome;
    MODELOS[nome].ativar();
    const c = MODELOS[nome].cam;
    bossDebugCamera.position.set(c.pos[0], c.pos[1], c.pos[2]);
    bossDebugCamera.lookAt(c.look[0], c.look[1], c.look[2]);
}

/** Chamado ao entrar na cena de debug — garante o modelo seleccionado. */
export function initBossDebug() {
    setDebugModel(_modeloSel);
}

export function updateBossDebug(deltaTime) {
    _t += deltaTime;
    const m = MODELOS[_modeloSel];
    if (m && m._inst) m._inst.update(deltaTime);
}
