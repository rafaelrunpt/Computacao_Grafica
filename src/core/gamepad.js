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
//   L1 (4)                      → N  (tocha)
//   L2 (6)                      → V  (loadout)
//   RB (5)                      → M  (mapa)
//   Start (9)                   → P  (pausa)
//   Back/Select (8)             → N  (tocha, alternativa)

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

// Stack de contextos de navegação UI. Quando uma UI (combate, diálogo)
// quer apanhar o gamepad para si, faz pushNavContext({...}) e libera com
// popNavContext. Enquanto há um contexto activo, A/B/D-pad/sticks vão para
// callbacks de UI em vez do mapeamento de mundo.
//   onNav(dir)   — dir = 'up' | 'down' | 'left' | 'right'
//   onConfirm()  — botão A (Cross)
//   onCancel()   — botão B (Circle)
//   onAlt()      — botão Y (Triangle), opcional
const _navStack = [];
export function pushNavContext(ctx) { _navStack.push(ctx); }
export function popNavContext(ctx) {
    const i = _navStack.lastIndexOf(ctx);
    if (i !== -1) _navStack.splice(i, 1);
}

// Expõe globalmente para módulos não-ESM (e.g. arcano-dialogue.js IIFE).
window.__inputNav = {
    push: pushNavContext,
    pop: popNavContext,
    isGamepadMode: () => settings.inputMethod === 'gamepad',
};
function _activeNav() { return _navStack.length > 0 ? _navStack[_navStack.length - 1] : null; }

// Debounce do stick para evitar repetições rápidas demais quando segurar.
// Primeira "tecla" dispara imediatamente; repetições só depois de cooldown.
const _STICK_REPEAT_INITIAL_MS = 380;
const _STICK_REPEAT_MS = 110;
const _navAxisState = {
    lastDir: null,    // 'up'|'down'|'left'|'right'|null
    lastTime: 0,
    initial: true,
};

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
    const dpadUp    = gp.buttons[12]?.pressed;
    const dpadDown  = gp.buttons[13]?.pressed;
    const dpadLeft  = gp.buttons[14]?.pressed;
    const dpadRight = gp.buttons[15]?.pressed;

    const nav = _activeNav();

    if (nav) {
        // Há um contexto UI activo — gamepad alimenta a UI, não o mundo.
        // Por defeito o movimento congela; mas alguns contextos (combate)
        // pedem `movementPassthrough` para que o stick continue a alimentar
        // WASD (ex.: fase de esquiva do boss).
        if (nav.movementPassthrough) {
            keys.w = (ay < -DEADZONE) || !!dpadUp;
            keys.s = (ay >  DEADZONE) || !!dpadDown;
            keys.a = (ax < -DEADZONE) || !!dpadLeft;
            keys.d = (ax >  DEADZONE) || !!dpadRight;
        } else {
            keys.w = keys.a = keys.s = keys.d = false;
        }

        // D-pad: edge-triggered. Em modo passthrough também dispara onNav
        // (alguns contextos podem usar para navegação adicional).
        _edge(12, dpadUp,    () => nav.onNav?.('up'));
        _edge(13, dpadDown,  () => nav.onNav?.('down'));
        _edge(14, dpadLeft,  () => nav.onNav?.('left'));
        _edge(15, dpadRight, () => nav.onNav?.('right'));

        // Stick esquerdo só dispara onNav quando NÃO há passthrough — caso
        // contrário o stick é input contínuo de movimento e não devia
        // emitir pulsos discretos.
        if (!nav.movementPassthrough) _navStickStep(ax, ay, nav);

        // Bindings directos por botão. Square (□) é o botão primário de
        // "confirmar/interagir" — fallback para onConfirm. Cross (✕) deixa
        // de ser o primário; é tratado como botão secundário (sem fallback).
        // Ordem física Standard Gamepad: 0=A(Cross), 1=B(Circle), 2=X(Square),
        // 3=Y(Triangle).
        _edge(0, gp.buttons[0]?.pressed, () => nav.onCross?.());                         // ✕
        _edge(1, gp.buttons[1]?.pressed, () => (nav.onCircle   ?? nav.onCancel )?.());   // ○
        _edge(2, gp.buttons[2]?.pressed, () => (nav.onSquare   ?? nav.onConfirm)?.());   // □  ← primário
        _edge(3, gp.buttons[3]?.pressed, () => (nav.onTriangle ?? nav.onAlt   )?.());    // △
        _edge(4, gp.buttons[4]?.pressed, () => nav.onShoulder1?.());                    // L1
        _edge(5, gp.buttons[5]?.pressed, () => nav.onShoulder2?.());                    // R1

        // Botões "globais" que continuam mesmo em UI (pausa).
        _edge(9, gp.buttons[9]?.pressed, () => {
            if (_onTogglePause) _onTogglePause({ preventDefault() {}, key: 'Escape' });
        });
        return;
    }

    // Sem contexto UI: comportamento normal de mundo.
    // Reset de estado do stick (para a próxima vez que entrar em UI começar
    // sem disparo "preso").
    _navAxisState.lastDir = null;
    _navAxisState.initial = true;

    // Movimento — stick + D-pad.
    keys.w = (ay < -DEADZONE) || !!dpadUp;
    keys.s = (ay >  DEADZONE) || !!dpadDown;
    keys.a = (ax < -DEADZONE) || !!dpadLeft;
    keys.d = (ax >  DEADZONE) || !!dpadRight;

    // □ (Square, button 2) é o botão primário de interagir — substitui o ✕.
    // ✕ (Cross, button 0) passou a abrir o Códice (era o que o □ fazia).
    _edge(2, gp.buttons[2]?.pressed, () => { keys.e = true; });           // □ → E (interagir)
    _edge(0, gp.buttons[0]?.pressed, () => {
        keys.b = true;
        if (_onToggleQuestBook) _onToggleQuestBook();
    });                                                                    // ✕ → B (códice)
    _edge(1, gp.buttons[1]?.pressed, () => {
        if (_onTogglePause) _onTogglePause({ preventDefault() {}, key: 'Escape' });
    });                                                                    // ○ → Esc
    _edge(3, gp.buttons[3]?.pressed, () => {
        keys.i = true;
        if (_onToggleInventario) _onToggleInventario();
    });                                                                    // △ → I
    _edge(4, gp.buttons[4]?.pressed, () => {
        keys.n = true;
        if (_onToggleTocha) _onToggleTocha();
    });                                                                    // L1 → N (tocha)
    _edge(6, gp.buttons[6]?.pressed, () => {
        keys.v = true;
        if (_onToggleLoadout) _onToggleLoadout();
    });                                                                    // L2 → V (loadout)
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
    });                                                                    // Back → N (alternativa)
}

