export const keys = { w: false, a: false, s: false, d: false, e: false, i: false, m: false, l: false, p: false, b: false, n: false, v: false };

let _onToggleMapa = null;
let _onToggleInventario = null;
let _onTogglePause = null;
let _onToggleQuestBook = null;
let _onToggleTocha = null;
let _onToggleLoadout = null;
export function registarCallbackInput(onToggleMapa, onToggleInventario, onTogglePause, onToggleQuestBook, onToggleTocha, onToggleLoadout) {
    _onToggleMapa = onToggleMapa;
    _onToggleInventario = onToggleInventario;
    _onTogglePause = onTogglePause;
    _onToggleQuestBook = onToggleQuestBook;
    _onToggleTocha = onToggleTocha;
    _onToggleLoadout = onToggleLoadout;
}

// Teclas de acção (one-shot): ignorar auto-repeat do browser para que cada
// `tap` no E corresponda a UM evento — evita que segurar a tecla dispare
// dois passos consecutivos (ex.: abrir baú + coletar logo a seguir).
const ACTION_KEYS = new Set(['e', 'b', 'i', 'm', 'p', 'n', 'v']);

// Setas mapeiam para WASD — útil em combate boss (esquiva nas lanes,
// salto, agachamento) sem obrigar a mão direita a abandonar J/K/L.
const ARROW_TO_WASD = {
    'arrowup':    'w',
    'arrowdown':  's',
    'arrowleft':  'a',
    'arrowright': 'd',
};

window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase();
    if (ARROW_TO_WASD[key]) key = ARROW_TO_WASD[key];
    if (Object.prototype.hasOwnProperty.call(keys, key)) {
        if (ACTION_KEYS.has(key) && e.repeat) return; // ignora auto-repeat para acções
        keys[key] = true;
    }
    if (e.repeat && ACTION_KEYS.has(key)) return;
    if (key === 'm' && _onToggleMapa) _onToggleMapa();
    if (key === 'i' && _onToggleInventario) _onToggleInventario();
    if (key === 'b' && _onToggleQuestBook) _onToggleQuestBook();
    if (key === 'n' && _onToggleTocha) _onToggleTocha();
    if (key === 'v' && _onToggleLoadout) _onToggleLoadout();
    if ((key === 'p' || e.key === 'Escape') && _onTogglePause) _onTogglePause(e);
});

window.addEventListener('keyup', (e) => {
    let key = e.key.toLowerCase();
    if (ARROW_TO_WASD[key]) key = ARROW_TO_WASD[key];
    if (Object.prototype.hasOwnProperty.call(keys, key)) keys[key] = false;
});
