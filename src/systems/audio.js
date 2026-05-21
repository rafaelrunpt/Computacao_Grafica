// --------------------------------------------------------
// SISTEMA DE ÁUDIO — música de fundo com fades e settings
// --------------------------------------------------------
import * as THREE from 'three';
import { onSettingChange, getMusicTargetVolume, getSfxTargetVolume } from './settings.js';

let _listener = null;
const _sounds = {}; // Música
const _sfx = {};    // Sound Effects
let _currentTrack = null;
let _pendingTrack = null; // pedido feito antes do buffer ter carregado
const _activeFades = new Map();
const _audioLoader = new THREE.AudioLoader();

export function inicializarAudio(camera, faixas, sfx) {
    _listener = new THREE.AudioListener();
    camera.add(_listener);

    // Música
    for (const nome of Object.keys(faixas)) {
        _sounds[nome] = new THREE.Audio(_listener);
        _audioLoader.load(faixas[nome], (buffer) => {
            _sounds[nome].setBuffer(buffer);
            _sounds[nome].setLoop(true);
            _sounds[nome].setVolume(0);
            // Se este track foi pedido antes de carregar, arranca-o agora.
            if (_pendingTrack && _pendingTrack.name === nome) {
                const t = _pendingTrack;
                _pendingTrack = null;
                switchMusic(t.name, t.fadeTime);
            }
        }, undefined, () => console.warn(`Aviso: ${faixas[nome]} não encontrado.`));
    }

    // SFX
    if (sfx) {
        for (const nome of Object.keys(sfx)) {
            _sfx[nome] = new THREE.Audio(_listener);
            _audioLoader.load(sfx[nome], (buffer) => {
                _sfx[nome].setBuffer(buffer);
                _sfx[nome].setLoop(false);
            }, undefined, () => console.warn(`Aviso SFX: ${sfx[nome]} não encontrado.`));
        }
    }

    // sliders → volume imediato da faixa actual
    onSettingChange('masterVolume', _aplicarVolumeMusica);
    onSettingChange('musicVolume',  _aplicarVolumeMusica);
    onSettingChange('muted',        _aplicarVolumeMusica);
}

export function resumeAudio() {
    if (!_listener) return Promise.resolve();
    if (_listener.context.state !== 'suspended') return Promise.resolve();
    return _listener.context.resume().then(() => {
        console.log('[AUDIO] Contexto retomado.');
        _aplicarVolumeMusica();
        // Se houve um switchMusic pedido com o contexto suspenso e o buffer
        // já estava carregado, o _fadeIn chamou play() mas nada saiu. Forçar
        // um restart da faixa actual aqui.
        if (_currentTrack) {
            const a = _sounds[_currentTrack];
            if (a && a.buffer && !a.isPlaying) {
                try { a.play(); } catch (_) {}
            }
        }
        // Caso ainda haja um pedido pendente (buffer ainda não carregou
        // OU não foi possível arrancar), tenta agora.
        if (_pendingTrack) {
            const t = _pendingTrack;
            _pendingTrack = null;
            switchMusic(t.name, t.fadeTime);
        }
    });
}

export function switchMusic(nextTrackName, fadeTime = 1.5) {
    if (_currentTrack === nextTrackName) { _pendingTrack = null; return; }
    const next = _sounds[nextTrackName];
    if (!next || !next.buffer) {
        // Buffer ainda não carregou — guarda o pedido e arranca quando
        // a callback de load disparar.
        _pendingTrack = { name: nextTrackName, fadeTime };
        return;
    }

    if (_currentTrack) _fadeOut(_sounds[_currentTrack], fadeTime);
    _fadeIn(next, fadeTime);
    _currentTrack = nextTrackName;
    _pendingTrack = null;
}

export function playSFX(name, delay = 0, forceRestart = true, loop = false) {
    const s = _sfx[name];
    if (!s || !s.buffer) return;

    const action = () => {
        if (s.isPlaying) {
            if (!forceRestart) return;
            s.stop();
        }
        
        s.setLoop(loop);
        s.setVolume(getSfxTargetVolume());
        s.play();
    };

    if (delay > 0) setTimeout(action, delay);
    else action();
}

export function stopSFX(name) {
    const s = _sfx[name];
    if (s && s.isPlaying) {
        s.stop();
    }
}

