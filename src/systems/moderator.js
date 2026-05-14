import { playerStats, ganharXP, receberDano, curar, recuperarTotal } from './player-stats.js';
import { player } from '../entities/jogador.js';
import { battleZoneObjects, limparZonaBatalha } from '../world/mapa.js';
import { atualizarHUD } from '../ui/hud.js';
import { adicionarItem, getItens, CATALOGO } from './inventario.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mainCamera, renderer } from '../core/renderer.js';
import { mudarCena, estado, lojaPlayer, caseloPlayer } from '../core/transicoes.js';
import { lojaScene, lojaColliders, stairsZones, blockedZones, fixedHeightZones } from '../world/loja.js';
import { caseloScene, caseloColliders } from '../world/castelo.js';
import * as THREE from 'three';

/**
 * MODERATOR / DEBUG TOOL
 * Pressiona 'L' para abrir/fechar.
 */

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
    }
};

// --- UI ---
const modUI = document.createElement('div');
modUI.id = 'mod-menu';
modUI.style.cssText = `
    position: fixed; top: 10px; right: 10px;
    width: 260px; max-height: 92vh; overflow-y: auto;
    background: rgba(20, 20, 30, 0.95);
    border: 2px solid #f0d080; border-radius: 8px;
    padding: 0; font-family: 'Courier New', monospace;
    color: #f0d080; z-index: 9999; display: none;
    box-shadow: 0 0 15px rgba(0,0,0,0.8);
    user-select: none;
`;

modUI.innerHTML = `
    <div id="mod-header" style="padding: 10px; cursor: grab; background: rgba(240, 208, 128, 0.1); border-bottom: 1px solid #f0d080; text-align: center; font-weight: bold;">
        DEBUG MENU
    </div>
    
    <div style="padding: 14px;">
        <div id="mod-estado" style="font-size:11px;line-height:1.5;background:rgba(0,0,0,0.4);border:1px solid #6a5020;border-radius:4px;padding:6px 8px;margin-bottom:10px;">—</div>

        <div style="font-size:10px;color:#c8a96e;margin:6px 0 4px 0;letter-spacing:1px;">PROGRESSO</div>
        <div style="margin-bottom:8px;">
            <label style="font-size:11px;">SET LEVEL:</label>
            <div style="display:flex;gap:4px;margin-top:3px;">
                <input type="number" id="mod-lvl-val" value="1" style="flex:1;background:#000;color:#fff;border:1px solid #f0d080;padding:2px;">
                <button id="mod-lvl-btn" style="background:#f0d080;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;">SET</button>
            </div>
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:11px;">ADD XP:</label>
            <div style="display:flex;gap:4px;margin-top:3px;">
                <input type="number" id="mod-xp-val" value="100" style="flex:1;background:#000;color:#fff;border:1px solid #f0d080;padding:2px;">
                <button id="mod-xp-btn" style="background:#f0d080;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;">ADD</button>
            </div>
        </div>

        <div style="font-size:10px;color:#ff9090;margin:10px 0 4px 0;letter-spacing:1px;">VIDA / HP</div>
        <div style="margin-bottom:6px;">
            <label style="font-size:11px;">SET HP:</label>
            <div style="display:flex;gap:4px;margin-top:3px;">
                <input type="number" id="mod-hp-val" value="30" style="flex:1;background:#000;color:#fff;border:1px solid #ff9090;padding:2px;">
                <button id="mod-hp-btn" style="background:#ff9090;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;">SET</button>
            </div>
        </div>
        <div style="margin-bottom:6px;">
            <label style="font-size:11px;">SET MAX HP:</label>
            <div style="display:flex;gap:4px;margin-top:3px;">
                <input type="number" id="mod-maxhp-val" value="30" style="flex:1;background:#000;color:#fff;border:1px solid #ff9090;padding:2px;">
                <button id="mod-maxhp-btn" style="background:#ff9090;border:none;cursor:pointer;padding:3px 8px;font-weight:bold;">SET</button>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;">
            <button id="mod-heal-btn"  style="background:#22cc44;color:#000;border:none;cursor:pointer;padding:5px;font-weight:bold;">FULL HEAL</button>
            <button id="mod-defeat-btn" style="background:#9e1818;color:#fff;border:none;cursor:pointer;padding:5px;font-weight:bold;">DERROTAR</button>
        </div>

        <div style="font-size:10px;color:#a060f0;margin:10px 0 4px 0;letter-spacing:1px;">ITENS</div>
        <button id="mod-toggle-itens" style="width:100%;background:rgba(160, 96, 240, 0.2);color:#a060f0;border:1px solid #a060f0;cursor:pointer;padding:6px;font-weight:bold;margin-bottom:4px;">ABRIR CATÁLOGO DE ITENS</button>
        <div id="mod-itens-panel" style="display:none;background:rgba(0,0,0,0.3);border:1px solid #a060f0;border-radius:4px;padding:8px;margin-bottom:8px;">
            <div id="mod-itens-grid" style="display:flex;flex-direction:column;gap:4px;"></div>
        </div>

        <div style="font-size:10px;color:#c8a96e;margin:10px 0 4px 0;letter-spacing:1px;">CENAS / MUDANÇA</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px;">
            <button id="mod-scene-mundo" style="background:#4a90e2;color:#fff;border:none;cursor:pointer;padding:6px 2px;font-size:10px;font-weight:bold;">MUNDO</button>
            <button id="mod-scene-loja"  style="background:#8b5a2b;color:#fff;border:none;cursor:pointer;padding:6px 2px;font-size:10px;font-weight:bold;">LOJA</button>
            <button id="mod-scene-castelo" style="background:#55506a;color:#fff;border:none;cursor:pointer;padding:6px 2px;font-size:10px;font-weight:bold;">CASTELO</button>
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
            L para fechar
        </div>
    </div>
`;
document.body.appendChild(modUI);

