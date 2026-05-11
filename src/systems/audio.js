// --------------------------------------------------------
// SISTEMA DE ÁUDIO — música de fundo com fades e settings
// --------------------------------------------------------
import * as THREE from 'three';
import { onSettingChange, getMusicTargetVolume, getSfxTargetVolume } from './settings.js';

let _listener = null;
const _sounds = {}; // Música
const _sfx = {};    // Sound Effects
let _currentTrack = null;
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

export function switchMusic(nextTrackName, fadeTime = 1.5) {
    if (_currentTrack === nextTrackName) return;
    const next = _sounds[nextTrackName];
    if (!next || !next.buffer) return;

    if (_currentTrack) _fadeOut(_sounds[_currentTrack], fadeTime);
    _fadeIn(next, fadeTime);
    _currentTrack = nextTrackName;
}

export function playSFX(name, delay = 0) {
    const s = _sfx[name];
    if (!s || !s.buffer) return;

    setTimeout(() => {
        if (s.isPlaying) s.stop();
        s.setVolume(getSfxTargetVolume());
        s.play();
    }, delay);
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
