export const keys = { w: false, a: false, s: false, d: false, e: false, i: false, m: false, l: false, p: false };

let _onToggleMapa = null;
let _onToggleInventario = null;
let _onTogglePause = null;
export function registarCallbackInput(onToggleMapa, onToggleInventario, onTogglePause) {
    _onToggleMapa = onToggleMapa;
    _onToggleInventario = onToggleInventario;
    _onTogglePause = onTogglePause;
}

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(keys, key)) keys[key] = true;
    if (key === 'm' && _onToggleMapa) _onToggleMapa();
    if (key === 'i' && _onToggleInventario) _onToggleInventario();
    if ((key === 'p' || e.key === 'Escape') && _onTogglePause) _onTogglePause(e);
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(keys, key)) keys[key] = false;
});