// Stick em UI: usa magnitude para determinar direcção dominante (4 vias) com
// deadzone, depois aplica repetição (primeiro pulso imediato, depois 110ms).
function _navStickStep(ax, ay, nav) {
    const mag = Math.hypot(ax, ay);
    if (mag < 0.45) {
        // Em zona morta — não dispara nada. Reset para próxima inclinação.
        _navAxisState.lastDir = null;
        _navAxisState.initial = true;
        return;
    }
    let dir;
    if (Math.abs(ax) > Math.abs(ay)) dir = ax > 0 ? 'right' : 'left';
    else                              dir = ay > 0 ? 'down'  : 'up';

    const now = performance.now();
    if (dir !== _navAxisState.lastDir) {
        // Nova direcção — pulso imediato.
        _navAxisState.lastDir = dir;
        _navAxisState.lastTime = now;
        _navAxisState.initial = true;
        nav.onNav?.(dir);
        return;
    }
    // Mantém a mesma direcção — repete após cooldown progressivo.
    const cd = _navAxisState.initial ? _STICK_REPEAT_INITIAL_MS : _STICK_REPEAT_MS;
    if (now - _navAxisState.lastTime >= cd) {
        _navAxisState.lastTime = now;
        _navAxisState.initial = false;
        nav.onNav?.(dir);
    }
}

// Quando o jogador desliga gamepad nas definições, queremos zerar o
// movimento para não ficar uma direcção "presa".
onSettingChange('inputMethod', (v) => {
    if (v !== 'gamepad') {
        keys.w = keys.a = keys.s = keys.d = false;
    }
});
