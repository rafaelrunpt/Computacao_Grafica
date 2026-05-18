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
import { combateScene, posPlayerCombate, isBossMode } from '../world/combate-scene.js';
import { keys } from '../core/input.js';
import { receberDano, playerStats } from './player-stats.js';
import { setHpPlayer, setLog } from '../ui/combate-ui.js';

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
const RAGE_THRESHOLD = 0.25;

export function setBossHpFrac(frac) {
    _bossHpFrac = Math.max(0, Math.min(1, frac));
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
// MATERIAIS — partilhados entre projécteis para não recriar a cada spawn
// ----------------------------------------------------------------------
const matTelegraphAereo = new THREE.MeshBasicMaterial({
    color: 0xff4040, transparent: true, opacity: 0.5,
    side: THREE.DoubleSide, depthWrite: false,
});
const matTelegraphRasante = new THREE.MeshBasicMaterial({
    color: 0xffaa20, transparent: true, opacity: 0.5,
    side: THREE.DoubleSide, depthWrite: false,
});
const matTelegraphLateral = new THREE.MeshBasicMaterial({
    color: 0xb060ff, transparent: true, opacity: 0.5,
    side: THREE.DoubleSide, depthWrite: false,
});
const matTelegraphVarredura = new THREE.MeshBasicMaterial({
    color: 0x60ffaa, transparent: true, opacity: 0.55,
    side: THREE.DoubleSide, depthWrite: false,
});

const matProjAereo = new THREE.MeshStandardMaterial({
    color: 0xff5050, emissive: 0xff2020, emissiveIntensity: 2.2,
    roughness: 0.3, metalness: 0.0,
});
const matProjRasante = new THREE.MeshStandardMaterial({
    color: 0xffaa40, emissive: 0xff8800, emissiveIntensity: 2.5,
    roughness: 0.3, metalness: 0.0,
});
const matProjLateral = new THREE.MeshStandardMaterial({
    color: 0xc080ff, emissive: 0x8030ff, emissiveIntensity: 2.4,
    roughness: 0.3, metalness: 0.0,
});
const matProjVarredura = new THREE.MeshStandardMaterial({
    color: 0x88ffc0, emissive: 0x40dd80, emissiveIntensity: 2.5,
    roughness: 0.3, metalness: 0.0,
});

// ----------------------------------------------------------------------
// PROJECTEIS — factories
// ----------------------------------------------------------------------

// Aéreo: marcador no chão (anel) → cai uma esfera do céu sobre a lane alvo.
function criarAereo() {
    const lane = Math.floor(Math.random() * 3);
    const x = posPlayerCombate.x + LANE_OFFSETS[lane];
    const z = posPlayerCombate.z;
    const speed = _speedMult();

    // marcador no chão
    const ringMat = matTelegraphAereo.clone();
    ringMat.color.setHex(_telegraphColorHex(0xff4040));
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.85, 24),
        ringMat
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    combateScene.add(ring);

    // projéctil (escondido até ao impacto)
    const proj = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 12),
        matProjAereo
    );
    proj.position.set(x, 8, z);
    proj.visible = false;
    combateScene.add(proj);

    // luz pontual
    const light = new THREE.PointLight(0xff5050, 0, 4, 2);
    light.position.set(x, 1.2, z);
    combateScene.add(light);

    return {
        type: 'aereo',
        lane, x, z,
        ring, proj, light,
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
}

// Rasante: barra alaranjada baixa que se materializa e varre o eixo Z
// do boss em direcção ao player. Player tem de SALTAR.
function criarRasante() {
    const z = posPlayerCombate.z;
    const x = posPlayerCombate.x; // varre o meio (largura cobre as 3 lanes)
    const speed = _speedMult();

    // marcador no chão — linha horizontal baixa
    const barMat = matTelegraphRasante.clone();
    barMat.color.setHex(_telegraphColorHex(0xffaa20));
    const bar = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 0.05, 0.5),
        barMat
    );
    bar.position.set(x, 0.06, z);
    combateScene.add(bar);

    // projéctil — uma "onda" baixa
    const proj = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 0.45, 0.7),
        matProjRasante
    );
    proj.position.set(x, 0.25, z - 4);
    proj.visible = false;
    combateScene.add(proj);

    const light = new THREE.PointLight(0xffaa30, 0, 6, 2);
    light.position.set(x, 0.5, z);
    combateScene.add(light);

    return {
        type: 'rasante',
        x, z,
        bar, proj, light,
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
    const teleHex = _telegraphColorHex(0xb060ff);

    // marcador — coluna fina vertical na lane alvo
    const colMat = matTelegraphLateral.clone();
    colMat.color.setHex(teleHex);
    const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 2.2, 0.18),
        colMat
    );
    col.position.set(targetX, 1.0, z);
    combateScene.add(col);

    // seta a apontar a direção em que o projéctil vem — fica no lado
    // de origem e aponta para a lane alvo
    const arrowMat = matTelegraphLateral.clone();
    arrowMat.color.setHex(teleHex);
    const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.85, 4),
        arrowMat
    );
    arrow.position.set(fromLeft ? -3.6 : 3.6, 1.2, z);
    // o cone aponta por defeito em +Y; rotação -π/2 em Z faz apontar em
    // +X (origem à esquerda, ponta para a direita) e +π/2 em -X
    arrow.rotation.z = fromLeft ? -Math.PI / 2 : Math.PI / 2;
    combateScene.add(arrow);

    // projéctil — esfera grande
    const proj = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 14, 10),
        matProjLateral
    );
    const startX = fromLeft ? -8 : 8;
    proj.position.set(startX, 1.2, z);
    proj.visible = false;
    combateScene.add(proj);

    const light = new THREE.PointLight(0xc080ff, 0, 5, 2);
    light.position.set(targetX, 1.2, z);
    combateScene.add(light);

    return {
        type: 'lateral',
        lane, x: targetX, z, fromLeft,
        col, arrow, proj, light,
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
}