// --- Draggable Logic ---
let isDragging = false;
let offsetX, offsetY;

const header = document.getElementById('mod-header');
header.onmousedown = (e) => {
    isDragging = true;
    header.style.cursor = 'grabbing';
    offsetX = e.clientX - modUI.offsetLeft;
    offsetY = e.clientY - modUI.offsetTop;
};

document.onmousemove = (e) => {
    if (!isDragging) return;
    modUI.style.left = (e.clientX - offsetX) + 'px';
    modUI.style.top = (e.clientY - offsetY) + 'px';
    modUI.style.right = 'auto'; // Disable right lock
};

document.onmouseup = () => {
    isDragging = false;
    header.style.cursor = 'grab';
};

// --- estado ao vivo ---
function renderEstado() {
    const el = document.getElementById('mod-estado');
    if (!el) return;
    const itens = getItens().filter(i => i.quantidade > 0).map(i => `${i.icone} ${i.nome} x${i.quantidade}`).join('<br>') || '<i style="color:#888;">— vazio —</i>';
    el.innerHTML = `
        <span style="color:#ffe080;">Lv ${playerStats.level}</span> ·
        <span style="color:#a0c0ff;">XP ${playerStats.xp}/${playerStats.xpToNext}</span><br>
        <span style="color:#ff9090;">HP ${playerStats.hp}/${playerStats.maxHp}</span>
        ${playerStats.derrotado ? '<span style="color:#ff4040;"> ⟡ DERROTADO ⟡</span>' : ''}
        <span style="color:#c0a060;"> · ATK ${playerStats.atk}</span>
        <hr style="border:0;border-top:1px solid #444;margin:4px 0;">
        <div style="font-size:10px;">${itens}</div>
    `;
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
            <span style="flex:1;font-size:10px;">${it.icone} ${it.nome}</span>
            <button data-add="${id}" data-qtd="1" style="background:#a060f0;color:#fff;border:none;cursor:pointer;padding:2px 6px;font-size:10px;font-weight:bold;">+1</button>
            <button data-add="${id}" data-qtd="5" style="background:#7040c0;color:#fff;border:none;cursor:pointer;padding:2px 6px;font-size:10px;font-weight:bold;">+5</button>
        `;
        grid.appendChild(row);
    }
    grid.querySelectorAll('button[data-add]').forEach(b => {
        b.onclick = () => moderator.addItem(b.dataset.add, b.dataset.qtd);
    });
}

// --- eventos ---
function setupEvents() {
    document.getElementById('mod-lvl-btn').onclick = () => moderator.setLevel(document.getElementById('mod-lvl-val').value);
    document.getElementById('mod-xp-btn').onclick  = () => { moderator.addXP(document.getElementById('mod-xp-val').value); renderEstado(); };
    document.getElementById('mod-hp-btn').onclick  = () => moderator.setHP(document.getElementById('mod-hp-val').value);
    document.getElementById('mod-maxhp-btn').onclick = () => moderator.setMaxHP(document.getElementById('mod-maxhp-val').value);
    document.getElementById('mod-heal-btn').onclick   = () => moderator.fullHeal();
    document.getElementById('mod-defeat-btn').onclick = () => moderator.derrotar();
    document.getElementById('mod-tp-btn').onclick = () => {
        moderator.teleport(
            document.getElementById('mod-tp-x').value,
            document.getElementById('mod-tp-y').value,
            document.getElementById('mod-tp-z').value
        );
    };
    document.getElementById('mod-pos-btn').onclick = () => {
        const p = moderator.getPos();
        const out = document.getElementById('mod-pos-out');
        if (p.cam) {
            out.innerHTML =
                `Player: <b>${p.x}, ${p.y}, ${p.z}</b><br>` +
                `Câmara: <b>${p.cam.x}, ${p.cam.y}, ${p.cam.z}</b><br>` +
                `LookAt: <b>${p.lookAt.x}, ${p.lookAt.y}, ${p.lookAt.z}</b>`;
            console.log(
                `[MOD] Player: (${p.x}, ${p.y}, ${p.z})\n` +
                `[MOD] Camera.position.set(${p.cam.x}, ${p.cam.y}, ${p.cam.z});\n` +
                `[MOD] Camera.lookAt(${p.lookAt.x}, ${p.lookAt.y}, ${p.lookAt.z});`,
            );
        } else {
            out.innerHTML = `X: <b>${p.x}</b>  ·  Y: <b>${p.y}</b>  ·  Z: <b>${p.z}</b>`;
            console.log(`[MOD] Pos: x=${p.x}, y=${p.y}, z=${p.z} (cena: ${estado.cena})`);
        }
        // preenche também os inputs para facilitar copiar / re-tp
        document.getElementById('mod-tp-x').value = p.x;
        document.getElementById('mod-tp-y').value = p.y;
        document.getElementById('mod-tp-z').value = p.z;
    };
    document.getElementById('mod-clear-btn').onclick   = () => moderator.limparZonas();
    document.getElementById('mod-freecam-btn').onclick = () => moderator.toggleFreeCam();
    document.getElementById('mod-noclip-btn').onclick  = () => moderator.toggleNoClip();
    document.getElementById('mod-coll-btn').onclick    = () => moderator.toggleColliders();

    // Toggle de itens
    const toggleItens = document.getElementById('mod-toggle-itens');
    const itensPanel = document.getElementById('mod-itens-panel');
    toggleItens.onclick = () => {
        const isVisible = itensPanel.style.display === 'block';
        itensPanel.style.display = isVisible ? 'none' : 'block';
        toggleItens.textContent = isVisible ? 'ABRIR CATÁLOGO DE ITENS' : 'FECHAR CATÁLOGO DE ITENS';
        if (!isVisible) renderItensGrid();
    };

    // Scene Switcher
    document.getElementById('mod-scene-mundo').onclick = () => moderator.switchScene('mundo');
    document.getElementById('mod-scene-loja').onclick = () => moderator.switchScene('loja');
    document.getElementById('mod-scene-castelo').onclick = () => moderator.switchScene('caselo');
}

// --- TOGGLE COM L ---
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'l') {
        moderator.isOpen = !moderator.isOpen;
        modUI.style.display = moderator.isOpen ? 'block' : 'none';
        if (moderator.isOpen) {
            setupEvents();
            renderEstado();
            // reflectir HP/MaxHP actuais nos inputs ao abrir
            document.getElementById('mod-hp-val').value    = playerStats.hp;
            document.getElementById('mod-maxhp-val').value = playerStats.maxHp;
            document.getElementById('mod-lvl-val').value   = playerStats.level;
        }
    }
});

// auto-refresh quando o menu está aberto
setInterval(() => { if (moderator.isOpen) renderEstado(); }, 500);

console.log("%c[MODERADOR] Pressiona 'L' para abrir.", "color:#f0d080;font-weight:bold;");

export default moderator;