export function stopMusic(fadeTime = 0.6) {
    if (!_currentTrack) return;
    const audio = _sounds[_currentTrack];
    if (audio && audio.isPlaying) _fadeOut(audio, fadeTime);
    _currentTrack = null;
    _pendingTrack = null;
}

// Pequeno "chime" gratificante para apanhar item / recompensa.
// Dois sinos curtos a subir (perfeitos quartos) com cauda harmónica.
export function tocarChimeRecompensa() {
    if (!_listener) return;
    const ctx = _listener.context;
    const master = ctx.createGain();
    master.gain.value = getSfxTargetVolume() * 0.45;
    master.connect(ctx.destination);

    const now = ctx.currentTime + 0.01;

    function bell(freq, start, dur, vol = 0.32) {
        // sino: fundamental sine + harmónico ligeiro + leve detune
        const oscA = ctx.createOscillator();
        const oscB = ctx.createOscillator();
        const g = ctx.createGain();
        oscA.type = 'sine';
        oscB.type = 'triangle';
        oscA.frequency.value = freq;
        oscB.frequency.value = freq * 3;
        oscB.detune.value = 4;
        const gB = ctx.createGain();
        gB.gain.value = 0.25;
        oscA.connect(g);
        oscB.connect(gB);
        gB.connect(g);
        g.connect(master);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        oscA.start(start);
        oscB.start(start);
        oscA.stop(start + dur + 0.02);
        oscB.stop(start + dur + 0.02);
    }

    // C6 → G6 → C7 — pequena escada brilhante
    bell(1046.5, now + 0.00, 0.55);
    bell(1567.98, now + 0.10, 0.65);
    bell(2093.0, now + 0.22, 0.80, 0.26);
}

// Fanfarra de vitória — sintetizada com Web Audio (sem ficheiro).
// Arpejo ascendente C-E-G + acorde C-E-G-C(8va) sustentado, timbre de
// metais (sawtooth + square uma oitava acima) com envelope ADSR curto.
export function tocarFanfarraVitoria() {
    if (!_listener) return;
    const ctx = _listener.context;
    const master = ctx.createGain();
    master.gain.value = getSfxTargetVolume() * 0.55;
    master.connect(ctx.destination);

    const now = ctx.currentTime + 0.02;

    function nota(freq, start, dur, vol = 0.32) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.value = freq;
        osc2.frequency.value = freq * 2;
        osc2.detune.value = -7;
        osc1.connect(g);
        osc2.connect(g);
        g.connect(master);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(vol, start + 0.025);
        g.gain.exponentialRampToValueAtTime(vol * 0.55, start + dur * 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc1.start(start);
        osc2.start(start);
        osc1.stop(start + dur + 0.02);
        osc2.stop(start + dur + 0.02);
    }

    // arpejo: C5 → E5 → G5
    nota(523.25, now + 0.00, 0.20);
    nota(659.25, now + 0.20, 0.20);
    nota(783.99, now + 0.40, 0.24);

    // acorde sustentado C–E–G–C8va
    const chord = now + 0.66;
    nota(523.25, chord, 1.55, 0.28);
    nota(659.25, chord, 1.55, 0.28);
    nota(783.99, chord, 1.55, 0.28);
    nota(1046.5, chord, 1.55, 0.24);
}

// Buffer de ruído branco — reutilizado pelos efeitos do meteoro.
function _makeNoiseBuffer(ctx, dur) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
}

