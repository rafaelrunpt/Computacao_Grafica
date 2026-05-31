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
    // Escala de render aplicada ao pixelRatio. 0.5 = 100% no novo slider.
    // 1.0 = 200% (Nativo/HiDPI completo).
    renderScale: 0.5,
    fov: 75,
    fullscreen: false,
    showFps: false,
    vfxDebug: false,
    maxFps: 60, // 30 | 60

    // Benchmark de iluminação — modo nocturno do mundo exterior.
    // Quando activo, transmuta o céu, escurece a luz solar, acrescenta lua,
    // pirilampos e magias luminosas espalhadas pelo mapa.
    nightMode: false,

    seenTutorial: false,

    // Método de input: 'keyboard' | 'gamepad'. inputAsked controla se já
    // mostrámos o modal de escolha inicial — fica em false até o jogador
    // responder pela primeira vez.
    inputMethod: 'keyboard',
    inputAsked: false,
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
    // Multiplicamos por 0.2 (antes 0.5) para que a música seja mais ambiental e suave (40% do anterior)
    return settings.masterVolume * settings.musicVolume * 0.2;
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
