import * as THREE from 'three';
import { combateScene } from '../world/combate-scene.js';

// ---- Sprite-sheet 3D helpers ----------------------------------------------
// Cria um THREE.Sprite com uma textura de sheet (cols×rows). Para animar,
// chamar setSheetFrame(sprite, idx). Se a sheet tem células vazias, passar
// `frameOrder` (array de [col,row]) para definir a sequência exacta.
const _texCache = new Map();
function _loadTex(url) {
    if (_texCache.has(url)) return _texCache.get(url);
    const t = new THREE.TextureLoader().load(url);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    _texCache.set(url, t);
    return t;
}
function makeSheetSprite(url, cols, rows, totalFrames, frameOrder = null) {
    const tex = _loadTex(url).clone();
    tex.repeat.set(1 / cols, 1 / rows);
    // Sem needsUpdate — o clone partilha `source` com o original e recebe
    // o upload automaticamente quando a TextureLoader resolve a imagem.
    const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
    });
    const s = new THREE.Sprite(mat);
    s.userData = { cols, rows, totalFrames, frameOrder };
    setSheetFrame(s, 0);
    return s;
}
function setSheetFrame(sprite, idx) {
    const { cols, rows, totalFrames, frameOrder } = sprite.userData;
    let col, row;
    if (frameOrder) {
        const m = frameOrder[Math.min(idx, frameOrder.length - 1)];
        col = m[0]; row = m[1];
    } else {
        const i = Math.min(idx, totalFrames - 1);
        col = i % cols;
        row = Math.floor(i / cols);
    }
    sprite.material.map.offset.set(col / cols, 1 - (row + 1) / rows);
}

// Sheets do boss: 3 variações para o ataque aéreo, e 1 por lado para o lateral.
const SHEETS_AEREO = [
    'assets/vfx/boss/bolacima1.png',
    'assets/vfx/boss/bolacima2.png',
    'assets/vfx/boss/bolacima3.png',
];
const SHEET_LATERAL_DIR = 'assets/vfx/boss/bola_direita.png';
const SHEET_LATERAL_ESQ = 'assets/vfx/boss/bola_esquerda.png';

// 4 frames separados (não-sheet) — animação dos espinhos a brotar do chão.
const SPIKE_FRAME_URLS = [
    'assets/vfx/boss/spikes/spike1.png',
    'assets/vfx/boss/spikes/spike2.png',
    'assets/vfx/boss/spikes/spike3.png',
    'assets/vfx/boss/spikes/spike4.png',
];
let _spikeFramesCache = null;
function _loadSpikeFrames() {
    if (_spikeFramesCache) return _spikeFramesCache;
    const loader = new THREE.TextureLoader();
    _spikeFramesCache = SPIKE_FRAME_URLS.map(u => {
        const t = loader.load(u);
        t.magFilter = THREE.NearestFilter;       // pixel-perfect
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        return t;
    });
    return _spikeFramesCache;
}
// Pré-carrega ao importar para evitar pop no primeiro espinho.
_loadSpikeFrames();

// Ordem de frames para os sheets laterais (4×4 com células vazias).
// 3 frames no topo (col 1,2,3), 4+4 nas duas linhas do meio, 2 na última.
const LATERAL_FRAME_ORDER = [
    [1, 0], [2, 0], [3, 0],
    [0, 1], [1, 1], [2, 1], [3, 1],
    [0, 2], [1, 2], [2, 2], [3, 2],
    [0, 3], [1, 3],
];

// ======================================================================
// BOSS VFX — Hooks para efeitos visuais do combate final.
// ----------------------------------------------------------------------
// Este ficheiro centraliza a criação e actualização de meshes, luzes e
// partículas dos ataques do boss. A lógica de colisão e timing
// permanece em boss-attacks.js.
// ======================================================================