// Assobio de um meteoro a cair — ruído filtrado com varrimento de
// frequência descendente. Sintetizado (sem ficheiro de áudio).
export function tocarQuedaMeteoro() {
    if (!_listener) return;
    const ctx = _listener.context;
    const now = ctx.currentTime + 0.01;
    const dur = 1.6;

    const master = ctx.createGain();
    master.gain.value = getSfxTargetVolume() * 0.3;
    master.connect(ctx.destination);

    const noise = ctx.createBufferSource();
    noise.buffer = _makeNoiseBuffer(ctx, dur);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.3;
    bp.frequency.setValueAtTime(1900, now);
    bp.frequency.exponentialRampToValueAtTime(260, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(bp); bp.connect(g); g.connect(master);
    noise.start(now);
    noise.stop(now + dur + 0.05);
}

// Estrondo do impacto do meteoro no solo — boom grave (sine a descer)
// + estalo de ruído agudo. Sintetizado.
export function tocarImpactoMeteoro() {
    if (!_listener) return;
    const ctx = _listener.context;
    const now = ctx.currentTime + 0.01;
    const dur = 0.7;

    const master = ctx.createGain();
    master.gain.value = getSfxTargetVolume() * 0.55;
    master.connect(ctx.destination);

    // boom grave — sine que desce de 165 Hz para 38 Hz
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.95, now + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(og); og.connect(master);
    osc.start(now); osc.stop(now + dur + 0.05);

    // estalo agudo de detritos
    const noise = ctx.createBufferSource();
    noise.buffer = _makeNoiseBuffer(ctx, 0.3);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.7, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    noise.connect(hp); hp.connect(ng); ng.connect(master);
    noise.start(now); noise.stop(now + 0.3);
}

// ----------------------------------------------------------------------
// SONS DE ATAQUE — sintetizados (Web Audio). Cada ataque do jogador e do
// boss tem um timbre próprio; não dependem de ficheiros de áudio.
// ----------------------------------------------------------------------

// Cadeia base: gain mestre ligado ao volume de SFX. null se o áudio
// ainda não foi inicializado.
function _sfxChain(volMult = 1) {
    if (!_listener) return null;
    const ctx = _listener.context;
    const master = ctx.createGain();
    master.gain.value = getSfxTargetVolume() * volMult;
    master.connect(ctx.destination);
    return { ctx, master, now: ctx.currentTime + 0.01 };
}

// "Whoosh" — ruído branco por um bandpass com varrimento de frequência.
function _whoosh(ctx, master, start, { dur, f0, f1, q = 1.0, vol = 0.5 }) {
    const noise = ctx.createBufferSource();
    noise.buffer = _makeNoiseBuffer(ctx, dur + 0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, start);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    noise.connect(bp); bp.connect(g); g.connect(master);
    noise.start(start);
    noise.stop(start + dur + 0.06);
}

// Tom de oscilador (ping / zap / boom) com varrimento de frequência opcional.
function _tone(ctx, master, start, { dur, f0, f1 = f0, type = 'sine', vol = 0.4 }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g); g.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.04);
}

// Boom grave de impacto (sine a descer).
function _thud(ctx, master, start, opts = {}) {
    _tone(ctx, master, start, {
        dur: opts.dur ?? 0.3, f0: opts.f0 ?? 150, f1: opts.f1 ?? 45,
        type: 'sine', vol: opts.vol ?? 0.7,
    });
}

// --- ataques do JOGADOR — som distinto por id de ataque ---
export function tocarSomAtaquePlayer(ataqueId) {
    const s = _sfxChain(0.5);
    if (!s) return;
    const { ctx, master, now } = s;
    switch (ataqueId) {
        case 'golpe_rapido':       // estocada veloz — swish curto e agudo
            _whoosh(ctx, master, now, { dur: 0.22, f0: 2600, f1: 700, q: 1.4, vol: 0.55 });
            _tone(ctx, master, now + 0.15, { dur: 0.10, f0: 3100, type: 'triangle', vol: 0.18 });
            break;
        case 'golpe_pesado':       // talho profundo — whoosh grave + impacto
            _whoosh(ctx, master, now, { dur: 0.40, f0: 900, f1: 160, q: 0.8, vol: 0.6 });
            _thud(ctx, master, now + 0.26, { dur: 0.34, f0: 175, f1: 48, vol: 0.7 });
            break;
        case 'investida':          // carga — whoosh ascendente longo + embate
            _whoosh(ctx, master, now, { dur: 0.52, f0: 220, f1: 1400, q: 0.7, vol: 0.55 });
            _thud(ctx, master, now + 0.48, { dur: 0.40, f0: 200, f1: 40, vol: 0.85 });
            break;
        case 'combo_duplo':        // dança das lâminas — dois cortes encadeados
            _whoosh(ctx, master, now,        { dur: 0.18, f0: 2100, f1: 800, q: 1.3, vol: 0.45 });
            _whoosh(ctx, master, now + 0.22, { dur: 0.20, f0: 2700, f1: 700, q: 1.3, vol: 0.50 });
            break;
        case 'golpe_giratorio':    // tornado — três swishes rápidos
            _whoosh(ctx, master, now,        { dur: 0.16, f0: 1700, f1: 950,  q: 1.7, vol: 0.40 });
            _whoosh(ctx, master, now + 0.16, { dur: 0.16, f0: 2200, f1: 1000, q: 1.7, vol: 0.45 });
            _whoosh(ctx, master, now + 0.32, { dur: 0.24, f0: 2800, f1: 800,  q: 1.7, vol: 0.50 });
            break;
        case 'relampago_arcano':   // magia — zap eléctrico
            _tone(ctx, master, now,          { dur: 0.34, f0: 180, f1: 1800, type: 'sawtooth', vol: 0.32 });
            _whoosh(ctx, master, now + 0.03, { dur: 0.30, f0: 4200, f1: 1100, q: 2.4, vol: 0.40 });
            _tone(ctx, master, now + 0.09,   { dur: 0.26, f0: 2400, f1: 3700, type: 'square', vol: 0.16 });
            break;
        default:                   // fallback genérico
            _whoosh(ctx, master, now, { dur: 0.26, f0: 2000, f1: 700, q: 1.2, vol: 0.5 });
    }
}

