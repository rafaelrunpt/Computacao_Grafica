// Suporte de gamepad (Standard Gamepad API). Espelha o estado do comando
// no objecto `keys` que o resto do jogo já consome — não toca em lógica de
// movimento ou cenas.
//
// Fase 1: mundo exterior + interacções básicas. Menus complexos (inventário,
// loja, loadout) continuam por rato/teclado.
//
// Mapeamento (layout standard, Xbox/PS):
//   Stick esquerdo (axes 0,1)   → WASD          (deadzone 0.35)
//   D-pad (botões 12-15)        → WASD          (cumulativo, fallback)
//   A (0)                       → E  (interagir)
//   B (1)                       → Esc (pausa)
//   Y (3)                       → I  (inventário)
//   X (2)                       → B  (livro de missões)
//   LB (4)                      → V  (loadout)
//   RB (5)                      → M  (mapa)
//   Start (9)                   → P  (pausa)
//   Back/Select (8)             → N  (tocha)

import { keys } from './input.js';
import { settings, onSettingChange } from '../systems/settings.js';

const DEADZONE = 0.35;

// Callbacks de toggle — registadas via registarCallbacksGamepad pelo
// main.js para nós podermos invocá-las directamente em botões "one-shot"
// (sem ter de simular um keydown DOM).
let _onTogglePause = null;
let _onToggleMapa = null;
let _onToggleInventario = null;
let _onToggleQuestBook = null;
let _onToggleTocha = null;
let _onToggleLoadout = null;
export function registarCallbacksGamepad(cbs) {
    _onTogglePause = cbs.onTogglePause || null;
    _onToggleMapa = cbs.onToggleMapa || null;
    _onToggleInventario = cbs.onToggleInventario || null;
    _onToggleQuestBook = cbs.onToggleQuestBook || null;
    _onToggleTocha = cbs.onToggleTocha || null;
    _onToggleLoadout = cbs.onToggleLoadout || null;
}

// Estado prévio dos botões para detectar transições false→true (edge-trigger
// de acções "one-shot" como abrir baú).
const _prevPressed = new Array(20).fill(false);

let _connected = false;
let _connectedIndex = -1;

window.addEventListener('gamepadconnected', (e) => {
    _connected = true;
    _connectedIndex = e.gamepad.index;
    console.log(`[Gamepad] Ligado: ${e.gamepad.id} (index ${e.gamepad.index})`);
});
window.addEventListener('gamepaddisconnected', (e) => {
    if (e.gamepad.index === _connectedIndex) {
        _connected = false;
        _connectedIndex = -1;
        // Limpa estado de movimento para o jogador não ficar a correr.
        keys.w = keys.a = keys.s = keys.d = false;
    }
    console.log(`[Gamepad] Desligado: ${e.gamepad.id}`);
});

export function isGamepadConnected() { return _connected; }
export function isGamepadInputActive() {
    return _connected && settings.inputMethod === 'gamepad';
}

// Edge-trigger: dispara fn() uma vez por pressão (transição false→true).
function _edge(btnIdx, pressed, fn) {
    const prev = _prevPressed[btnIdx];
    _prevPressed[btnIdx] = pressed;
    if (!prev && pressed) fn();
}

export function pollGamepad() {
    if (!isGamepadInputActive()) return;
    const pads = navigator.getGamepads?.() || [];
    const gp = pads[_connectedIndex] || pads.find?.(p => p) || null;
    if (!gp) return;

    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;

    // Movimento — combinação de stick + D-pad (whichever pressed wins).
    const dpadUp    = gp.buttons[12]?.pressed;
    const dpadDown  = gp.buttons[13]?.pressed;
    const dpadLeft  = gp.buttons[14]?.pressed;
    const dpadRight = gp.buttons[15]?.pressed;

    keys.w = (ay < -DEADZONE) || !!dpadUp;
    keys.s = (ay >  DEADZONE) || !!dpadDown;
    keys.a = (ax < -DEADZONE) || !!dpadLeft;
    keys.d = (ax >  DEADZONE) || !!dpadRight;

    // Acções one-shot (edge-triggered). Setam a flag em `keys` que o jogo
    // já consome (o consumer faz keys.e = false após usar). Em paralelo,
    // disparamos os toggles registados — espelha exactamente o que o
    // listener de keydown do teclado faz.
    _edge(0, gp.buttons[0]?.pressed, () => { keys.e = true; });           // A → E
    _edge(1, gp.buttons[1]?.pressed, () => {
        if (_onTogglePause) _onTogglePause({ preventDefault() {}, key: 'Escape' });
    });                                                                    // B → Esc
    _edge(3, gp.buttons[3]?.pressed, () => {
        keys.i = true;
        if (_onToggleInventario) _onToggleInventario();
    });                                                                    // Y → I
    _edge(2, gp.buttons[2]?.pressed, () => {
        keys.b = true;
        if (_onToggleQuestBook) _onToggleQuestBook();
    });                                                                    // X → B
    _edge(4, gp.buttons[4]?.pressed, () => {
        keys.v = true;
        if (_onToggleLoadout) _onToggleLoadout();
    });                                                                    // LB → V
    _edge(5, gp.buttons[5]?.pressed, () => {
        keys.m = true;
        if (_onToggleMapa) _onToggleMapa();
    });                                                                    // RB → M
    _edge(9, gp.buttons[9]?.pressed, () => {
        if (_onTogglePause) _onTogglePause({ preventDefault() {}, key: 'Escape' });
    });                                                                    // Start → Pause
    _edge(8, gp.buttons[8]?.pressed, () => {
        keys.n = true;
        if (_onToggleTocha) _onToggleTocha();
    });                                                                    // Back → N
}

// Quando o jogador desliga gamepad nas definições, queremos zerar o
// movimento para não ficar uma direcção "presa".
onSettingChange('inputMethod', (v) => {
    if (v !== 'gamepad') {
        keys.w = keys.a = keys.s = keys.d = false;
    }
});
