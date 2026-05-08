import { playerStats, ganharXP } from './player-stats.js';
import { player } from '../entities/jogador.js';
import { battleZoneObjects, limparZonaBatalha } from '../world/mapa.js';
import { atualizarHUD } from '../ui/hud.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mainCamera, renderer } from '../core/renderer.js';

/**
 * MODERATOR / DEBUG TOOL - INTEGRATED UI
 * Pressiona 'L' para abrir/fechar.
 */

const moderator = {
    isOpen: false,
    freeCam: false,
    controls: null,
    
    // --- LÓGICA ---
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
        console.log(`[MOD] Free Cam: ${this.freeCam ? 'ON' : 'OFF'}`);
    },

    setLevel(val) {
        playerStats.level = parseInt(val) || 1;
        atualizarHUD();
        console.log(`[MOD] Nível alterado para: ${playerStats.level}`);
    },

    addXP(amount) {
        ganharXP(parseInt(amount) || 0);
        console.log(`[MOD] Adicionado ${amount} XP.`);
    },

    teleport(x, z) {
        player.position.x = parseFloat(x) || 0;
        player.position.z = parseFloat(z) || 0;
        console.log(`[MOD] Teleportado para: ${x}, ${z}`);
    },

    limparZonas() {
        const count = battleZoneObjects.length;
        while (battleZoneObjects.length > 0) {
            const zo = battleZoneObjects[0];
            limparZonaBatalha(zo.box.min.x + 1, zo.box.min.z + 1);
        }
        console.log(`[MOD] ${count} zonas de batalha limpas.`);
    }
};

// --- CRIAÇÃO DA UI ---
const modUI = document.createElement('div');
modUI.id = 'mod-menu';
modUI.style.cssText = `
    position: fixed; top: 10px; right: 10px;
    width: 220px; background: rgba(20, 20, 30, 0.95);
    border: 2px solid #f0d080; border-radius: 8px;
    padding: 15px; font-family: 'Courier New', monospace;
    color: #f0d080; z-index: 9999; display: none;
    box-shadow: 0 0 15px rgba(0,0,0,0.8);
`;

modUI.innerHTML = `
    <h3 style="margin: 0 0 15px 0; text-align: center; border-bottom: 1px solid #f0d080; padding-bottom: 5px;">DEBUG MENU</h3>
    
    <div style="margin-bottom: 10px;">
        <label style="font-size: 11px;">SET LEVEL:</label><br>
        <input type="number" id="mod-lvl-val" value="1" style="width: 60px; background: #000; color: #fff; border: 1px solid #f0d080; padding: 2px;">
        <button id="mod-lvl-btn" style="background: #f0d080; border: none; cursor: pointer; padding: 3px 8px; font-weight: bold; float: right;">SET</button>
    </div>

    <div style="margin-bottom: 10px;">
        <label style="font-size: 11px;">ADD XP:</label><br>
        <input type="number" id="mod-xp-val" value="100" style="width: 60px; background: #000; color: #fff; border: 1px solid #f0d080; padding: 2px;">
        <button id="mod-xp-btn" style="background: #f0d080; border: none; cursor: pointer; padding: 3px 8px; font-weight: bold; float: right;">ADD</button>
    </div>

    <div style="margin-bottom: 15px;">
        <label style="font-size: 11px;">TELEPORT (X, Z):</label><br>
        <div style="display: flex; gap: 4px; margin-top: 4px;">
            <input type="number" id="mod-tp-x" placeholder="X" style="width: 50px; background: #000; color: #fff; border: 1px solid #f0d080; padding: 2px;">
            <input type="number" id="mod-tp-z" placeholder="Z" style="width: 50px; background: #000; color: #fff; border: 1px solid #f0d080; padding: 2px;">
            <button id="mod-tp-btn" style="background: #f0d080; border: none; cursor: pointer; padding: 3px 8px; font-weight: bold;">GO</button>
        </div>
    </div>

    <button id="mod-clear-btn" style="width: 100%; background: #9e3b45; color: #fff; border: 1px solid #f0d080; cursor: pointer; padding: 6px; font-weight: bold; margin-bottom: 10px;">LIMPAR ZONAS</button>
    
    <button id="mod-freecam-btn" style="width: 100%; background: #f0d080; color: #000; border: 1px solid #000; cursor: pointer; padding: 8px; font-weight: bold; margin-bottom: 10px;">FREE CAM: OFF</button>

    <div style="font-size: 10px; color: #888; text-align: center; border-top: 1px solid #444; padding-top: 5px;">
        Pressiona 'L' para fechar
    </div>
`;

document.body.appendChild(modUI);

// --- EVENTOS DA UI ---
function setupEvents() {
    document.getElementById('mod-lvl-btn').onclick = () => {
        const val = document.getElementById('mod-lvl-val').value;
        moderator.setLevel(val);
    };

    document.getElementById('mod-xp-btn').onclick = () => {
        const val = document.getElementById('mod-xp-val').value;
        moderator.addXP(val);
    };

    document.getElementById('mod-tp-btn').onclick = () => {
        const x = document.getElementById('mod-tp-x').value;
        const z = document.getElementById('mod-tp-z').value;
        moderator.teleport(x, z);
    };

    document.getElementById('mod-clear-btn').onclick = () => {
        moderator.limparZonas();
    };

    document.getElementById('mod-freecam-btn').onclick = () => {
        moderator.toggleFreeCam();
    };
}

// TOGGLE COM TECLA L
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'l') {
        moderator.isOpen = !moderator.isOpen;
        modUI.style.display = moderator.isOpen ? 'block' : 'none';
        if (moderator.isOpen) {
            setupEvents(); // Re-garante os cliques ao abrir
        }
    }
});

console.log("%c[MODERADOR] Menu Visual integrado! Pressiona 'L' para abrir.", "color: #f0d080; font-weight: bold;");

export default moderator;
