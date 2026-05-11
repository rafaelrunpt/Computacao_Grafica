// --------------------------------------------------------
// SETTINGS — guardadas em localStorage, com listeners
// --------------------------------------------------------

const KEY = 'rpg_settings_v1';

const defaults = {
    masterVolume: 1.0,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    muted: false,

    mouseSensitivity: 1.0,
    invertY: false,

    quality: 'media',     // 'baixa' | 'media' | 'alta'
    fov: 75,
    fullscreen: false,
    showFps: false,

    seenTutorial: false,
};

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...defaults };
        return { ...defaults, ...JSON.parse(raw) };
    } catch { return { ...defaults }; }
}

export const settings = load();

const listeners = new Map(); // key -> Set<fn>

function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

export function setSetting(key, value) {
    settings[key] = value;
    persist();
    const subs = listeners.get(key);
    if (subs) subs.forEach(fn => { try { fn(value, settings); } catch (e) { console.error(e); } });
    const all = listeners.get('*');
    if (all) all.forEach(fn => { try { fn(key, value, settings); } catch (e) {} });
}

export function onSettingChange(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key).delete(fn);
}

// --- helpers de áudio ---
export function getMusicTargetVolume() {
    if (settings.muted) return 0;
    return settings.masterVolume * settings.musicVolume * 0.5; // 0.5 = ceiling razoável
}

export function getSfxTargetVolume() {
    if (settings.muted) return 0;
    return settings.masterVolume * settings.sfxVolume;
}

export function resetSettings() {
    Object.assign(settings, defaults);
    persist();
    // notificar todos
    for (const [key, subs] of listeners.entries()) {
        if (key === '*') continue;
        subs.forEach(fn => { try { fn(settings[key], settings); } catch {} });
    }
}
