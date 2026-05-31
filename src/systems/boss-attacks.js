// ======================================================================
// BOSS ATTACKS — fase de desvio do combate final.
// ----------------------------------------------------------------------
// Enquanto o jogador tem a UI de ataque aberta (turno dele), o boss
// lança projécteis de 4 tipos:
//   • aéreo     — cai de cima da arena na lane alvo; tem de SALTAR alto
//                 ou MUDAR de lane.
//   • rasante   — varre o chão na direção do player; tem de SALTAR.
//   • lateral   — atinge uma das 3 lanes; tem de MUDAR de lane.
//   • varredura — viga horizontal a altura do peito que atravessa as 3
//                 lanes; tem de AGACHAR-SE para passar por baixo.
//
// Controlos durante a fase de desvio (sem precisar tirar a mão do
// rato/UI — usa WASD):
//   A — mover para a lane à esquerda
//   D — mover para a lane à direita
//   W — saltar
//   S — agachar-se
//
// Cada projéctil tem 2 fases:
//   1) telegraph — marcador visual a piscar (avisa onde vai atingir).
//   2) impact    — o projéctil atravessa a zona; se o player estiver
//      na "danger zone" no instante do impacto, recebe dano.
// ======================================================================
import * as THREE from 'three';
import { player } from '../entities/jogador.js';
import { getBossRoot, triggerBossAttackAnim } from '../entities/boss.js';
import { combateScene, posPlayerCombate, isBossMode } from '../world/combate-scene.js';
import { keys } from '../core/input.js';
import { receberDano, playerStats } from './player-stats.js';
import { setHpPlayer, setLog, mostrarDanoFlutuante } from '../ui/combate-ui.js';
import { tocarSomAtaqueBoss, tocarRugidoBoss, tocarSomMovimentoBoss } from './audio.js';
import { BossVFX } from './boss-vfx.js';

// ----------------------------------------------------------------------
// CONFIGURAÇÃO
// ----------------------------------------------------------------------
const LANE_OFFSETS = [-1.8, 0, 1.8]; // X relativo a posPlayerCombate
const JUMP_HEIGHT = 1.5;
const JUMP_DUR    = 0.7;
const DUCK_DUR    = 0.5;
const SPAWN_MIN   = 1.6;             // intervalo mínimo entre spawns
const SPAWN_MAX   = 2.6;

// Fracção de vida do boss (1 = full, 0 = morto). Combate.js empurra este
// valor sempre que o boss leva dano. Usado para acelerar os projécteis e
// activar o "rage mode" (cores trocadas) abaixo dos 25%.
let _bossHpFrac = 1.0;
let _rageAnunciado = false;
const RAGE_THRESHOLD = 0.25;

export function setBossHpFrac(frac) {
    const antes = _bossHpFrac;
    _bossHpFrac = Math.max(0, Math.min(1, frac));
    if (_bossHpFrac >= 0.95) {
        _rageAnunciado = false;            // vida cheia → novo combate de boss
    } else if (!_rageAnunciado && antes >= RAGE_THRESHOLD
               && _bossHpFrac < RAGE_THRESHOLD && _bossHpFrac > 0) {
        _rageAnunciado = true;
        _entrarRageMode();
    }
}

// Transição visível para o "rage mode" — dispara uma única vez, quando o
// boss cai abaixo dos 25% de vida.
function _entrarRageMode() {
    setLog('⚠ O SOBERANO ENTRA EM FÚRIA! Os golpes aceleram e ardem em corrupção!');
    tocarRugidoBoss();
    _flashRage();
}

// Clarão roxo intenso a cobrir o ecrã.
function _flashRage() {
    let o = document.getElementById('boss-rage-flash');
    if (!o) {
        o = document.createElement('div');
        o.id = 'boss-rage-flash';
        o.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:96;background:rgba(170,30,255,0);';
        document.body.appendChild(o);
    }
    o.style.transition = 'background 0.08s';
    o.style.background = 'rgba(170,30,255,0.55)';
    setTimeout(() => {
        o.style.transition = 'background 0.6s ease-out';
        o.style.background = 'rgba(170,30,255,0)';
    }, 90);
}

// Velocidade aumenta linearmente com o dano sofrido pelo boss, mas
// fica capada aos 30% de vida — abaixo disso a luta ficava impossível.
//   100% HP →  1.0x  (normal)
//    50% HP → ~1.6x
//    30% HP →  1.84x (velocidade máxima — daqui para baixo não acelera)
//    25% HP →  1.84x (entra em rage no visual, mas velocidade não muda)
//     0% HP →  1.84x
const SPEED_FLOOR_FRAC = 0.30;
function _speedMult() {
    const eff = Math.max(_bossHpFrac, SPEED_FLOOR_FRAC);
    return 1 + (1 - eff) * 1.2;
}

