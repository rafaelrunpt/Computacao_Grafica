import { playerStats, ganharXP, receberDano, curar, recuperarTotal } from './player-stats.js';
import { skipTurnoPlayer, estadoJogo } from './combate.js';
import { player } from '../entities/jogador.js';
import { battleZoneObjects, limparZonaBatalha } from '../world/mapa.js';
import { atualizarHUD } from '../ui/hud.js';
import { adicionarItem, getItens, CATALOGO } from './inventario.js';
import { getCintilas, ganharCintilas, setCintilas } from './currency.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mainCamera, renderer } from '../core/renderer.js';
import { mudarCena, estado, lojaPlayer, caseloPlayer } from '../core/transicoes.js';
import { lojaScene, lojaColliders, stairsZones, blockedZones, fixedHeightZones } from '../world/loja.js';
import { caseloScene, caseloColliders } from '../world/castelo.js';
import * as THREE from 'three';
import { setDebugModel, getDebugModelos, getDebugModeloAtivo } from '../world/boss-debug-scene.js';


if (typeof _lightRegistry === 'undefined') {
    var _lightRegistry = {};
}

export function registerLight(sceneName, lightName, lightObject) {
    if (typeof _lightRegistry === 'undefined') _lightRegistry = {}; // Guard against circular load TDZ/hoisting issues
    if (!_lightRegistry[sceneName]) {
        _lightRegistry[sceneName] = [];
    }
    // Adiciona apenas se uma luz com o mesmo nome não existir
    if (!_lightRegistry[sceneName].some(l => l.name === lightName)) {
        console.log(`[MOD] Registo de luz: ${sceneName} -> ${lightName}`);
        _lightRegistry[sceneName].push({
            name: lightName,
            light: lightObject,
            initialVisibility: lightObject.visible
        });
    }
}