// --- ataques do BOSS — som distinto por tipo de projéctil ---
export function tocarSomAtaqueBoss(tipo) {
    const s = _sfxChain(0.55);
    if (!s) return;
    const { ctx, master, now } = s;
    switch (tipo) {
        case 'aereo':       // projéctil de cima — assobio descendente + impacto
            _tone(ctx, master, now, { dur: 0.50, f0: 1700, f1: 320, type: 'sawtooth', vol: 0.30 });
            _thud(ctx, master, now + 0.42, { dur: 0.30, f0: 150, f1: 48, vol: 0.60 });
            break;
        case 'rasante':     // onda rasante — whoosh grave a varrer o chão
            _whoosh(ctx, master, now, { dur: 0.50, f0: 620, f1: 120, q: 0.9, vol: 0.62 });
            break;
        case 'lateral':     // bola lateral — "wob" grave
            _tone(ctx, master, now,        { dur: 0.40, f0: 520, f1: 240, type: 'square', vol: 0.30 });
            _tone(ctx, master, now + 0.05, { dur: 0.34, f0: 260, f1: 120, type: 'sawtooth', vol: 0.20 });
            break;
        case 'varredura':   // viga horizontal — varrimento agudo e airoso
            _whoosh(ctx, master, now, { dur: 0.60, f0: 1000, f1: 3000, q: 1.4, vol: 0.50 });
            _tone(ctx, master, now,   { dur: 0.55, f0: 700,  f1: 1500, type: 'triangle', vol: 0.16 });
            break;
        default:
            _whoosh(ctx, master, now, { dur: 0.40, f0: 1200, f1: 400, q: 1.0, vol: 0.5 });
    }
}