function _isRageMode() { return _bossHpFrac < RAGE_THRESHOLD; }

// Em rage mode, inverte cada componente da cor do telegraph (XOR com 0xffffff).
// Mantém a mesma cor em vida cheia.
function _telegraphColorHex(baseHex) {
    if (!_isRageMode()) return baseHex;
    return 0xffffff ^ baseHex;
}

// "danger zones" usadas para detectar acerto em cada tipo
//   aéreo   — atinge quem está de pé na lane alvo (y entre 0.4 e 1.7)
//   rasante — atinge quem tem os pés no chão (y < 0.4)
//   lateral — atinge quem está na lane alvo a qualquer altura "normal"

// ----------------------------------------------------------------------
// ESTADO INTERNO
// ----------------------------------------------------------------------
let _active = false;
let _laneIdx = 1;                    // 0=esq, 1=meio, 2=dir
let _yState  = 'ground';             // 'ground' | 'jump' | 'duck'
let _yTimer  = 0;
let _spawnTimer = 0;

const _projectiles = [];

// edge-detection do input (para que segurar A não salte de lane em lane)
const _kPrev = { a: false, d: false, w: false, s: false };

// ----------------------------------------------------------------------
// PROJECTEIS — factories
// ----------------------------------------------------------------------

// Aéreo: marcador no chão (anel) → cai uma esfera do céu sobre a lane alvo.
function criarAereo() {
    const lane = Math.floor(Math.random() * 3);
    const x = posPlayerCombate.x + LANE_OFFSETS[lane];
    const z = posPlayerCombate.z;
    const speed = _speedMult();

    const pr = {
        type: 'aereo',
        lane, x, z,
        teleDur: 0.95 / speed,
        impactDur: 0.35 / speed,
        t: 0,
        hitApplied: false,
        dano: 12,
        // condição de acerto: player na lane E não está agachado/saltando alto
        isHit(px, py, plane) {
            return plane === lane && py < 1.0 && py >= 0; // de pé é hit
        },
    };
    BossVFX.criarTelegraph(pr, _telegraphColorHex(0xff4040));
    return pr;
}

// Rasante: barra alaranjada baixa que se materializa e varre o eixo Z
// do boss em direcção ao player. Player tem de SALTAR.
function criarRasante() {
    const z = posPlayerCombate.z;
    const x = posPlayerCombate.x; // varre o meio (largura cobre as 3 lanes)
    const speed = _speedMult();

    const pr = {
        type: 'rasante',
        x, z,
        teleDur: 0.9 / speed,
        impactDur: 0.45 / speed,
        t: 0,
        hitApplied: false,
        dano: 12,
        isHit(px, py, _plane) {
            // qualquer lane; só falha se estiver no ar (y > 0.7)
            return py < 0.7;
        },
    };
    BossVFX.criarTelegraph(pr, _telegraphColorHex(0xffaa20));
    return pr;
}

// Lateral: bola roxa que vem de um lado (esq/dir do boss) e atravessa
// a arena pela altura do peito do player. Atinge a lane alvo. Player
// pode esquivar mudando de lane OU agachando-se (a bola voa ao peito).
function criarLateral() {
    const lane = Math.floor(Math.random() * 3);
    const targetX = posPlayerCombate.x + LANE_OFFSETS[lane];
    const z = posPlayerCombate.z;
    const speed = _speedMult();
    const fromLeft = Math.random() < 0.5;

    const pr = {
        type: 'lateral',
        lane, x: targetX, z, fromLeft,
        teleDur: 0.85 / speed,
        impactDur: 0.45 / speed,
        t: 0,
        hitApplied: false,
        dano: 10,
        isHit(_px, py, plane) {
            // Lane alvo + não agachado + não saltou alto.
            return plane === lane && player.scale.y > 0.7 && py < 1.4;
        },
    };
    BossVFX.criarTelegraph(pr, _telegraphColorHex(0xb060ff));
    return pr;
}

// Varredura: viga horizontal larga à altura do peito/cara que varre as
// 3 lanes do boss em direcção ao player. Cobre toda a largura — não dá
// para mudar de lane. A única forma de evitar é AGACHAR-SE (S).
function criarVarredura() {
    const z = posPlayerCombate.z;
    const x = posPlayerCombate.x;
    const beamY = 1.35; // altura do peito/cara
    const speed = _speedMult();

    const pr = {
        type: 'varredura',
        x, z, beamY,
        teleDur: 1.0 / speed,
        impactDur: 0.45 / speed,
        t: 0,
        hitApplied: false,
        dano: 14,
        isHit(_px, _py, _plane) {
            // Falha se o player estiver agachado (scale.y baixo).
            // Saltar não ajuda — a viga apanha-o no ar.
            return player.scale.y > 0.7;
        },
    };
    BossVFX.criarTelegraph(pr, _telegraphColorHex(0x60ffaa));
    return pr;
}