const moderator = {
    isOpen: false,
    freeCam: false,
    controls: null,
    noClip: false,   // ignora colisões (loja / castelo / mundo)
    lockY: false,    // impede o gameplay de sobrescrever player.userData.baseY
    colliderHelpers: [],

    toggleNoClip() {
        this.noClip = !this.noClip;
        this.lockY = this.noClip; // godmode: também trava o Y
        const btn = document.getElementById('mod-noclip-btn');
        btn.style.background = this.noClip ? '#22cc44' : '#3a3a4a';
        btn.style.color = this.noClip ? '#000' : '#f0d080';
        btn.textContent = this.noClip ? '🚀 NOCLIP: ON' : '🚀 NOCLIP: OFF';
    },

    toggleColliders() {
        const btn = document.getElementById('mod-coll-btn');
        // Limpar helpers anteriores
        if (this.colliderHelpers.length > 0) {
            for (const { helper, scene } of this.colliderHelpers) scene.remove(helper);
            this.colliderHelpers = [];
            btn.style.background = '#3a3a4a';
            btn.textContent = '👁 VER COLISORES';
            return;
        }
        let aabbList = [];
        let stairsList = [];
        let blockedList = [];
        let fixedList = [];
        let scene = null;
        if (estado.cena === 'loja')        { aabbList = lojaColliders; stairsList = stairsZones; blockedList = blockedZones; fixedList = fixedHeightZones; scene = lojaScene; }
        else if (estado.cena === 'caselo') { aabbList = caseloColliders; scene = caseloScene; }
        if (!scene) {
            console.log('[MOD] Visualização só funciona em loja/castelo.');
            return;
        }
        // Colisores (vermelho)
        for (const box of aabbList) {
            const helper = new THREE.Box3Helper(box, 0xff3030);
            scene.add(helper);
            this.colliderHelpers.push({ helper, scene });
        }
        // Zonas de escadas (verde)
        for (const box of stairsList) {
            const helper = new THREE.Box3Helper(box, 0x33ff66);
            scene.add(helper);
            this.colliderHelpers.push({ helper, scene });
        }
        // Zonas bloqueadas (laranja)
        for (const box of blockedList) {
            const helper = new THREE.Box3Helper(box, 0xff8800);
            scene.add(helper);
            this.colliderHelpers.push({ helper, scene });
        }
        // Zonas de altura fixa / pontes (azul)
        for (const zone of fixedList) {
            const helper = new THREE.Box3Helper(zone.box, 0x40a0ff);
            scene.add(helper);
            this.colliderHelpers.push({ helper, scene });
        }
        btn.style.background = '#22cc44';
        btn.style.color = '#000';
        btn.textContent = `👁 ${blockedList.length}b / ${fixedList.length}f`;
        console.log(`[MOD] cena ${estado.cena}: ${blockedList.length} bloqueadas (laranja), ${fixedList.length} pontes (azul).`);
    },

    toggleFreeCam() {
        this.freeCam = !this.freeCam;
        const btn = document.getElementById('mod-freecam-btn');

        if (this.freeCam) {
            btn.style.background = '#4CAF50';
            btn.textContent = 'FREE CAM: ON';
            this.controls = new OrbitControls(mainCamera, renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.target.copy(player.position);
        } else {
            btn.style.background = '#f0d080';
            btn.textContent = 'FREE CAM: OFF';
            if (this.controls) {
                this.controls.dispose();
                this.controls = null;
            }
        }
    },

    setLevel(val) {
        playerStats.level = parseInt(val) || 1;
        atualizarHUD();
    },

    addXP(amount) { ganharXP(parseInt(amount) || 0); },

    teleport(x, y, z) {
        const nx = parseFloat(x); const ny = parseFloat(y); const nz = parseFloat(z);
        if (!Number.isNaN(nx)) player.position.x = nx;
        if (!Number.isNaN(ny)) {
            player.position.y = ny;
            player.userData.baseY = ny; // base que a animação respeita
        }
        if (!Number.isNaN(nz)) player.position.z = nz;
        // Se estivermos numa cena interior, temos de atualizar os objetos de estado para o loop de animação não dar reset
        if (estado.cena === 'loja') {
            lojaPlayer.x = player.position.x;
            lojaPlayer.y = player.position.y;
            lojaPlayer.z = player.position.z;
        } else if (estado.cena === 'caselo') {
            caseloPlayer.x = player.position.x;
            caseloPlayer.y = player.position.y;
            caseloPlayer.z = player.position.z;
        }
    },

    getPos() {
        const out = {
            x: player.position.x.toFixed(2),
            y: player.position.y.toFixed(2),
            z: player.position.z.toFixed(2),
        };
        if (this.freeCam && this.controls) {
            out.cam = {
                x: mainCamera.position.x.toFixed(2),
                y: mainCamera.position.y.toFixed(2),
                z: mainCamera.position.z.toFixed(2),
            };
            out.lookAt = {
                x: this.controls.target.x.toFixed(2),
                y: this.controls.target.y.toFixed(2),
                z: this.controls.target.z.toFixed(2),
            };
        }
        return out;
    },

    limparZonas() {
        const count = battleZoneObjects.length;
        while (battleZoneObjects.length > 0) {
            const zo = battleZoneObjects[0];
            limparZonaBatalha(zo.box.min.x + 1, zo.box.min.z + 1);
        }
        console.log(`[MOD] ${count} zonas limpas.`);
    },

    setHP(val) {
        const v = parseInt(val);
        if (Number.isNaN(v)) return;
        const dif = playerStats.hp - v;
        if (dif > 0) receberDano(dif);
        else if (dif < 0) curar(-dif);
        // se passou de 0 manualmente, levanta a flag
        if (playerStats.hp > 0) playerStats.derrotado = false;
        atualizarHUD();
        renderEstado();
    },

    setMaxHP(val) {
        const v = Math.max(1, parseInt(val) || 1);
        playerStats.maxHp = v;
        if (playerStats.hp > v) playerStats.hp = v;
        atualizarHUD();
        renderEstado();
    },

    fullHeal() {
        recuperarTotal();
        atualizarHUD();
        renderEstado();
    },

    derrotar() {
        receberDano(playerStats.hp); // hp -> 0, derrotado = true
        atualizarHUD();
        renderEstado();
    },

    addItem(id, qtd) {
        adicionarItem(id, parseInt(qtd) || 1);
        renderEstado();
    },

    switchScene(target) {
        mudarCena(target);
    },

    // Abre o debug viewer de modelos e mostra o modelo escolhido.
    verModelo(nome) {
        setDebugModel(nome);
        mudarCena('boss_debug');
    }
};

// --- estado ao vivo ---
function renderEstado() {
    const el = document.getElementById('mod-estado');
    if (!el) return;
    try {
        const iconHtml = (ic) => (typeof ic === 'string' && (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.includes('/')))
            ? `<img src="${ic}" style="width:14px;height:14px;object-fit:contain;vertical-align:middle;">`
            : (typeof ic === 'string' ? ic : '');
        const itens = getItens().filter(i => i.quantidade > 0).map(i => `${iconHtml(i.icone)} ${i.nome} x${i.quantidade}`).join('<br>') || '<i style="color:#888;">— vazio —</i>';
        el.innerHTML = `
            <span style="color:#ffe080;">Lv ${playerStats.level}</span> ·
            <span style="color:#a0c0ff;">XP ${playerStats.xp}/${playerStats.xpToNext}</span><br>
            <span style="color:#ff9090;">HP ${playerStats.hp}/${playerStats.maxHp}</span>
            ${playerStats.derrotado ? '<span style="color:#ff4040;"> ⟡ DERROTADO ⟡</span>' : ''}
            <span style="color:#c0a060;"> · ATK ${playerStats.atk}</span><br>
            <span style="color:#80c8ff;">✦ ${getCintilas()} cintilas</span>
            <hr style="border:0;border-top:1px solid #444;margin:4px 0;">
            <div style="font-size:10px;">${itens}</div>
        `;
    } catch (err) {
        console.error('[MOD] Erro ao renderizar estado:', err);
        el.innerHTML = '<span style="color:#f44;">Erro ao carregar stats</span>';
    }
}

// --- grelha de adicionar itens, gerada do CATÁLOGO ---
function renderItensGrid() {
    const grid = document.getElementById('mod-itens-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const id of Object.keys(CATALOGO)) {
        const it = CATALOGO[id];
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:4px;align-items:center;padding:2px 0;border-bottom:1px solid rgba(240,208,128,0.1);';
        row.innerHTML = `
            <span style="flex:1;font-size:10px;display:flex;align-items:center;gap:4px;">${(it.icone && (it.icone.endsWith('.png') || it.icone.endsWith('.jpg') || it.icone.includes('/'))) ? `<img src="${it.icone}" style="width:14px;height:14px;object-fit:contain;">` : (it.icone || '')} ${it.nome}</span>
            <button data-add="${id}" data-qtd="1" style="background:#a060f0;color:#fff;border:none;cursor:pointer;padding:2px 6px;font-size:10px;font-weight:bold;">+1</button>
            <button data-add="${id}" data-qtd="5" style="background:#7040c0;color:#fff;border:none;cursor:pointer;padding:2px 6px;font-size:10px;font-weight:bold;">+5</button>
        `;
        grid.appendChild(row);
    }
    grid.querySelectorAll('button[data-add]').forEach(b => {
        b.onclick = () => moderator.addItem(b.dataset.add, b.dataset.qtd);
    });
}

// --- grelha de modelos do debug viewer (boss / núcleo / wraith) ---
function renderModelosGrid() {
    const grid = document.getElementById('mod-modelos-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const ativo = getDebugModeloAtivo();
    for (const m of getDebugModelos()) {
        const sel = m.id === ativo;
        const b = document.createElement('button');
        b.textContent = (sel ? '▸ ' : '') + m.label;
        b.style.cssText =
            `background:${sel ? '#ffd060' : '#7a3ad0'};color:${sel ? '#000' : '#fff'};` +
            `border:none;cursor:pointer;padding:7px;font-size:11px;font-weight:bold;`;
        b.onclick = () => { moderator.verModelo(m.id); renderModelosGrid(); };
        grid.appendChild(b);
    }
}

// --- eventos ---
function setupEvents() {
    const _on = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };

    _on('mod-lvl-btn', () => moderator.setLevel(document.getElementById('mod-lvl-val').value));
    _on('mod-xp-btn',  () => { moderator.addXP(document.getElementById('mod-xp-val').value); renderEstado(); });
    _on('mod-hp-btn',  () => moderator.setHP(document.getElementById('mod-hp-val').value));
    _on('mod-maxhp-btn', () => moderator.setMaxHP(document.getElementById('mod-maxhp-val').value));
    _on('mod-heal-btn',   () => moderator.fullHeal());
    _on('mod-defeat-btn', () => moderator.derrotar());
    _on('mod-skip-turno-btn', () => {
        const btn = document.getElementById('mod-skip-turno-btn');
        if (!estadoJogo.emCombate) {
            if (btn) { btn.textContent = '⏭ SEM COMBATE ACTIVO'; setTimeout(() => { btn.textContent = '⏭ SKIP TURNO'; }, 1200); }
            return;
        }
        skipTurnoPlayer();
    });

    // --- cintilas ---
    _on('mod-cint-btn', () => {
        const el = document.getElementById('mod-cint-val');
        const v = parseInt(el ? el.value : '0', 10) || 0;
        setCintilas(Math.max(0, v));
        renderEstado();
    });
    _on('mod-cint-add-50',   () => { ganharCintilas(50);   renderEstado(); });
    _on('mod-cint-add-200',  () => { ganharCintilas(200);  renderEstado(); });
    _on('mod-cint-add-1000', () => { ganharCintilas(1000); renderEstado(); });
    _on('mod-cint-zero',     () => { setCintilas(0);       renderEstado(); });

    _on('mod-tp-btn', () => {
        moderator.teleport(
            document.getElementById('mod-tp-x').value,
            document.getElementById('mod-tp-y').value,
            document.getElementById('mod-tp-z').value
        );
    });

    _on('mod-pos-btn', () => {
        const p = moderator.getPos();
        const out = document.getElementById('mod-pos-out');
        if (!out) return;
        if (p.cam) {
            out.innerHTML =
                `Player: <b>${p.x}, ${p.y}, ${p.z}</b><br>` +
                `Câmara: <b>${p.cam.x}, ${p.cam.y}, ${p.cam.z}</b><br>` +
                `LookAt: <b>${p.lookAt.x}, ${p.lookAt.y}, ${p.lookAt.z}</b>`;
        } else {
            out.innerHTML = `X: <b>${p.x}</b>  ·  Y: <b>${p.y}</b>  ·  Z: <b>${p.z}</b>`;
        }
        // preenche também os inputs para facilitar copiar / re-tp
        if (document.getElementById('mod-tp-x')) document.getElementById('mod-tp-x').value = p.x;
        if (document.getElementById('mod-tp-y')) document.getElementById('mod-tp-y').value = p.y;
        if (document.getElementById('mod-tp-z')) document.getElementById('mod-tp-z').value = p.z;
    });

    _on('mod-clear-btn',   () => moderator.limparZonas());
    _on('mod-freecam-btn', () => moderator.toggleFreeCam());
    _on('mod-noclip-btn',  () => moderator.toggleNoClip());
    _on('mod-coll-btn',    () => moderator.toggleColliders());

    // Toggle de itens
    const toggleItens = document.getElementById('mod-toggle-itens');
    const itensPanel = document.getElementById('mod-itens-panel');
    if (toggleItens && itensPanel) {
        toggleItens.onclick = () => {
            const isVisible = itensPanel.style.display === 'block';
            itensPanel.style.display = isVisible ? 'none' : 'block';
            toggleItens.textContent = isVisible ? 'ABRIR CATÁLOGO DE ITENS' : 'FECHAR CATÁLOGO DE ITENS';
            if (!isVisible) renderItensGrid();
        };
    }

    // Scene Switcher
    _on('mod-scene-mundo',   () => moderator.switchScene('mundo'));
    _on('mod-scene-loja',    () => moderator.switchScene('loja'));
    _on('mod-scene-castelo', () => moderator.switchScene('caselo'));
}

function renderLuzesGrid() {
    const panel = document.getElementById('mod-luzes-panel');
    if (!panel) return;
    panel.innerHTML = '';
    
    const keys = Object.keys(_lightRegistry || {});
    console.log(`[MOD] renderLuzesGrid: ${keys.length} categorias encontradas.`);

    if (keys.length === 0) {
        panel.innerHTML = '<div style="font-size:10px;color:#888;text-align:center;">Nenhuma luz registada.</div>';
        return;
    }

    for (const sceneName in _lightRegistry) {
        const lights = _lightRegistry[sceneName];
        console.log(`[MOD]   - ${sceneName}: ${lights.length} luzes.`);
        const sceneHeader = document.createElement('div');
        sceneHeader.style.cssText = 'font-size:10px; color:#a0c0ff; border-bottom:1px solid #666; margin-bottom:4px; padding-bottom:2px; text-transform:uppercase;';
        sceneHeader.textContent = sceneName;
        panel.appendChild(sceneHeader);

        _lightRegistry[sceneName].forEach(lightEntry => {
            const { name, light } = lightEntry;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:11px;';
            row.innerHTML = `
                <label style="cursor:pointer; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" class="mod-light-toggle" data-scene="${sceneName}" data-name="${name}" ${light.visible ? 'checked' : ''}>
                    ${name}
                </label>
            `;
            panel.appendChild(row);
        });
    }
}

// --- bindings ---
function _buildPanel() {
    if (document.getElementById('mod-panel')) {
        document.getElementById('mod-panel').style.display = 'block';
        try {
            renderEstado();
            renderItensGrid();
            renderModelosGrid();
            renderLuzesGrid();
        } catch (err) {
            console.error('[MOD] Erro no refresh inicial:', err);
        }
        return;
    }
    const modUI = document.createElement('div');
    modUI.id = 'mod-panel';
    modUI.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 240px;
        max-height: 85vh;
        overflow-y: auto;
        background: rgba(20, 10, 0, 0.9);
        color: #f0d080;
        border: 2px solid #d4a830;
        border-radius: 8px;
        padding: 10px;
        z-index: 10000;
        pointer-events: auto !important;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        box-shadow: 0 0 20px rgba(0,0,0,0.8);
        display: none;
    `;
    modUI.innerHTML = `
        <div id="mod-header" style="background:#421;color:#f0d080;padding:6px;text-align:center;font-weight:bold;letter-spacing:2px;cursor:grab;margin:-10px -10px 8px -10px;border-radius:6px 6px 0 0;position:sticky;top:-10px;z-index:11;">⚜ MODERATOR ⚜</div>
        
        <div id="mod-estado" style="background:rgba(0,0,0,0.3);border:1px solid #8b5a2b;border-radius:4px;padding:8px;margin-bottom:8px;font-size:11px;line-height:1.5;"></div>

        <div style="font-size:10px;color:#f0a060;margin:10px 0 4px 0;letter-spacing:1px;">JOGADOR</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;">
            <input type="number" id="mod-hp-val"    placeholder="HP" style="width:100%;box-sizing:border-box;background:#000;color:#ff9090;border:1px solid #f0a060;padding:4px;">
            <button id="mod-hp-btn" style="width:100%;background:#f0a060;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;">SET</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;">
            <input type="number" id="mod-maxhp-val" placeholder="MaxHP" style="width:100%;box-sizing:border-box;background:#000;color:#ff9090;border:1px solid #f0a060;padding:4px;">
            <button id="mod-maxhp-btn" style="width:100%;background:#f0a060;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;">SET</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;">
            <input type="number" id="mod-xp-val" placeholder="XP" style="width:100%;box-sizing:border-box;background:#000;color:#a0c0ff;border:1px solid #f0a060;padding:4px;">
            <button id="mod-xp-btn" style="width:100%;background:#a0c0ff;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;color:#000;">ADD</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;">
            <input type="number" id="mod-lvl-val" placeholder="Lvl" style="width:100%;box-sizing:border-box;background:#000;color:#ffe080;border:1px solid #f0a060;padding:4px;">
            <button id="mod-lvl-btn" style="width:100%;background:#ffe080;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;color:#000;">SET</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;">
            <button id="mod-heal-btn"   style="background:#3ac850;color:#000;border:none;cursor:pointer;padding:5px 2px;font-size:10px;font-weight:bold;">CURA TOTAL</button>
            <button id="mod-defeat-btn" style="background:#9e3b45;color:#fff;border:none;cursor:pointer;padding:5px 2px;font-size:10px;font-weight:bold;">DERROTAR</button>
        </div>

        <div style="font-size:10px;color:#ff8040;margin:10px 0 4px 0;letter-spacing:1px;">COMBATE</div>
        <button id="mod-skip-turno-btn" style="width:100%;background:#3a3a4a;color:#ff8040;border:1px solid #ff8040;cursor:pointer;padding:6px;font-weight:bold;margin-bottom:8px;">⏭ SKIP TURNO</button>

        <div style="font-size:10px;color:#80c8ff;margin:10px 0 4px 0;letter-spacing:1px;">MOEDA</div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:4px;margin-bottom:4px;">
            <input type="number" id="mod-cint-val" placeholder="Cintilas" style="width:100%;box-sizing:border-box;background:#000;color:#80c8ff;border:1px solid #80c8ff;padding:4px;">
            <button id="mod-cint-btn" style="width:100%;background:#80c8ff;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;color:#000;">SET</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;margin-bottom:8px;">
            <button id="mod-cint-add-50"   style="background:#3a80c0;color:#fff;border:none;cursor:pointer;padding:5px 2px;font-size:10px;font-weight:bold;">+50</button>
            <button id="mod-cint-add-200"  style="background:#3a80c0;color:#fff;border:none;cursor:pointer;padding:5px 2px;font-size:10px;font-weight:bold;">+200</button>
            <button id="mod-cint-add-1000" style="background:#3a80c0;color:#fff;border:none;cursor:pointer;padding:5px 2px;font-size:10px;font-weight:bold;">+1k</button>
            <button id="mod-cint-zero"    style="background:#9e3b45;color:#fff;border:none;cursor:pointer;padding:5px 2px;font-size:10px;font-weight:bold;">ZERAR</button>
        </div>

        <div style="font-size:10px;color:#a060f0;margin:10px 0 4px 0;letter-spacing:1px;">ITENS</div>
        <button id="mod-toggle-itens" style="width:100%;background:rgba(160, 96, 240, 0.2);color:#a060f0;border:1px solid #a060f0;cursor:pointer;padding:6px;font-weight:bold;margin-bottom:4px;">ABRIR CATÁLOGO DE ITENS</button>
        <div id="mod-itens-panel" style="display:none;background:rgba(0,0,0,0.3);border:1px solid #a060f0;border-radius:4px;padding:8px;margin-bottom:8px;">
            <div id="mod-itens-grid" style="display:flex;flex-direction:column;gap:4px;"></div>
        </div>

        <div style="font-size:10px;color:#c8a96e;margin:10px 0 4px 0;letter-spacing:1px;">CENAS / MUDANÇA</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:4px;">
            <button id="mod-scene-mundo" style="background:#4a90e2;color:#fff;border:none;cursor:pointer;padding:6px 2px;font-size:10px;font-weight:bold;">MUNDO</button>
            <button id="mod-scene-loja"  style="background:#8b5a2b;color:#fff;border:none;cursor:pointer;padding:6px 2px;font-size:10px;font-weight:bold;">LOJA</button>
            <button id="mod-scene-castelo" style="background:#55506a;color:#fff;border:none;cursor:pointer;padding:6px 2px;font-size:10px;font-weight:bold;">CASTELO</button>
        </div>
        <div style="font-size:10px;color:#cc88ff;margin:10px 0 4px 0;letter-spacing:1px;">🔬 DEBUG DE MODELOS</div>
        <div id="mod-modelos-grid" style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;"></div>

        <div style="font-size:10px;color:#ffe080;margin:10px 0 4px 0;letter-spacing:1px;">💡 LUZES</div>
        <div id="mod-luzes-panel" style="background:rgba(0,0,0,0.3);border:1px solid #ffe080;border-radius:4px;padding:8px;margin-bottom:8px;display:flex;flex-direction:column;gap:4px;">
            <!-- As luzes serão inseridas aqui -->
        </div>

        <div style="font-size:10px;color:#c8a96e;margin:10px 0 4px 0;letter-spacing:1px;">UTILIDADES</div>
        <div style="margin-bottom:8px;">
            <label style="font-size:11px;">TELEPORT (X, Y, Z):</label>
            <div style="display:flex;gap:4px;margin-top:3px;">
                <input type="number" step="0.1" id="mod-tp-x" placeholder="X" style="width:42px;background:#000;color:#fff;border:1px solid #f0d080;padding:2px;">
                <input type="number" step="0.1" id="mod-tp-y" placeholder="Y" style="width:42px;background:#000;color:#fff;border:1px solid #f0d080;padding:2px;">
                <input type="number" step="0.1" id="mod-tp-z" placeholder="Z" style="width:42px;background:#000;color:#fff;border:1px solid #f0d080;padding:2px;">
                <button id="mod-tp-btn" style="flex:1;background:#f0d080;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;">GO</button>
            </div>
            <button id="mod-pos-btn" style="width:100%;margin-top:4px;background:#3a3a4a;color:#f0d080;border:1px solid #f0d080;cursor:pointer;padding:5px;font-weight:bold;font-size:11px;">📍 MOSTRAR POSIÇÃO ATUAL</button>
            <div id="mod-pos-out" style="font-size:10px;color:#a0c0ff;background:rgba(0,0,0,0.4);border:1px solid #6a5020;border-radius:4px;padding:4px 6px;margin-top:4px;text-align:center;">—</div>
        </div>

        <button id="mod-clear-btn"   style="width:100%;background:#9e3b45;color:#fff;border:1px solid #f0d080;cursor:pointer;padding:6px;font-weight:bold;margin-bottom:6px;">LIMPAR ZONAS</button>
        <button id="mod-freecam-btn" style="width:100%;background:#f0d080;color:#000;border:1px solid #000;cursor:pointer;padding:8px;font-weight:bold;margin-bottom:6px;">FREE CAM: OFF</button>
        <button id="mod-noclip-btn"  style="width:100%;background:#3a3a4a;color:#f0d080;border:1px solid #f0d080;cursor:pointer;padding:8px;font-weight:bold;margin-bottom:6px;">🚀 NOCLIP: OFF</button>
        <button id="mod-coll-btn"    style="width:100%;background:#3a3a4a;color:#f0d080;border:1px solid #f0d080;cursor:pointer;padding:6px;font-weight:bold;margin-bottom:8px;">👁 VER COLISORES</button>

        <div style="font-size:10px;color:#888;text-align:center;border-top:1px solid #444;padding-top:5px;">
            Ç para fechar
        </div>
    `;
    modUI.addEventListener('mousedown', (e) => e.stopPropagation());
    modUI.addEventListener('click', (e) => e.stopPropagation());
    modUI.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });
    document.body.appendChild(modUI);

    // --- Draggable Logic ---
    let isDragging = false;
    let dragStartX, dragStartY;
    let initialX, initialY;

    const header = modUI.querySelector('#mod-header');
    if (header) {
        header.style.cursor = 'grab';
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            header.style.cursor = 'grabbing';
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            initialX = modUI.offsetLeft;
            initialY = modUI.offsetTop;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            modUI.style.left = (initialX + dx) + 'px';
            modUI.style.top = (initialY + dy) + 'px';
            modUI.style.right = 'auto'; // Disable right lock
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'grab';
        });
    }

    const panel = document.getElementById('mod-luzes-panel');
    if (panel) {
        panel.addEventListener('change', (e) => {
            if (e.target.classList.contains('mod-light-toggle')) {
                const sceneName = e.target.dataset.scene;
                const lightName = e.target.dataset.name;
                const entry = _lightRegistry[sceneName]?.find(l => l.name === lightName);
                if (entry) {
                    entry.light.visible = e.target.checked;
                }
            }
        });
    }
}

// --- TOGGLE COM Ç ou L ---
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'ç' || key === 'l') {
        moderator.isOpen = !moderator.isOpen;
        const modUI = document.getElementById('mod-panel');
        if (!modUI) {
            _buildPanel(); // build if not present
        }
        const modUIFinal = document.getElementById('mod-panel');
        if (modUIFinal) {
            modUIFinal.style.display = moderator.isOpen ? 'block' : 'none';
        }
        if (moderator.isOpen) {
            try {
                setupEvents();
                renderEstado();
                renderModelosGrid();
                renderLuzesGrid();
            } catch (err) {
                console.error('[MOD] Erro ao abrir painel:', err);
            }
            // reflectir HP/MaxHP/cintilas actuais nos inputs ao abrir
            const hpVal = document.getElementById('mod-hp-val');
            if (hpVal) hpVal.value = playerStats.hp;
            const maxHpVal = document.getElementById('mod-maxhp-val');
            if (maxHpVal) maxHpVal.value = playerStats.maxHp;
            const lvlVal = document.getElementById('mod-lvl-val');
            if (lvlVal) lvlVal.value = playerStats.level;
            const cintVal = document.getElementById('mod-cint-val');
            if (cintVal) cintVal.value = getCintilas();
        }
    }
});

// auto-refresh quando o menu está aberto
setInterval(() => { if (moderator.isOpen) renderEstado(); }, 500);

console.log("%c[MODERADOR] Pressiona 'L' ou 'Ç' para abrir.", "color:#f0d080;font-weight:bold;");

export default moderator;
