// --------------------------------------------------------
// FPS COUNTER — controlado pelo settings.showFps
// --------------------------------------------------------
import { settings, onSettingChange } from '../systems/settings.js';

const el = document.createElement('div');
el.id = 'fps-counter';
el.style.cssText = `
    position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.55);
    color: #aaffbb;
    border: 1px solid #6a5020;
    border-radius: 4px;
    padding: 3px 10px;
    font-family: 'Courier New', monospace;
    font-size: 12px; letter-spacing: 1px;
    z-index: 200;
    pointer-events: none;
    display: none;
`;
document.body.appendChild(el);

let _frames = 0;
let _last = performance.now();
let _fps = 0;

function applyVisibility() { el.style.display = settings.showFps ? 'block' : 'none'; }
applyVisibility();
onSettingChange('showFps', applyVisibility);

export function tickFps() {
    _frames++;
    const now = performance.now();
    if (now - _last >= 500) {
        _fps = Math.round(_frames * 1000 / (now - _last));
        _frames = 0; _last = now;
        if (settings.showFps) el.textContent = `${_fps} FPS`;
    }
}