const FACTORIES = [criarAereo, criarRasante, criarLateral, criarVarredura];
const FACTORY_TYPES = ['aereo', 'rasante', 'lateral', 'varredura'];

// Tipos que SÓ se evitam saltando (W) ou agachando (S). Em rage mode o boss
// dispara 2 projécteis ao mesmo tempo — não podemos parear estes dois,
// senão o jogador era obrigado a saltar E agachar em simultâneo.
const TYPES_NEED_JUMP = new Set(['rasante']);
const TYPES_NEED_DUCK = new Set(['varredura']);
function _paresIncompativeis(a, b) {
    return (TYPES_NEED_JUMP.has(a) && TYPES_NEED_DUCK.has(b))
        || (TYPES_NEED_DUCK.has(a) && TYPES_NEED_JUMP.has(b));
}

// ----------------------------------------------------------------------
// UPDATE DE CADA PROJÉCTIL
// ----------------------------------------------------------------------
function updateProjectile(pr, deltaTime) {
    pr.t += deltaTime;
    const inImpact = pr.t >= pr.teleDur;

    // -------- TELEGRAPH / IMPACT (delegado ao VFX) --------
    if (inImpact && !pr.launched) {
        pr.launched = true;
        tocarSomAtaqueBoss(pr.type);   // som do ataque, ao lançar o projéctil
        BossVFX.criarProjectil(pr);
    }

    const u = inImpact ? Math.min(1, (pr.t - pr.teleDur) / pr.impactDur) : 0;
    BossVFX.update(pr, u, inImpact);

    // -------- HIT DETECTION no instante de pico (~50% do impact) --------
    if (inImpact && !pr.hitApplied && u >= 0.5) {
        pr.hitApplied = true;
        const py = player.position.y;
        const plane = _laneIdx;
        if (pr.isHit(player.position.x, py, plane)) {
            // dano + flash
            receberDano(pr.dano);
            mostrarDanoFlutuante(50, 66, `-${pr.dano}`, '#ff5060');
            setHpPlayer(playerStats.hp, playerStats.maxHp);
            setLog(`Fui atingido pelo ataque ${pr.type.toUpperCase()}! (-${pr.dano} HP)`);
            _flashRed();
            if (playerStats.hp <= 0) {
                playerStats.derrotado = true;
                pararFaseDesvio();
                if (_onPlayerDerrotado) _onPlayerDerrotado();
            }
        } else {
            if (_onAtaqueEvitado) _onAtaqueEvitado();
        }
    }
}

function _disposeProjectile(pr) {
    BossVFX.dispose(pr);
}

// flash vermelho a cobrir o ecrã quando o jogador é atingido
function _flashRed() {
    let o = document.getElementById('boss-hit-flash');
    if (!o) {
        o = document.createElement('div');
        o.id = 'boss-hit-flash';
        o.style.cssText = `
            position: fixed; inset: 0;
            background: radial-gradient(circle, rgba(255,40,40,0.0), rgba(180,0,0,0.0));
            pointer-events: none; z-index: 320;
            transition: background 0.15s;
        `;
        document.body.appendChild(o);
    }
    o.style.background = 'radial-gradient(circle, rgba(255,80,80,0.45), rgba(120,0,0,0.6))';
    setTimeout(() => {
        o.style.background = 'radial-gradient(circle, rgba(255,40,40,0.0), rgba(180,0,0,0.0))';
    }, 160);
}

// ----------------------------------------------------------------------
// API pública
// ----------------------------------------------------------------------

// Callback opcional: chamado quando o player morre durante a fase de
// desvio. Combate.js liga-o a `finalizarDerrota`.
let _onPlayerDerrotado = null;
export function setOnPlayerDerrotado(fn) { _onPlayerDerrotado = fn; }

let _onAtaqueEvitado = null;
export function setOnAtaqueEvitado(fn) { _onAtaqueEvitado = fn; }

/** Activa a fase de desvio — chamar quando o turno do jogador começa. */
export function iniciarFaseDesvio(force = false) {
    if (_active) return;
    if (!isBossMode() && !force) return;
    _active = true;
    _laneIdx = 1;
    _yState = 'ground';
    _yTimer = 0;
    _spawnTimer = 0.8 + Math.random() * 0.7;
    // garantir que o smoothing arranca da posição actual (centro da arena boss)
    _smoothX.value = posPlayerCombate.x;
    // posiciona o player na lane do meio
    _aplicarPos();
}

/** Pára a fase de desvio — chamar quando o jogador ataca/usa item. */
export function pararFaseDesvio() {
    if (!_active) return;
    _active = false;
    for (const pr of _projectiles) _disposeProjectile(pr);
    _projectiles.length = 0;
    // volta o jogador para a posição central da arena
    _laneIdx = 1;
    _yState = 'ground';
    _yTimer = 0;
    _smoothX.value = posPlayerCombate.x;
    player.position.x = posPlayerCombate.x;
    player.position.y = 0;
    player.userData.baseY = 0;
    player.scale.set(1, 1, 1);
}