// --- ataques dos inimigos normais — som distinto por golpe (tema do Vazio) ---
export function tocarSomAtaqueInimigo(somKey) {
    const s = _sfxChain(0.5);
    if (!s) return;
    const { ctx, master, now } = s;
    switch (somKey) {
        case 'toque':      // Toque do Vazio — sussurro grave e etéreo
            _tone(ctx, master, now, { dur: 0.42, f0: 160, f1: 85, type: 'sine', vol: 0.32 });
            _whoosh(ctx, master, now, { dur: 0.36, f0: 520, f1: 120, q: 1.0, vol: 0.40 });
            break;
        case 'garra':      // Garra Dilacerante — talho agudo e seco
            _whoosh(ctx, master, now, { dur: 0.26, f0: 3000, f1: 600, q: 1.9, vol: 0.50 });
            _tone(ctx, master, now + 0.05, { dur: 0.14, f0: 1800, f1: 380, type: 'sawtooth', vol: 0.20 });
            break;
        case 'sopro':      // Sopro Corrompido — bafo arrastado descendente
            _whoosh(ctx, master, now, { dur: 0.52, f0: 1400, f1: 240, q: 0.7, vol: 0.46 });
            break;
        case 'dreno':      // Dreno Espectral — varrimento ascendente de sucção
            _tone(ctx, master, now, { dur: 0.46, f0: 200, f1: 920, type: 'sawtooth', vol: 0.28 });
            _whoosh(ctx, master, now + 0.02, { dur: 0.42, f0: 300, f1: 1700, q: 1.3, vol: 0.30 });
            break;
        case 'estilhaco':  // Estilhaço do Vazio — dois cacos cortantes
            _tone(ctx, master, now,        { dur: 0.10, f0: 2600, f1: 1300, type: 'square', vol: 0.30 });
            _tone(ctx, master, now + 0.13, { dur: 0.12, f0: 3100, f1: 1500, type: 'square', vol: 0.32 });
            break;
        case 'cuspo':      // Cuspo Pegajoso — escarro viscoso
            _whoosh(ctx, master, now, { dur: 0.18, f0: 900, f1: 300, q: 1.4, vol: 0.40 });
            _tone(ctx, master, now + 0.10, { dur: 0.12, f0: 420, f1: 150, type: 'sine', vol: 0.26 });
            break;
        case 'baba':       // Baba Corrosiva — chiar ácido arrastado
            _whoosh(ctx, master, now, { dur: 0.46, f0: 1600, f1: 480, q: 0.8, vol: 0.40 });
            _tone(ctx, master, now, { dur: 0.40, f0: 240, f1: 140, type: 'sawtooth', vol: 0.16 });
            break;
        case 'embate':     // Embate Viscoso — pancada molhada e grave
            _thud(ctx, master, now, { dur: 0.32, f0: 200, f1: 55, vol: 0.55 });
            _whoosh(ctx, master, now, { dur: 0.22, f0: 700, f1: 170, q: 1.0, vol: 0.40 });
            break;
        default:
            _tone(ctx, master, now, { dur: 0.35, f0: 300, f1: 120, type: 'sawtooth', vol: 0.35 });
    }
}

// --- rugido do boss ao entrar em fúria (abaixo dos 25% de vida) ---
export function tocarRugidoBoss() {
    const s = _sfxChain(0.7);
    if (!s) return;
    const { ctx, master, now } = s;
    _tone(ctx, master, now,        { dur: 1.00, f0: 140, f1: 55, type: 'sawtooth', vol: 0.40 });
    _tone(ctx, master, now + 0.04, { dur: 0.95, f0: 95,  f1: 42, type: 'square',   vol: 0.28 });
    _whoosh(ctx, master, now,      { dur: 0.90, f0: 600, f1: 90, q: 0.6, vol: 0.40 });
    _thud(ctx, master, now + 0.62, { dur: 0.42, f0: 120, f1: 38, vol: 0.55 });
}

export function getCurrentTrack() { return _currentTrack; }

function _aplicarVolumeMusica() {
    if (!_currentTrack) return;
    const audio = _sounds[_currentTrack];
    if (!audio || !audio.buffer) return;

    const targetVol = getMusicTargetVolume();

    // Se o volume agora é positivo mas a música estava parada (ex: mute), recomeçar
    if (targetVol > 0 && !audio.isPlaying) {
        audio.play();
    }

    if (_activeFades.has(audio)) return; // fade já vai lá chegar
    audio.setVolume(targetVol);
}

function _fadeIn(audio, duration) {
    if (_activeFades.has(audio)) { clearInterval(_activeFades.get(audio)); _activeFades.delete(audio); }
    if (!audio.isPlaying) audio.play();
    let vol = audio.getVolume();
    const interval = 50;
    const step = (getMusicTargetVolume() || 0.001) / (duration * 1000 / interval);
    const timer = setInterval(() => {
        const target = getMusicTargetVolume();
        vol += step;
        if (vol >= target) { vol = target; clearInterval(timer); _activeFades.delete(audio); }
        audio.setVolume(vol);
    }, interval);
    _activeFades.set(audio, timer);
}

function _fadeOut(audio, duration) {
    if (_activeFades.has(audio)) { clearInterval(_activeFades.get(audio)); _activeFades.delete(audio); }
    let vol = audio.getVolume();
    const interval = 50;
    const step = vol / (duration * 1000 / interval);
    const timer = setInterval(() => {
        vol -= step;
        if (vol <= 0) { vol = 0; audio.stop(); clearInterval(timer); _activeFades.delete(audio); }
        audio.setVolume(vol);
    }, interval);
    _activeFades.set(audio, timer);
}
