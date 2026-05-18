export const keys = { w: false, a: false, s: false, d: false, e: false, i: false, m: false, l: false, p: false, b: false };

let _onToggleMapa = null;
let _onToggleInventario = null;
let _onTogglePause = null;
let _onToggleQuestBook = null;
export function registarCallbackInput(onToggleMapa, onToggleInventario, onTogglePause, onToggleQuestBook) {
    _onToggleMapa = onToggleMapa;
    _onToggleInventario = onToggleInventario;
    _onTogglePause = onTogglePause;
    _onToggleQuestBook = onToggleQuestBook;
}

// Teclas de acção (one-shot): ignorar auto-repeat do browser para que cada
// `tap` no E corresponda a UM evento — evita que segurar a tecla dispare
// dois passos consecutivos (ex.: abrir baú + coletar logo a seguir).
const ACTION_KEYS = new Set(['e', 'b', 'i', 'm', 'p']);

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(keys, key)) {
        if (ACTION_KEYS.has(key) && e.repeat) return; // ignora auto-repeat para acções
        keys[key] = true;
    }
    if (e.repeat && ACTION_KEYS.has(key)) return;
    if (key === 'm' && _onToggleMapa) _onToggleMapa();
    if (key === 'i' && _onToggleInventario) _onToggleInventario();
    if (key === 'b' && _onToggleQuestBook) _onToggleQuestBook();
    if ((key === 'p' || e.key === 'Escape') && _onTogglePause) _onTogglePause(e);
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(keys, key)) keys[key] = false;
});