// Varredura: viga horizontal larga à altura do peito/cara que varre as
// 3 lanes do boss em direcção ao player. Cobre toda a largura — não dá
// para mudar de lane. A única forma de evitar é AGACHAR-SE (S).
function criarVarredura() {
    const z = posPlayerCombate.z;
    const x = posPlayerCombate.x;
    const beamY = 1.35; // altura do peito/cara
    const speed = _speedMult();

    // marcador — parede fina vertical à altura do peito a piscar
    const wallMat = matTelegraphVarredura.clone();
    wallMat.color.setHex(_telegraphColorHex(0x60ffaa));
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 0.55, 0.25),
        wallMat
    );
    wall.position.set(x, beamY, z);
    combateScene.add(wall);

    // projéctil — viga horizontal larga
    const proj = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 0.65, 0.7),
        matProjVarredura
    );
    proj.position.set(x, beamY, z - 4);
    proj.visible = false;
    combateScene.add(proj);

    const light = new THREE.PointLight(0x70ffaa, 0, 6, 2);
    light.position.set(x, beamY + 0.3, z);
    combateScene.add(light);

    return {
        type: 'varredura',
        x, z, beamY,
        bar: wall, proj, light,
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
}

const FACTORIES = [criarAereo, criarRasante, criarLateral, criarVarredura];

// ----------------------------------------------------------------------
// UPDATE DE CADA PROJÉCTIL
// ----------------------------------------------------------------------
function updateProjectile(pr, deltaTime) {
    pr.t += deltaTime;
    const teleT = Math.min(1, pr.t / pr.teleDur);
    const inImpact = pr.t >= pr.teleDur;

    // -------- TELEGRAPH (a piscar) --------
    if (!inImpact) {
        const blink = 0.45 + 0.55 * Math.abs(Math.sin(pr.t * 14));
        if (pr.ring)  pr.ring.material.opacity  = 0.35 + blink * 0.45;
        if (pr.bar)   pr.bar.material.opacity   = 0.35 + blink * 0.45;
        if (pr.col)   pr.col.material.opacity   = 0.35 + blink * 0.45;
        if (pr.arrow) pr.arrow.material.opacity = 0.40 + blink * 0.55;
        return;
    }

    // -------- IMPACT (projéctil visível + movimento) --------
    pr.proj.visible = true;
    const u = Math.min(1, (pr.t - pr.teleDur) / pr.impactDur);
    if (pr.light) pr.light.intensity = 4.0 * (1 - u);

    if (pr.type === 'aereo') {
        pr.proj.position.y = 8 * (1 - u) + 0.5 * u;
        if (pr.ring) pr.ring.material.opacity = 0.6 * (1 - u);
    } else if (pr.type === 'rasante') {
        // varre do z = -4 (lado do boss) até z = +3 (passa o player)
        pr.proj.position.z = pr.z - 4 + 7 * u;
        if (pr.bar) pr.bar.material.opacity = 0.6 * (1 - u);
    } else if (pr.type === 'lateral') {
        const startX = pr.fromLeft ? -8 : 8;
        pr.proj.position.x = startX + (pr.x - startX) * u + (pr.fromLeft ? 1 : -1) * (u - 1) * 2;
        if (pr.col)   pr.col.material.opacity   = 0.6 * (1 - u);
        if (pr.arrow) pr.arrow.material.opacity = 0.6 * (1 - u);
    } else if (pr.type === 'varredura') {
        // varre do boss para o player, mantendo a altura do peito
        pr.proj.position.z = pr.z - 4 + 7 * u;
        pr.proj.position.y = pr.beamY;
        if (pr.bar) pr.bar.material.opacity = 0.6 * (1 - u);
    }

    // -------- HIT DETECTION no instante de pico (~50% do impact) --------
    if (!pr.hitApplied && u >= 0.5) {
        pr.hitApplied = true;
        const py = player.position.y;
        const plane = _laneIdx;
        if (pr.isHit(player.position.x, py, plane)) {
            // dano + flash
            receberDano(pr.dano);
            setHpPlayer(playerStats.hp, playerStats.maxHp);
            setLog(`Fui atingido pelo ataque ${pr.type.toUpperCase()}! (-${pr.dano} HP)`);
            _flashRed();
            if (playerStats.hp <= 0) {
                playerStats.derrotado = true;
                pararFaseDesvio();
                if (_onPlayerDerrotado) _onPlayerDerrotado();
            }
        }
    }
}

function _disposeProjectile(pr) {
    if (pr.ring)  combateScene.remove(pr.ring);
    if (pr.bar)   combateScene.remove(pr.bar);
    if (pr.col)   combateScene.remove(pr.col);
    if (pr.arrow) combateScene.remove(pr.arrow);
    if (pr.proj)  combateScene.remove(pr.proj);
    if (pr.light) combateScene.remove(pr.light);
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

/** Activa a fase de desvio — chamar quando o turno do jogador começa. */
export function iniciarFaseDesvio() {
    if (_active) return;
    if (!isBossMode()) return;
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

    _processarInput();
    _atualizarY(deltaTime);
    _aplicarPos();

    // spawn de projécteis — fica mais frequente à medida que o boss perde vida
    _spawnTimer -= deltaTime;
    if (_spawnTimer <= 0) {
        const factory = FACTORIES[Math.floor(Math.random() * FACTORIES.length)];
        _projectiles.push(factory());
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
    player.position.z = posPlayerCombate.z;

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