export function isFaseDesvioActiva() { return _active; }

/** Update por frame — chamar de dentro do animateCombate. */
export function atualizarFaseDesvio(deltaTime) {
    if (!_active) return;
    // Cap do delta time: se uma transição/lag spike der um frame de 200ms+,
    // os projécteis avançavam 200ms do telegraph numa única atualização e o
    // jogador ficava sem tempo de reagir. Limita-se a ~50ms (≈20 fps min).
    if (deltaTime > 0.05) deltaTime = 0.05;

    _processarInput();
    _atualizarY(deltaTime);
    _aplicarPos();

    // spawn de projécteis — fica mais frequente à medida que o boss perde vida
    _spawnTimer -= deltaTime;
    if (_spawnTimer <= 0) {
        const idx1 = Math.floor(Math.random() * FACTORIES.length);
        const pr = FACTORIES[idx1]();
        _projectiles.push(pr);

        // Gatilho de animação no boss sincronizado com o tempo de aviso (telegraph)
        // Passa o tipo exacto para animações elaboradas (salto, slam, sweep, etc)
        const opts = {};
        if (pr.type === 'lateral') opts.side = pr.fromLeft ? -1 : 1;
        triggerBossAttackAnim(pr.type, pr.teleDur, opts);
        tocarSomMovimentoBoss(pr.type); // Som do movimento físico (preparação)

        // Fase 2 (rage mode, abaixo de 25% HP): dispara um segundo projéctil
        // simultaneamente, evitando o par saltar+agachar.
        if (_isRageMode()) {
            const candidatos = FACTORY_TYPES
                .map((_, i) => i)
                .filter(i => !_paresIncompativeis(pr.type, FACTORY_TYPES[i]));
            const idx2 = candidatos[Math.floor(Math.random() * candidatos.length)];
            const pr2 = FACTORIES[idx2]();
            _projectiles.push(pr2);
            const opts2 = {};
            if (pr2.type === 'lateral') opts2.side = pr2.fromLeft ? -1 : 1;
            triggerBossAttackAnim(pr2.type, pr2.teleDur, opts2);
        }

        const base = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
        _spawnTimer = base / _speedMult();
    }

    // update projécteis
    for (let i = _projectiles.length - 1; i >= 0; i--) {
        const pr = _projectiles[i];
        updateProjectile(pr, deltaTime);
        if (pr.t >= pr.teleDur + pr.impactDur) {
            _disposeProjectile(pr);
            _projectiles.splice(i, 1);
        }
    }
}

// ----------------------------------------------------------------------
// INTERNAS — input/movimento do player
// ----------------------------------------------------------------------
function _processarInput() {
    const a = !!keys.a, d = !!keys.d, w = !!keys.w, s = !!keys.s;

    if (a && !_kPrev.a) _laneIdx = Math.max(0, _laneIdx - 1);
    if (d && !_kPrev.d) _laneIdx = Math.min(2, _laneIdx + 1);
    if (w && !_kPrev.w && _yState === 'ground') { _yState = 'jump'; _yTimer = 0; }
    if (s && !_kPrev.s && _yState === 'ground') { _yState = 'duck'; _yTimer = 0; }

    _kPrev.a = a; _kPrev.d = d; _kPrev.w = w; _kPrev.s = s;
}

function _atualizarY(deltaTime) {
    if (_yState === 'jump') {
        _yTimer += deltaTime;
        if (_yTimer >= JUMP_DUR) { _yState = 'ground'; _yTimer = 0; }
    } else if (_yState === 'duck') {
        _yTimer += deltaTime;
        if (_yTimer >= DUCK_DUR) { _yState = 'ground'; _yTimer = 0; }
    }
}

const _smoothX = { value: posPlayerCombate.x };
function _aplicarPos() {
    const targetX = posPlayerCombate.x + LANE_OFFSETS[_laneIdx];
    _smoothX.value += (targetX - _smoothX.value) * 0.22;
    player.position.x = _smoothX.value;
    
    // O lunge (ataque do jogador) é um offset temporário em Z.
    const lunge = player.userData.lungeOffset || 0;
    player.position.z = posPlayerCombate.z - lunge;

    let py = 0, scaleY = 1;
    if (_yState === 'jump') {
        py = Math.sin((_yTimer / JUMP_DUR) * Math.PI) * JUMP_HEIGHT;
    } else if (_yState === 'duck') {
        // encolhe o player em Y (pose de agachar)
        scaleY = 0.55;
        py = 0;
    }
    player.position.y = py;
    player.userData.baseY = py;
    player.scale.set(1, scaleY, 1);
}
