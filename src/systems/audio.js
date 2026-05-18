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