// Materiais base (mantidos do original para compatibilidade)
const matTelegraphAereo = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
const matTelegraphRasante = new THREE.MeshBasicMaterial({ color: 0xffaa20, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
const matTelegraphLateral = new THREE.MeshBasicMaterial({ color: 0xb060ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
const matTelegraphVarredura = new THREE.MeshBasicMaterial({ color: 0x60ffaa, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

const matProjAereo = new THREE.MeshStandardMaterial({ color: 0xff5050, emissive: 0xff2020, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.0 });
const matProjRasante = new THREE.MeshStandardMaterial({ color: 0xffaa40, emissive: 0xff8800, emissiveIntensity: 2.5, roughness: 0.3, metalness: 0.0 });
const matProjLateral = new THREE.MeshStandardMaterial({ color: 0xc080ff, emissive: 0x8030ff, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.0 });
const matProjVarredura = new THREE.MeshStandardMaterial({ color: 0x88ffc0, emissive: 0x40dd80, emissiveIntensity: 2.5, roughness: 0.3, metalness: 0.0 });

export const BossVFX = {
    /**
     * Chamado quando o boss começa a telegrafar um ataque.
     * Cria os indicadores visuais (rings, barras, colunas).
     */
    criarTelegraph(pr, colorHex) {
        if (pr.type === 'aereo') {
            const mat = matTelegraphAereo.clone();
            mat.color.setHex(colorHex);
            pr.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 24), mat);
            pr.ring.rotation.x = -Math.PI / 2;
            pr.ring.position.set(pr.x, 0.02, pr.z);
            combateScene.add(pr.ring);
        } else if (pr.type === 'rasante') {
            const mat = matTelegraphRasante.clone();
            mat.color.setHex(colorHex);
            pr.bar = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.05, 0.5), mat);
            pr.bar.position.set(pr.x, 0.06, pr.z);
            combateScene.add(pr.bar);
        } else if (pr.type === 'lateral') {
            const mat = matTelegraphLateral.clone();
            mat.color.setHex(colorHex);
            pr.col = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), mat);
            pr.col.position.set(pr.x, 1.0, pr.z);
            combateScene.add(pr.col);

            pr.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 4), mat.clone());
            pr.arrow.position.set(pr.fromLeft ? -3.6 : 3.6, 1.2, pr.z);
            pr.arrow.rotation.z = pr.fromLeft ? -Math.PI / 2 : Math.PI / 2;
            combateScene.add(pr.arrow);
        } else if (pr.type === 'varredura') {
            const mat = matTelegraphVarredura.clone();
            mat.color.setHex(colorHex);
            pr.bar = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.55, 0.25), mat);
            pr.bar.position.set(pr.x, pr.beamY, pr.z);
            combateScene.add(pr.bar);
        }
    },

    /**
     * Chamado quando o projéctil entra na fase de impacto.
     * Cria a mesh do projéctil e luzes dinâmicas.
     */
    criarProjectil(pr) {
        if (pr.type === 'aereo') {
            // Substitui a esfera mesh por sprite-sheet (1 das 3 variações aleatória).
            const url = SHEETS_AEREO[Math.floor(Math.random() * SHEETS_AEREO.length)];
            pr.sprite = makeSheetSprite(url, 4, 4, 16);
            pr.sprite.position.set(pr.x, 1.0, pr.z);
            pr.sprite.scale.set(4.8, 4.8, 1);
            pr.sprite.visible = false;
            combateScene.add(pr.sprite);
            pr.light = new THREE.PointLight(0xff5050, 0, 4, 2);
        } else if (pr.type === 'rasante') {
            // 3 filas × 3 lanes (9 espinhos). Cada fila aparece mais tarde e mais
            // perto do player, dando a leitura de "espinhos a chegar". Não fazem
            // fade — ficam visíveis até o projéctil terminar.
            const frames = _loadSpikeFrames();
            pr.spikeFrames = frames;
            pr.sprites = [];
            const LANE_X = [-1.8, 0, 1.8];
            // Origem do ataque: (0, 0, 2) — a 1ª fila aparece exactamente aí
            // (no player), erupta primeiro e mais alto. As filas seguintes
            // propagam-se na direcção do boss com espinhos progressivamente
            // mais baixos (efeito de onda de choque a partir do player).
            const ROW_Z      = [ 0.0, -2.5, -5.0];   // origem (player), meio, junto ao boss
            // Ordem de aparição: fila junto ao boss primeiro → mid → player (último).
            // Onda visualmente parte do boss e cresce ao chegar ao player.
            const ROW_START  = [ 0.36, 0.18, 0.0];
            pr.rowStartU = ROW_START;
            const H = 1.8;
            for (let row = 0; row < 3; row++) {
                for (let lane = 0; lane < 3; lane++) {
                    const mat = new THREE.SpriteMaterial({
                        map: frames[0], transparent: true, depthWrite: false, depthTest: true,
                    });
                    const s = new THREE.Sprite(mat);
                    s.position.set(pr.x + LANE_X[lane], H / 2, pr.z + ROW_Z[row]);
                    s.scale.set(1.4, H, 1);
                    s.visible = false;
                    s.userData = { row, lastIdx: -1, startU: ROW_START[row] };
                    combateScene.add(s);
                    pr.sprites.push(s);
                }
            }
            pr.light = new THREE.PointLight(0xffaa30, 0, 6, 2);
        } else if (pr.type === 'lateral') {
            // Sprite-sheet com 13 frames (4×4 com cantos vazios); escolhe lado.
            const url = pr.fromLeft ? SHEET_LATERAL_ESQ : SHEET_LATERAL_DIR;
            pr.sprite = makeSheetSprite(url, 4, 4, LATERAL_FRAME_ORDER.length, LATERAL_FRAME_ORDER);
            pr.sprite.position.set(pr.fromLeft ? -8 : 8, 1.2, pr.z);
            pr.sprite.scale.set(3.6, 3.6, 1);
            pr.sprite.visible = false;
            combateScene.add(pr.sprite);
            pr.light = new THREE.PointLight(0xc080ff, 0, 5, 2);
        } else if (pr.type === 'varredura') {
            pr.proj = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.65, 0.7), matProjVarredura);
            pr.proj.position.set(pr.x, pr.beamY, pr.z - 4);
            pr.light = new THREE.PointLight(0x70ffaa, 0, 6, 2);
        }

        if (pr.proj) {
            pr.proj.visible = false;
            combateScene.add(pr.proj);
        }
        if (pr.light) {
            pr.light.position.set(pr.x, pr.type === 'aereo' ? 1.2 : (pr.type === 'varredura' ? pr.beamY + 0.3 : 0.5), pr.z);
            combateScene.add(pr.light);
        }
    },

    /**
     * Update visual por frame. Move meshes e actualiza opacidade.
     */
    update(pr, u, inImpact) {
        if (!inImpact) {
            const blink = 0.45 + 0.55 * Math.abs(Math.sin(pr.t * 14));
            if (pr.ring)  pr.ring.material.opacity  = 0.35 + blink * 0.45;
            if (pr.bar)   pr.bar.material.opacity   = 0.35 + blink * 0.45;
            if (pr.col)   pr.col.material.opacity   = 0.35 + blink * 0.45;
            if (pr.arrow) pr.arrow.material.opacity = 0.40 + blink * 0.55;
            return;
        }

        if (pr.proj) pr.proj.visible = true;
        if (pr.sprite) pr.sprite.visible = true;
        if (pr.light) pr.light.intensity = 4.0 * (1 - u);

        if (pr.type === 'aereo') {
            // sprite cai do céu enquanto a animação corre (16 frames sincronizados com u)
            pr.sprite.position.y = 8 * (1 - u) + 0.6 * u;
            setSheetFrame(pr.sprite, Math.floor(u * (pr.sprite.userData.totalFrames - 0.001)));
            if (pr.ring) pr.ring.material.opacity = 0.6 * (1 - u);
        } else if (pr.type === 'rasante') {
            // Cada fila erupta no seu startU; a animação 1→N dura ROW_ANIM_DUR
            // (em fracção de u). Cada fila tem um max-frame diferente, dando
            // espinhos progressivamente mais altos perto do player:
            //   fila 0 (longe, boss)  → pára no frame 2
            //   fila 1 (meio)         → pára no frame 3
            //   fila 2 (perto player) → pára no frame 4 (full erupt)
            const frames = pr.spikeFrames;
            const ROW_ANIM_DUR = 0.40;
            // Crescimento monotónico: mais alto no player, mais baixo longe.
            //   fila 0 (no player / origem) → idx 3 = frame 4 (full erupt)
            //   fila 1 (meio)               → idx 2 = frame 3
            //   fila 2 (junto ao boss)      → idx 1 = frame 2 (mais curto)
            const ROW_MAX_FRAME = [3, 2, 1];
            for (const s of pr.sprites) {
                const localU = (u - s.userData.startU) / ROW_ANIM_DUR;
                if (localU < 0) continue;
                s.visible = true;
                const maxIdx = ROW_MAX_FRAME[s.userData.row];
                const raw = Math.floor(Math.max(0, localU) * (maxIdx + 1));
                const idx = Math.min(maxIdx, raw);
                if (idx !== s.userData.lastIdx) {
                    s.material.map = frames[idx];
                    s.material.needsUpdate = true;
                    s.userData.lastIdx = idx;
                }
            }
            if (pr.bar) pr.bar.material.opacity = 0.6 * (1 - u);
        } else if (pr.type === 'lateral') {
            const startX = pr.fromLeft ? -8 : 8;
            pr.sprite.position.x = startX + (pr.x - startX) * u + (pr.fromLeft ? 1 : -1) * (u - 1) * 2;
            setSheetFrame(pr.sprite, Math.floor(u * (pr.sprite.userData.totalFrames - 0.001)));
            if (pr.col)   pr.col.material.opacity   = 0.6 * (1 - u);
            if (pr.arrow) pr.arrow.material.opacity = 0.6 * (1 - u);
        } else if (pr.type === 'varredura') {
            pr.proj.position.z = pr.z - 4 + 7 * u;
            pr.proj.position.y = pr.beamY;
            if (pr.bar) pr.bar.material.opacity = 0.6 * (1 - u);
        }
    },

    /**
     * Limpeza ao terminar o projéctil.
     */
    dispose(pr) {
        if (pr.ring)   combateScene.remove(pr.ring);
        if (pr.bar)    combateScene.remove(pr.bar);
        if (pr.col)    combateScene.remove(pr.col);
        if (pr.arrow)  combateScene.remove(pr.arrow);
        if (pr.proj)   combateScene.remove(pr.proj);
        if (pr.sprite) {
            combateScene.remove(pr.sprite);
            if (pr.sprite.material.map) pr.sprite.material.map.dispose();
            pr.sprite.material.dispose();
        }
        if (pr.sprites) {
            // Sprites de rasante: partilham os frames cacheados em _spikeFramesCache,
            // por isso só descartamos o material — NÃO as texturas (matá-las-ia para
            // o próximo rasante).
            for (const s of pr.sprites) {
                combateScene.remove(s);
                s.material.dispose();
            }
        }
        if (pr.light)  combateScene.remove(pr.light);
    }
};
