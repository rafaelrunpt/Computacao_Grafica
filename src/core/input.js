export const keys = { w: false, a: false, s: false, d: false, e: false, m: false, l: false };

let _onToggleMapa = null;
export function registarCallbackInput(onToggleMapa) {
    _onToggleMapa = onToggleMapa;
}

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(keys, key)) keys[key] = true;
    if (key === 'm' && _onToggleMapa) _onToggleMapa();
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(keys, key)) keys[key] = false;
});
