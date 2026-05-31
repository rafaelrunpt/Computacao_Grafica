import { grassZones, limparZonaBatalha } from '../world/mapa.js';
import { ganharXP, playerStats, receberDano, curar, recuperarTotal, getAtkEfetivo, getCuraPosCombate, getChanceEvasao, getOculosVidente } from './player-stats.js';
import { ganharCintilas } from './currency.js';
import { entrarCombate, sairCombate, getMundoSnapshot, sairBossParaCastelo } from '../core/transicoes.js';
import { notificarVitoria as notificarVitoriaQuest } from './merchant-quest.js';
import { setBossMode, isBossMode, setTipoInimigo, getInimigoActivo } from '../world/combate-scene.js';
import { getBossRoot } from '../entities/boss.js';
import { iniciarFaseDesvio, pararFaseDesvio, atualizarFaseDesvio, isFaseDesvioActiva, setOnPlayerDerrotado, setBossHpFrac } from './boss-attacks.js';
import { settings } from './settings.js';

// quando o player morre durante a fase de desvio, encerrar o combate
setOnPlayerDerrotado(() => {
    setBotoesAtivos(false);
    setLog('Caíste perante o Soberano...');
    setTimeout(() => sairDaArena(), 1200);
});
import { getItens, usarItem, adicionarItem, CATALOGO, quantidade as qtdItem } from './inventario.js';
import { playSFX, switchMusic, stopMusic, tocarFanfarraVitoria, tocarSomAtaquePlayer, tocarSomAtaqueInimigo, tocarSomSpikeBoss, tocarSomShockBoss } from './audio.js';
import { mostrarRecompensa } from '../ui/popup-recompensa.js';
import { player, setEspadaMaoVisivel } from '../entities/jogador.js';
import {
    mostrarCombateUI, esconderCombateUI, setCombateHandlers,
    setHpInimigo, setHpPlayer, setLog, setBotoesAtivos, preencherItens,
    setAtaqueSlots, setPresagio, setStatusPlayer, mostrarDanoFlutuante
} from '../ui/combate-ui.js';
import {
    getSlotAtaque, getCooldownSlot, podeUsarSlot,
    aplicarCooldown, tickCooldowns, resetCooldowns, resolverAtaque, getAfinidade,
} from './ataques.js';
import { lancarAnimacaoAtaque, lancarEfeitoBuff, dispararProjetilSprite, playFramesFX, playSpriteFX } from '../ui/combate-anims.js';
import { animarAtaqueWraith } from '../entities/inimigo-wraith.js';
import { animarAtaqueNucleo } from '../entities/inimigo-nucleo.js';
import { combateCamera, combateBossCamera } from '../core/renderer.js';
import * as THREE from 'three';

export const estadoJogo = { emCombate: false, combateX: 0, combateZ: 0 };

// Contador de vitórias para a recompensa dos Brincos da Aurora (5 vitórias).
let _vitoriasParaBrincos = 0;
const VITORIAS_BRINCOS = 5;

// ----------------------------------------------------------------------
// EFEITO DE GLITCH ROXO (mantido — toca antes da transição para a arena)
// ----------------------------------------------------------------------
const glitchCanvas = document.createElement('canvas');
glitchCanvas.style.cssText = `
    position: fixed; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    display: none;
    z-index: 250;
`;
document.body.appendChild(glitchCanvas);
const gCtx = glitchCanvas.getContext('2d');

function resizeGlitch() {
    glitchCanvas.width  = window.innerWidth;
    glitchCanvas.height = window.innerHeight;
}
resizeGlitch();
window.addEventListener('resize', resizeGlitch);

let glitchRaf = null, glitchStartTime = 0, glitchDuration = 0, glitchOnEnd = null;

function drawGlitch(t) {
    const w = glitchCanvas.width, h = glitchCanvas.height;
    gCtx.clearRect(0, 0, w, h);

    const alpha = 0.35 + 0.35 * Math.sin(t * 18);
    gCtx.fillStyle = `rgba(40, 0, 70, ${alpha})`;
    gCtx.fillRect(0, 0, w, h);

    const nLinhas = 6 + Math.floor(Math.random() * 8);
    for (let i = 0; i < nLinhas; i++) {
        const y      = Math.random() * h;
        const lh     = 2 + Math.random() * 18;
        const offset = (Math.random() - 0.5) * 80;
        const r = 120 + Math.floor(Math.random() * 80);
        const b = 180 + Math.floor(Math.random() * 75);
        const a = 0.4 + Math.random() * 0.5;
        gCtx.fillStyle = `rgba(${r},0,${b},${a})`;
        gCtx.fillRect(0, y, w, lh);
        gCtx.save();
        gCtx.globalCompositeOperation = 'screen';
        gCtx.fillStyle = `rgba(${r},0,${b},${a * 0.6})`;
        gCtx.fillRect(offset, y, w * (0.3 + Math.random() * 0.5), lh * 0.5);
        gCtx.restore();
    }

    gCtx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 3) gCtx.fillRect(0, y, w, 1);

    const nPixels = 300 + Math.floor(Math.random() * 400);
    for (let i = 0; i < nPixels; i++) {
        const px = Math.random() * w, py = Math.random() * h;
        const bright = Math.random() > 0.5;
        gCtx.fillStyle = bright
            ? `rgba(220,160,255,${0.4 + Math.random() * 0.6})`
            : `rgba(80,0,140,${0.5 + Math.random() * 0.5})`;
        gCtx.fillRect(px, py, 2 + Math.random() * 4, 1 + Math.random() * 3);
    }

    const grad = gCtx.createRadialGradient(w/2, h/2, h * 0.25, w/2, h/2, h * 0.85);
    const vAlpha = 0.3 + 0.4 * Math.abs(Math.sin(t * 6));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(60,0,100,${vAlpha})`);
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, w, h);
}

function glitchLoop(timestamp) {
    if (!glitchStartTime) glitchStartTime = timestamp;
    const elapsed = (timestamp - glitchStartTime) / 1000;
    if (elapsed >= glitchDuration) {
        gCtx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height);
        glitchCanvas.style.display = 'none';
        if (glitchOnEnd) glitchOnEnd();
        glitchRaf = null;
        return;
    }
    drawGlitch(elapsed);
    glitchRaf = requestAnimationFrame(glitchLoop);
}

function startGlitch(duration, onEnd) {
    if (glitchRaf) cancelAnimationFrame(glitchRaf);
    glitchStartTime = 0;
    glitchDuration = duration;
    glitchOnEnd = onEnd;
    glitchCanvas.style.display = 'block';
    glitchRaf = requestAnimationFrame(glitchLoop);
}

// ----------------------------------------------------------------------
// VERIFICAÇÃO DE ENCONTRO (chamada pelo loop do mundo)
// ----------------------------------------------------------------------
export function verificarEncontro(_x, _z) {
    // Encontros já não ocorrem automaticamente — o jogador tem de premir E
    // no centro de uma zona de batalha (ver `zonaBatalhaProximoCentro` /
    // `iniciarCombateEm`). Esta função é mantida por compatibilidade.
}

// Devolve a zona de batalha cujo centro está a menos de `raio` do ponto (x,z),
// ou null se o jogador não está perto de nenhum centro.
export function zonaBatalhaProximoCentro(x, z, raio = 1.6) {
    if (estadoJogo.emCombate || playerStats.derrotado) return null;
    const r2 = raio * raio;
    for (const zona of grassZones) {
        const cx = (zona.min.x + zona.max.x) / 2;
        const cz = (zona.min.z + zona.max.z) / 2;
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz <= r2) return zona;
    }
    return null;
}

export function iniciarCombateEm(x, z, tipo = 'wraith') {
    if (estadoJogo.emCombate || playerStats.derrotado) return;
    estadoJogo.combateX = x;
    estadoJogo.combateZ = z;
    _resetItemCooldowns();
    _tipoEncontro = (tipo === 'nucleo') ? 'nucleo' : 'wraith';
    setTipoInimigo(_tipoEncontro);
    iniciarCombate();
}

// ----------------------------------------------------------------------
// ESTADO DE COMBATE (turn-based simples)
// ----------------------------------------------------------------------
// Inimigo "duro" — fica restringido às zonas a norte da ponte. Stats
// aumentados (mais HP, mais drops) já que é o único inimigo dessas zonas.
const inimigoBase = {
    nome: 'SHACO CORROMPIDO',
    hp: 46, maxHp: 46,
    atk: 5,
    xpDrop: 45,
    cintilasDrop: 30,
    tipo: 'wraith',
};
// Inimigo fraco (Núcleo Corrompido) — manifesta-se nas terras a sul, junto à loja.
// Drops e vida reduzidos para servir de "treino" no início.
const nucleoBase = {
    nome: 'NÚCLEO CORROMPIDO',
    hp: 18, maxHp: 18,
    atk: 3,
    xpDrop: 40,
    cintilasDrop: 16,
    tipo: 'nucleo',
};
let inimigoAtual = { ...inimigoBase };
let _tipoEncontro = 'wraith';

// ----------------------------------------------------------------------
// DIFICULDADE ESCALÁVEL
// ----------------------------------------------------------------------
// Nível de dificuldade do combate. É definido em novoInimigo() e
// iniciarBossFight() a partir de nivelDificuldade(): acompanha o nível
// do jogador e, no modo noite, sobe +2 (ver BONUS_NIVEL_NOITE).
//
// A escala afecta HP, ATK, XP e Cintilas a partir dos valores `*Base`.
// Mantém-se "puramente multiplicativo" para ser fácil de afinar.
let _nivelInimigo = 1;
const ESCALA = {
    hp:       (lvl) => 1 + (lvl - 1) * 0.35,   // +35% HP por nível
    atk:      (lvl) => 1 + (lvl - 1) * 0.20,   // +20% ATK por nível
    xp:       (lvl) => 1 + (lvl - 1) * 0.50,   // +50% XP por nível
    cintilas: (lvl) => 1 + (lvl - 1) * 0.60,   // +60% Cintilas por nível
};

export function setNivelInimigo(n) { _nivelInimigo = Math.max(1, n | 0); }
export function getNivelInimigo()  { return _nivelInimigo; }

// Modo noite torna os encontros e o boss +2 níveis mais difíceis.
const BONUS_NIVEL_NOITE = 2;

// Nível de dificuldade do próximo combate: acompanha o nível do jogador
// e, no modo noite, sobe BONUS_NIVEL_NOITE. Aplica-se a encontros e boss.
function nivelDificuldade() {
    return playerStats.level + (settings.nightMode ? BONUS_NIVEL_NOITE : 0);
}

// ----------------------------------------------------------------------
// ATAQUES DOS INIMIGOS NORMAIS — cada tipo de inimigo tem o seu conjunto
// ----------------------------------------------------------------------
//   multATK — multiplicador do ATK    hits — nº de golpes
//   efeito  — null | 'enfraquecer' | 'roubo'    som — chave em audio.js
//   cor     — tinta (rgb) do flash    perigo — 1..3, mostrado pelos Óculos
const ATAQUES_WRAITH = [
    { nome: 'Foice do Vazio',         multATK: 1.30,          efeito: null,          som: 'garra',     cor: '180,80,255', perigo: 3 },
    { nome: 'Lua Cárdena',            multATK: 1.10,          efeito: 'roubo',       som: 'dreno',     cor: '200,90,255', perigo: 2 },
    { nome: 'Verberação Fantasmal',   multATK: 0.70, hits: 2, efeito: null,          som: 'estilhaco', cor: '170,70,230', perigo: 2 },
    { nome: 'Espinho Rúnico',         multATK: 0.85,          efeito: 'enfraquecer', som: 'sopro',     cor: '150,60,220', perigo: 2 },
    { nome: 'Talho Profano',          multATK: 1.45,          efeito: null,          som: 'toque',     cor: '190,70,255', perigo: 3 },
];
const ATAQUES_NUCLEO = [
    { nome: 'Lascas do Vazio',   multATK: 1.00, efeito: null,          som: 'cuspo',  cor: '170,90,235',  perigo: 1 },
    { nome: 'Praga Rúnica',      multATK: 0.80, efeito: 'enfraquecer', som: 'baba',   cor: '120,70,210',  perigo: 2 },
    { nome: 'Esmagamento Ímpio', multATK: 1.35, efeito: null,          som: 'embate', cor: '210,100,255', perigo: 2 },
];
function pickAtaqueInimigo() {
    const pool = _tipoEncontro === 'nucleo' ? ATAQUES_NUCLEO : ATAQUES_WRAITH;
    return pool[Math.floor(Math.random() * pool.length)];
}
// Golpe que o inimigo vai usar no próximo turno — telegrafado para os Óculos.
let _proximoAtaqueInimigo = pickAtaqueInimigo();
// Debuff activo: o próximo golpe do jogador sai enfraquecido (Sopro Corrompido).
let _playerEnfraquecido = false;
// Escudo místico (Véu Arcano): reduz dano recebido em _escudoValor enquanto _escudoTurnos > 0.
let _escudoTurnos = 0;
let _escudoValor = 0;

// Define o debuff de enfraquecer e actualiza o indicador de estado na placa.
function _setEnfraquecido(on) {
    _playerEnfraquecido = on;
    _atualizarStatusPlayer();
}

function _atualizarStatusPlayer() {
    const partes = [];
    if (_playerEnfraquecido) partes.push('⚠ Enfraquecido');
    if (_escudoTurnos > 0) partes.push(`🛡 Véu (${_escudoTurnos})`);
    setStatusPlayer(partes.length ? partes.join('  ') : null);
}

// Mostra/esconde o presságio (Óculos do Vidente) conforme o equipamento.
function _atualizarPresagio() {
    setPresagio((!isBossMode() && getOculosVidente() && _proximoAtaqueInimigo)
        ? _proximoAtaqueInimigo : null);
}

// Âncora dinâmica (% do ecrã) de cada combatente para os números de dano
// e efeitos. No modo boss, acompanha o movimento nas lanes.
function _ancoraCombatente(alvo) {
    if (isBossMode()) {
        const cam = combateBossCamera;
        if (alvo === 'inimigo') {
            const root = getBossRoot();
            const bPos = root ? root.position : new THREE.Vector3(0, 0, -3.5);
            // altura do peito do boss (~2.8)
            const _v = new THREE.Vector3(bPos.x, bPos.y + 2.8, bPos.z).project(cam);
            return { x: (_v.x * 0.5 + 0.5) * 100, y: (-_v.y * 0.5 + 0.5) * 100 };
        } else {
            // altura do peito do player (~1.2)
            const _v = new THREE.Vector3(player.position.x, player.position.y + 1.2, player.position.z).project(cam);
            return { x: (_v.x * 0.5 + 0.5) * 100, y: (-_v.y * 0.5 + 0.5) * 100 };
        }
    }
    return alvo === 'inimigo' ? { x: 63, y: 25 } : { x: 38, y: 35 };
}

// Calcula stats finais a partir da base + nível. Encapsulado para
// se poder trocar a fórmula sem mexer no resto do combate.
function escalarStats(base, lvl = _nivelInimigo) {
    const hp = Math.round(base.hp * ESCALA.hp(lvl));
    return {
        nome: base.nome,
        hp,
        maxHp: hp,
        atk:           Math.max(1, Math.round(base.atk           * ESCALA.atk(lvl))),
        xpDrop:        Math.max(1, Math.round((base.xpDrop      ?? 0) * ESCALA.xp(lvl))),
        cintilasDrop:  Math.max(0, Math.round((base.cintilasDrop ?? 0) * ESCALA.cintilas(lvl))),
        nivel: lvl,
    };
}

function novoInimigo() {
    // dificuldade acompanha o nível do jogador (+2 no modo noite)
    setNivelInimigo(nivelDificuldade());
    const base = _tipoEncontro === 'nucleo' ? nucleoBase : inimigoBase;
    inimigoAtual = escalarStats(base);
    _escudoTurnos = 0;
    _escudoValor = 0;
    _setEnfraquecido(false);
    _proximoAtaqueInimigo = pickAtaqueInimigo();
}

function refreshHpUI() {
    setHpInimigo(inimigoAtual.hp, inimigoAtual.maxHp);
    setHpPlayer(playerStats.hp, playerStats.maxHp);
}

// bloqueia ações enquanto uma animação de turno está a decorrer
let turnoBloqueado = false;
function bloquearTurno(ms, fim) {
    turnoBloqueado = true;
    setBotoesAtivos(false);
    setTimeout(() => {
        turnoBloqueado = false;
        if (fim) fim();
    }, ms);
}

// ---- ações ----
function atualizarSlotsUI() {
    setAtaqueSlots(
        { ataque: getSlotAtaque(0), cooldown: getCooldownSlot(0) },
        { ataque: getSlotAtaque(1), cooldown: getCooldownSlot(1) },
        { ataque: getSlotAtaque(2), cooldown: getCooldownSlot(2) },
        { ataque: getSlotAtaque(3), cooldown: getCooldownSlot(3) },
    );
}

function acaoAtacarSlot(idx) {
    if (turnoBloqueado) return;
    const at = getSlotAtaque(idx);
    if (!at) return;
    if (!podeUsarSlot(idx)) {
        setLog(`${at.nome} ainda em recarga.`);
        return;
    }

    // BUFF (Véu Arcano e afins) — não causa dano, aplica estado e consome turno.
    if (at.buff) {
        aplicarCooldown(idx);
        atualizarSlotsUI();
        if (at.buff.tipo === 'reducao_dano') {
            _escudoTurnos = at.buff.duracao;
            _escudoValor = at.buff.valor;
            _atualizarStatusPlayer();
            const ancP = _ancoraCombatente('player');
            mostrarDanoFlutuante(ancP.x, ancP.y, 'VÉU', '#c4a0ff');
            pulsarPlayer('180,130,255');
            lancarEfeitoBuff(at, ancP);
            setLog(`Invocaste ${at.nome}! Dano reduzido em ${Math.round(at.buff.valor * 100)}% por ${at.buff.duracao} rondas.`);
        }
        const animDur = (at.anim && at.anim.dur) || 700;
        tocarSomAtaquePlayer(at.id);
        bloquearTurno(animDur + 100, turnoInimigo);
        return;
    }

    // NÃO paramos a fase de desvio — o boss continua a atacar enquanto o
    // jogador executa o seu ataque (assim os projécteis não dão pausa).

    const resultado = resolverAtaque(idx, getAtkEfetivo());
    // Afinidade elemental: certos ataques são fortes/fracos contra cada inimigo.
    const tipoAlvo = isBossMode() ? 'boss' : _tipoEncontro;
    const afinidade = getAfinidade(at.elemento, tipoAlvo);
    let afinidadeLabel = '';
    if (resultado && !resultado.falhou && afinidade !== 1) {
        resultado.totalDano = Math.max(1, Math.round(resultado.totalDano * afinidade));
        afinidadeLabel = afinidade > 1 ? ' ⚡ Eficaz!' : ' 🛡 Resistente.';
    }
    // Sopro Corrompido: o próximo golpe do jogador sai enfraquecido (−30%).
    if (_playerEnfraquecido && resultado && !resultado.falhou) {
        resultado.totalDano = Math.max(1, Math.round(resultado.totalDano * 0.7));
        _setEnfraquecido(false);
    }
    aplicarCooldown(idx);
    atualizarSlotsUI();

    setLog(`Usaste ${at.nome}...`);

    const danoTotal = resultado.falhou ? 0 : resultado.totalDano;
    const danoPorHit = resultado.hitsTotais > 0 ? Math.floor(danoTotal / Math.max(1, resultado.hitsAcertos)) : 0;
    const novaHp = Math.max(0, inimigoAtual.hp - danoTotal);
    const vaiVencer = !resultado.falhou && novaHp <= 0;

    const animDur = (at.anim && at.anim.dur) || 800;

    const aplicarImpacto = (parcial) => {
        if (resultado.falhou) {
            setLog(`Falhaste — ${at.nome} não acertou.`);
            const af = _ancoraCombatente('inimigo');
            mostrarDanoFlutuante(af.x, af.y, 'FALHOU', '#ffffff');
            return;
        }
        inimigoAtual.hp = Math.max(0, inimigoAtual.hp - parcial);
        const ai = _ancoraCombatente('inimigo');
        const corDano = afinidade > 1 ? '#8effa0' : (afinidade < 1 ? '#ffe070' : '#ffe070');
        mostrarDanoFlutuante(ai.x, ai.y, `-${parcial}`, corDano);
        if (resultado.hitsTotais > 1) {
            setLog(`${at.nome}! ${resultado.hitsAcertos}/${resultado.hitsTotais} acertos — ${danoTotal} dano.${afinidadeLabel}`);
        } else {
            setLog(`${at.nome}! ${danoTotal} de dano.${afinidadeLabel}`);
        }
        refreshHpUI();
        // Notifica a fase de desvio do novo HP — projécteis aceleram e
        // entram em rage mode (cores trocadas) abaixo dos 25%.
        if (isBossMode()) {
            setBossHpFrac(inimigoAtual.hp / inimigoAtual.maxHp);
        }
    };

    tocarSomAtaquePlayer(at.id);
    const danoBaseHit = Math.floor(danoTotal / Math.max(1, resultado.hitsTotais));
    lancarAnimacaoAtaque(at, resultado.falhou, {
        onImpacto1: () => {
            if (resultado.hitsTotais > 1) {
                aplicarImpacto(danoBaseHit);
            } else {
                aplicarImpacto(danoTotal);
            }
        },
        onImpacto2: resultado.hitsTotais > 1 ? () => aplicarImpacto(resultado.hitsTotais > 2 ? danoBaseHit : danoTotal - danoBaseHit) : null,
        onImpacto3: resultado.hitsTotais > 2 ? () => aplicarImpacto(danoTotal - (danoBaseHit * 2)) : null,
    });

    bloquearTurno(animDur + 100, vaiVencer ? finalizarVitoria : turnoInimigo);
}

// ----------------------------------------------------------------------
// COOLDOWNS DE ITENS (específico do combate actual)
// ----------------------------------------------------------------------
const _itemCooldowns = {}; // { id: turnos }

function _tickItemCooldowns() {
    for (const id in _itemCooldowns) {
        if (_itemCooldowns[id] > 0) _itemCooldowns[id]--;
    }
}

function _resetItemCooldowns() {
    for (const id in _itemCooldowns) delete _itemCooldowns[id];
}

function _podeUsarItem(id) {
    return (_itemCooldowns[id] || 0) <= 0;
}

function _aplicarCooldownItem(id, turnos = 3) {
    _itemCooldowns[id] = turnos;
}

function _getItensComCD() {
    return getItens().map(it => ({
        ...it,
        cooldown: _itemCooldowns[it.id] || 0
    }));
}

function acaoItem(item) {
    if (turnoBloqueado) return;
    if (item.quantidade <= 0) return;
    
    // Verifica cooldown
    if (!_podeUsarItem(item.id)) {
        setLog(`Ainda não podes usar ${item.nome} novamente (aguarda ${_itemCooldowns[item.id]} rondas).`);
        return;
    }

    const r = usarItem(item.id);
    setLog(r.mensagem);
    refreshHpUI();

    if (!r.ok) {
        preencherItens(_getItensComCD(), acaoItem);
        setBotoesAtivos(true);
        return;
    }

    // Aplica cooldown se for consumível (poção)
    if (item.efeito && (item.efeito.tipo === 'curar' || item.efeito.tipo === 'curarTotal')) {
        _aplicarCooldownItem(item.id, 3);
    }

    // refresca o painel para mostrar nova quantidade e cooldown
    preencherItens(_getItensComCD(), acaoItem);

    // Igual ao ataque: a fase de desvio mantém-se a correr enquanto o item
    // é usado — o jogador tem de continuar a esquivar.
    bloquearTurno(800, turnoInimigo);
}

function acaoFugir() {
    if (turnoBloqueado) return;
    const sucesso = Math.random() < 0.6;
    if (sucesso) {
        setLog('Conseguiste fugir!');
        bloquearTurno(700, () => finalizarFuga());
    } else {
        setLog('Falhaste a fuga! O inimigo aproveita...');
        bloquearTurno(800, turnoInimigo);
    }
}

function _devolverTurnoAoPlayer() {
    _tickItemCooldowns();
    setBotoesAtivos(true);
    _atualizarPresagio();
    if (isBossMode() && !playerStats.derrotado && inimigoAtual.hp > 0) {
        iniciarFaseDesvio();
    }
    // actualiza a UI do alforge se estiver aberto para mostrar novos CDs
    preencherItens(_getItensComCD(), acaoItem);
}

function turnoInimigo() {
    if (inimigoAtual.hp <= 0) return;

    // BOSS: não causa dano no próprio turno — todo o dano dele vem da
    // fase de desvio (projécteis enquanto o jogador escolhe ação).
    // Aqui só fazemos progredir cooldowns e devolvemos o turno.
    if (isBossMode()) {
        setLog(`${inimigoAtual.nome} encara-te e prepara o próximo ataque...`);
        tickCooldowns();
        atualizarSlotsUI();
        _devolverTurnoAoPlayer();
        return;
    }

    // O inimigo usa o golpe que tinha telegrafado (visível com os Óculos).
    const at = _proximoAtaqueInimigo || pickAtaqueInimigo();

    // Esquiva (Máscara do Eclipse)
    if (Math.random() < getChanceEvasao()) {
        setLog(`${inimigoAtual.nome} conjura ${at.nome}, mas esquivaste-te! Sem dano.`);
        _proximoAtaqueInimigo = pickAtaqueInimigo();
        tickCooldowns();
        atualizarSlotsUI();
        _devolverTurnoAoPlayer();
        return;
    }

    // dano do golpe escolhido (um ou mais hits)
    let dano = 0;
    const hits = at.hits || 1;
    for (let h = 0; h < hits; h++) {
        dano += Math.max(1, Math.round(inimigoAtual.atk * at.multATK) + Math.floor(Math.random() * 3));
    }
    // Véu Arcano: reduz dano recebido enquanto _escudoTurnos > 0.
    let escudoExtra = '';
    if (_escudoTurnos > 0 && _escudoValor > 0) {
        const danoOriginal = dano;
        dano = Math.max(1, Math.round(dano * (1 - _escudoValor)));
        escudoExtra = ` Véu Arcano absorveu ${danoOriginal - dano}.`;
        _escudoTurnos--;
        _atualizarStatusPlayer();
    }

    const aplicarDano = () => {
        receberDano(dano);
        tocarSomAtaqueInimigo(at.som);
        pulsarPlayer(at.cor);
        const ancP = _ancoraCombatente('player');
        mostrarDanoFlutuante(ancP.x, ancP.y, `-${dano}`, '#ff5060');

        let extra = '';
        if (at.efeito === 'enfraquecer') {
            _setEnfraquecido(true);
            extra = ' O teu próximo golpe sairá enfraquecido!';
        } else if (at.efeito === 'roubo') {
            const drenado = Math.max(1, Math.round(dano * 0.5));
            inimigoAtual.hp = Math.min(inimigoAtual.maxHp, inimigoAtual.hp + drenado);
            const ancI = _ancoraCombatente('inimigo');
            mostrarDanoFlutuante(ancI.x, ancI.y, `+${drenado}`, '#88ff99');
            extra = ` Drenou ${drenado} HP para si.`;
        }
        setLog(`${inimigoAtual.nome} usa ${at.nome}! Sofreste ${dano} de dano.${escudoExtra}${extra}`);
        refreshHpUI();

        if (playerStats.hp <= 0) {
            bloquearTurno(900, finalizarDerrota);
            return;
        }
        _proximoAtaqueInimigo = pickAtaqueInimigo();
        tickCooldowns();
        atualizarSlotsUI();
        _devolverTurnoAoPlayer();
    };

    // Wraith: tocar sequência de PNGs do ataque na posição do player.
    if (_tipoEncontro === 'wraith') {
        const _frames = (folder, start) => {
            const arr = [];
            for (let i = 0; i < 6; i++) {
                arr.push(`assets/vfx/wraith/${folder}/Alternative_1_${String(start + i).padStart(2, '0')}.png`);
            }
            return arr;
        };
        const WRAITH_VFX = {
            'Foice do Vazio':       _frames('foice',      1),
            'Lua Cárdena':          _frames('lua',        7),
            'Verberação Fantasmal': _frames('verberacao', 13),
            'Espinho Rúnico':       _frames('espinho',    19),
            'Talho Profano':        _frames('talho',      25),
        };
        const WRAITH_SOM = {
            'Foice do Vazio':       'slash3.mp3',
            'Lua Cárdena':          'slash4.mp3',
            'Verberação Fantasmal': 'slash4.mp3',
            'Espinho Rúnico':       'slash3.mp3',
            'Talho Profano':        'slash3.mp3',
        };
        const WRAITH_MOVE = {
            'Foice do Vazio':       'foice',
            'Lua Cárdena':          'lua',
            'Verberação Fantasmal': 'verberacao',
            'Espinho Rúnico':       'espinho',
            'Talho Profano':        'talho', // ataque mais pesado — usa as 2 mãos + asas
        };
        const frames = WRAITH_VFX[at.nome];
        if (frames) {
            // Animação das mãos do wraith — começa imediatamente
            animarAtaqueWraith(getInimigoActivo(), WRAITH_MOVE[at.nome] || 'foice', 600);

            // O slash aparece quando as mãos chicoteiam para a frente (~300ms depois)
            const SLASH_DELAY = 300;
            const somFile = WRAITH_SOM[at.nome];
            setTimeout(() => {
                if (somFile) {
                    const a = new Audio(`assets/sounds/Attacks/wraith/${somFile}`);
                    a.volume = 0.75;
                    a.play().catch(() => {});
                }
            }, SLASH_DELAY);
            // Slash sobre a cabeça/peito do player, ligeiramente para o lado do wraith.
            const _v = new THREE.Vector3(-2.0, 2.8, 0).project(combateCamera);
            const px = (_v.x * 0.5 + 0.5) * 100;
            const py = (-_v.y * 0.5 + 0.5) * 100;

            const animDur = 1000 / 18 * frames.length; // ~333ms a 18fps
            setTimeout(() => {
                // flash roxo do ecrã
                const flash = document.createElement('div');
                flash.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:244;background:rgba(180,80,255,0);transition:background 90ms;`;
                document.body.appendChild(flash);
                let flashOn = false;
                const flashId = setInterval(() => {
                    flashOn = !flashOn;
                    flash.style.background = `rgba(180,80,255,${flashOn ? 0.28 : 0.05})`;
                }, 110);

                playFramesFX({
                    frames, fps: 18, x: px, y: py, size: 60,
                    onLastFrame: () => {
                        clearInterval(flashId);
                        flash.remove();
                        aplicarDano();
                    },
                });
            }, SLASH_DELAY);
            bloquearTurno(SLASH_DELAY + animDur + 50, () => {});
            return;
        }
        aplicarDano();
        return;
    }

    // Núcleo Corrompido: visuais diferentes por ataque
    if (_tipoEncontro === 'nucleo') {
        // Alvo: projecta a posição do peito/centro do player para vw/vh
        const _v = new THREE.Vector3(-2.6, 1.2, 0).project(combateCamera);
        const toPos = { x: (_v.x * 0.5 + 0.5) * 100, y: (-_v.y * 0.5 + 0.5) * 100 };

        if (at.nome === 'Praga Rúnica') {
            // Praga Rúnica: Ritual (Órbita) -> Névoa -> Debuff
            const signalDur = 1200;
            const fogDur    = (24 / 12) * 1000;

            animarAtaqueNucleo(getInimigoActivo(), 'praga', signalDur + 600);

            // 1. Áudio Glifos
            const glifosAudio = new Audio('assets/sounds/Attacks/nucleo/glifos.mp3');
            glifosAudio.volume = 0.6;
            glifosAudio.play().catch(() => {});

            // Container para a órbita
            const container = document.createElement('div');
            container.style.cssText = `
                position: fixed; left: ${toPos.x}vw; top: ${toPos.y}vh;
                width: 1px; height: 1px; pointer-events: none; z-index: 243;
                display: flex; align-items: center; justify-content: center;
                transition: opacity 300ms, transform ${signalDur}ms cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 0;
            `;

            const numRunes = 6;
            const radius = 10;
            for (let i = 0; i < numRunes; i++) {
                const r = document.createElement('img');
                r.src = 'assets/vfx/nucleo_ataques/rune.png';
                const angle = (i / numRunes) * Math.PI * 2;
                const lx = Math.cos(angle) * radius;
                const ly = Math.sin(angle) * radius;
                const isPurple = (i % 2 === 0);
                const filter = isPurple 
                    ? 'drop-shadow(0 0 8px rgba(180,80,255,0.9)) hue-rotate(280deg)'
                    : 'drop-shadow(0 0 8px rgba(60,180,255,0.9)) hue-rotate(180deg)';
                
                r.style.cssText = `
                    position: absolute; width: 5vh; height: 5vh;
                    left: calc(50% + ${lx}vh); top: calc(50% + ${ly}vh);
                    transform: translate(-50%, -50%); filter: ${filter};
                `;
                container.appendChild(r);
            }
            document.body.appendChild(container);

            if (!document.getElementById('anim-runa-orbita')) {
                const style = document.createElement('style');
                style.id = 'anim-runa-orbita';
                style.textContent = `@keyframes orbitaRuna { from { transform: rotate(0deg) scale(0.8); } to { transform: rotate(360deg) scale(1.2); } }`;
                document.head.appendChild(style);
            }

            container.style.opacity = '1';
            container.style.animation = `orbitaRuna ${signalDur}ms infinite linear`;

            setTimeout(() => {
                // 2. Névoa
                container.style.opacity = '0';
                container.style.transform = 'scale(2.0)';
                setTimeout(() => container.remove(), 300);

                const explAudio = new Audio('assets/sounds/Attacks/nucleo/explosion.mp3');
                explAudio.volume = 0.7;
                explAudio.play().catch(() => {});

                playSpriteFX({
                    url: 'assets/vfx/nucleo_ataques/nevoa_debuff.png',
                    cols: 6, rows: 4, frames: 24, fps: 12,
                    x: toPos.x, y: toPos.y, size: 50,
                    extraCss: 'mix-blend-mode: screen; filter: brightness(1.5) contrast(1.2); opacity: 0.9;',
                });

                setTimeout(() => {
                    // 3. Debuff (Setas)
                    const debuffAudio = new Audio('assets/sounds/Attacks/nucleo/defuff.mp3');
                    debuffAudio.volume = 0.6;
                    debuffAudio.play().catch(() => {});

                    const arrowContainer = document.createElement('div');
                    arrowContainer.style.cssText = `position: fixed; left: ${toPos.x}vw; top: ${toPos.y}vh; width: 1px; height: 1px; pointer-events: none; z-index: 245;`;
                    for (let i = 0; i < 3; i++) {
                        const arrow = document.createElement('img');
                        arrow.src = 'assets/vfx/nucleo_ataques/arrrow.png';
                        const offsetX = (i - 1) * 5;
                        arrow.style.cssText = `position: absolute; width: 4vh; height: auto; left: ${offsetX}vh; top: -12vh; opacity: 0; transform: translate(-50%, -50%) rotate(90deg); filter: hue-rotate(300deg) brightness(1.5) drop-shadow(0 0 8px #0088ff); transition: transform 600ms ease-in, opacity 300ms;`;
                        arrowContainer.appendChild(arrow);
                        requestAnimationFrame(() => setTimeout(() => {
                            arrow.style.opacity = '1';
                            arrow.style.transform = `translate(-50%, 5vh) rotate(90deg)`;
                            setTimeout(() => { arrow.style.opacity = '0'; }, 400);
                        }, 50));
                    }
                    document.body.appendChild(arrowContainer);
                    setTimeout(() => arrowContainer.remove(), 1500);
                }, 1000);

                setTimeout(() => aplicarDano(), 800);
            }, signalDur);

            bloquearTurno(signalDur + fogDur + 400, () => {});
        }
        else if (at.nome === 'Lascas do Vazio') {
            // Lascas do Vazio: Projétil clássico
            const from = _ancoraCombatente('inimigo');
            const flightMs = 700;

            animarAtaqueNucleo(getInimigoActivo(), 'lascas', flightMs + 200);
            tocarSomShockBoss(); // Som do disparo

            const flash = document.createElement('div');
            flash.style.cssText = `
                position: fixed; inset: 0; pointer-events: none; z-index: 244;
                background: rgba(${at.cor},0); transition: background 90ms;
            `;
            document.body.appendChild(flash);
            let flashOn = false;
            const flashId = setInterval(() => {
                flashOn = !flashOn;
                flash.style.background = `rgba(${at.cor},${flashOn ? 0.28 : 0.05})`;
            }, 110);

            dispararProjetilSprite({
                url: 'assets/vfx/nucleo_ataques/projetilie_enim1.png',
                cols: 4, rows: 4, frames: 16,
                from, to: toPos, dur: flightMs, size: 105,
                onImpact: () => {
                    clearInterval(flashId);
                    flash.remove();
                    aplicarDano();
                },
            });
            bloquearTurno(flightMs + 50, () => {});
        }
        else if (at.nome === 'Esmagamento Ímpio') {
            // Esmagamento Ímpio: Slam físico + Erupção de Picos do chão
            const dur = 1300;
            animarAtaqueNucleo(getInimigoActivo(), 'esmagamento', dur);

            // Flash de ecrã e Impacto sincronizado com o slam (900ms)
            setTimeout(() => {
                tocarSomSpikeBoss(); // Som dos picos

                const flash = document.createElement('div');
                flash.style.cssText = `
                    position: fixed; inset: 0; pointer-events: none; z-index: 244;
                    background: rgba(${at.cor},0.3); transition: opacity 250ms;
                `;
                document.body.appendChild(flash);
                setTimeout(() => { 
                    flash.style.opacity = '0';
                    setTimeout(() => flash.remove(), 250);
                }, 100);

                // Picos irrompem do chão debaixo do player
                const spikeFrames = [
                    'assets/vfx/boss/spikes/spike1.png',
                    'assets/vfx/boss/spikes/spike2.png',
                    'assets/vfx/boss/spikes/spike3.png',
                    'assets/vfx/boss/spikes/spike4.png'
                ];
                
                const posBase = toPos;
                const offsets = [
                    { dx: 0, dy: 5, size: 45 },
                    { dx: -12, dy: 8, size: 35 },
                    { dx: 12, dy: 8, size: 35 }
                ];

                offsets.forEach(off => {
                    playFramesFX({
                        frames: spikeFrames,
                        fps: 12,
                        x: posBase.x + off.dx,
                        y: posBase.y + off.dy,
                        size: off.size,
                        extraCss: 'filter: hue-rotate(280deg) brightness(1.3); mix-blend-mode: screen;'
                    });
                });

                aplicarDano();
            }, 900);

            bloquearTurno(dur + 100, () => {});
        }
        else {
            // Outros: Dano direto
            aplicarDano();
        }
        return;
    } else {
        aplicarDano();
    }
}

// ---- micro-animações (flash) ----
function pulsarInimigo() {
    const m = getInimigoActivo().material;
    const original = m.emissiveIntensity;
    m.emissiveIntensity = 2.5;
    setTimeout(() => { m.emissiveIntensity = original; }, 180);
}
function pulsarPlayer(rgb = '255,40,80') {
    const overlay = document.getElementById('combate-flash') || (() => {
        const o = document.createElement('div');
        o.id = 'combate-flash';
        o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0);pointer-events:none;z-index:79;transition:background 0.18s;';
        document.body.appendChild(o);
        return o;
    })();
    overlay.style.background = `rgba(${rgb},0.35)`;
    setTimeout(() => { overlay.style.background = `rgba(${rgb},0)`; }, 180);
}

// ----------------------------------------------------------------------
// FIM DE COMBATE
// ----------------------------------------------------------------------
function finalizarVitoria() {
    const boss = isBossMode();
    const cintilasGanhas = inimigoAtual.cintilasDrop || 0;
    const xpGanho = inimigoAtual.xpDrop || 0;
    setLog(`Venceste! ${inimigoAtual.nome} foi destruído. (+${xpGanho} XP, +${cintilasGanhas} ✦)`);
    setBotoesAtivos(false);
    if (boss) pararFaseDesvio();

    // Animação de desaparecimento. No boss, encolhemos o root + escurecemos
    // as runas/olhos. No combate normal usamos o fade de opacidade do wraith.
    let f = 1;
    if (boss) {
        // pára a música do boss e toca a fanfarra de vitória
        stopMusic(0.6);
        tocarFanfarraVitoria();
        const root = getBossRoot();
        const fadeId = setInterval(() => {
            f -= 0.05;
            if (root) root.scale.setScalar(Math.max(0.01, f));
            if (f <= 0) {
                clearInterval(fadeId);
                ganharXP(inimigoAtual.xpDrop);
                if (cintilasGanhas > 0) ganharCintilas(cintilasGanhas);
                setTimeout(() => {
                    mostrarEcraVitoriaFinal();
                    // mantém-se na cena de combate em fundo escuro com o overlay
                }, 500);
            }
        }, 60);
        return;
    }

    const inimigoMesh = getInimigoActivo();
    const m = inimigoMesh.material;
    m.transparent = true;
    const fadeId = setInterval(() => {
        f -= 0.08;
        m.opacity = Math.max(0, f);
        inimigoMesh.scale.setScalar(Math.max(0.01, f));
        if (f <= 0) {
            clearInterval(fadeId);
            ganharXP(inimigoAtual.xpDrop);
            if (cintilasGanhas > 0) ganharCintilas(cintilasGanhas);
            // Cura pós-vitória (Auréola dos Caídos)
            const cura = getCuraPosCombate();
            if (cura > 0 && playerStats.hp < playerStats.maxHp) {
                curar(cura);
                setLog(`A Auréola brilha — recuperaste ${cura} HP.`);
            }
            notificarVitoriaQuest();
            // limpa a zona corrompida onde estávamos no mundo
            const snap = getMundoSnapshot();
            limparZonaBatalha(snap.x, snap.z);
            // Recompensa dos Brincos: 1 vez, ao chegar a 5 vitórias.
            if (qtdItem('brincos_vida') === 0) {
                _vitoriasParaBrincos++;
                if (_vitoriasParaBrincos >= VITORIAS_BRINCOS) {
                    adicionarItem('brincos_vida', 1);
                    const it = CATALOGO['brincos_vida'];
                    mostrarRecompensa({
                        icone: it.icone,
                        nome: it.nome,
                        descricao: it.descricao,
                    });
                }
            }
            setTimeout(() => sairDaArena(), 600);
        }
    }, 60);
}

function finalizarDerrota() {
    setLog('Caíste em combate. Vais recuperar...');
    setBotoesAtivos(false);
    setTimeout(() => sairDaArena(), 1200);
}

function finalizarFuga() {
    setBotoesAtivos(false);
    sairDaArena();
}

function sairDaArena() {
    esconderCombateUI();
    estadoJogo.emCombate = false;
    setEspadaMaoVisivel(false);  // guarda a espada nas costas
    const eraBoss = isBossMode();
    if (eraBoss) {
        pararFaseDesvio();
        setBossMode(false);
        const root = getBossRoot();
        if (root) root.scale.setScalar(1);
        _bossFightTriggered = false; // permite re-tentar
        // cura o jogador para a próxima tentativa
        recuperarTotal();
        playerStats.derrotado = false;
        sairBossParaCastelo(() => {
            switchMusic('castle', 1.5);
        });
        return;
    }
    sairCombate(() => {
        // Restaurar música do mundo baseada na posição
        const estaNaZonaDark = player.position.z < -3;
        switchMusic(estaNaZonaDark ? 'dark' : 'mundo', 1.5);
    });
}

// ----------------------------------------------------------------------
// INÍCIO DE COMBATE
// ----------------------------------------------------------------------
function iniciarCombate() {
    estadoJogo.emCombate = true;
    setEspadaMaoVisivel(true);   // empunha a espada (esconde a das costas)
    novoInimigo();

    // Toca o som de transição
    playSFX('transicao_batalha');

    // glitch curto antes da transição (mantém a vibe do encontro)
    startGlitch(1.2, () => {
        // Muda para a música de batalha ao entrar na arena
        switchMusic('batalha', 0.5);

        entrarCombate(() => {
            // já estamos na arena, com a câmara estática a apontar para os dois
            resetCooldowns();
            mostrarCombateUI(inimigoAtual.nome);
            refreshHpUI();
            setLog(`Um ${inimigoAtual.nome} manifestou-se! Que fareis?`);
            _atualizarPresagio();
            setCombateHandlers({
                onAtacarSlot: acaoAtacarSlot,
                onItem:       acaoItem,
                onFugir:      acaoFugir,
            });
            atualizarSlotsUI();
            preencherItens(getItens(), acaoItem);
        });
    });

    // Mini-glitch final sincronizado com o áudio (ocorre entre 1.8s e 2.2s)
    // Aparece mesmo sobre a tela preta/transição graças ao z-index elevado.
    setTimeout(() => {
        startGlitch(0.4);
    }, 1700);
}

// expõe uma forma simples de recuperar (chamar p.ex. ao entrar em casa)
export function recuperarPlayer() {
    recuperarTotal();
    setLog && setLog('Recuperaste totalmente.');
}

// ----------------------------------------------------------------------
// BOSS FIGHT — disparado quando todos os 5 pedestais do castelo
// estão preenchidos. Reusa o pipeline de combate normal mas com:
//   - inimigo = boss procedural (escala/HP/dano maiores)
//   - sem fuga
//   - cura inicial total e cooldowns frescos
//   - vitória → ecrã de fim (sem voltar à zona de batalha do mundo)
// ----------------------------------------------------------------------
const BOSS_DEFS = {
    nome: 'O SOBERANO DA CORRUPÇÃO',
    hp: 140, maxHp: 140,
    atk: 9,
    xpDrop: 500,
    cintilasDrop: 250,
};
let _bossFightTriggered = false;

export function iniciarBossFight() {
    if (estadoJogo.emCombate || playerStats.derrotado) return;
    if (_bossFightTriggered) return;
    _bossFightTriggered = true;

    estadoJogo.emCombate = true;
    // O boss escala como os restantes inimigos: nível do jogador,
    // +2 no modo noite (ver nivelDificuldade / BONUS_NIVEL_NOITE).
    setNivelInimigo(nivelDificuldade());
    inimigoAtual = escalarStats(BOSS_DEFS);
    _setEnfraquecido(false);
    // cura o jogador para dar uma luta justa
    recuperarTotal();
    // reset à velocidade/rage da fase de desvio
    setBossHpFrac(1.0);

    // IMPORTANTE — activar boss mode JÁ, antes do entrarCombate. Assim:
    //   • posPlayerCombate / posInimigoCombate são mutados para a arena
    //     boss (player em (0,0,2), boss em (0,0,-3.5))
    //   • resetCombateScene (chamado dentro do entrarCombate) já hide
    //     o wraith e show do boss
    //   • o player.position.copy(posPlayerCombate) aterra logo no spot
    //     correcto do boss layout
    setBossMode(true);

    playSFX('transicao_batalha');

    // Início do fade alinhado com o pico do `transicao_batalha`. Começa
    // ligeiramente mais cedo do que no combate normal para casar com o som.
    startGlitch(1.25, () => {
        switchMusic('boss', 0.5);
        entrarCombate(() => {
            // player virado para o boss (que está em -Z)
            player.rotation.y = Math.PI;
            resetCooldowns();
            mostrarCombateUI(inimigoAtual.nome);
            refreshHpUI();
            setLog('O Soberano da Corrupção desce do altar. Não há fuga.');
            setCombateHandlers({
                onAtacarSlot: acaoAtacarSlot,
                onItem:       acaoItem,
                onFugir:      () => setLog('Não podes fugir do Soberano.'),
            });
            atualizarSlotsUI();
            preencherItens(getItens(), acaoItem);
            // arranca a fase de desvio — todo o dano que o boss faz
            // vem destes projécteis (o turno dele em si não causa dano).
            iniciarFaseDesvio();
        });
    });

    setTimeout(() => startGlitch(0.5), 1750);
}

// ---- popup de fim de jogo (após vencer o boss) ------------------------
function mostrarEcraVitoriaFinal() {
    if (document.getElementById('boss-victory-overlay')) return;
    const o = document.createElement('div');
    o.id = 'boss-victory-overlay';
    o.style.cssText = `
        position: fixed; inset: 0;
        background: radial-gradient(circle, rgba(20,4,40,0.95), rgba(0,0,0,0.98));
        display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 24px;
        z-index: 800;
        font-family: 'Courier New', monospace;
        color: #f0d9a8; text-align: center;
        animation: bossWinFade 1.2s ease-out forwards;
    `;
    o.innerHTML = `
        <style>
            @keyframes bossWinFade { from{opacity:0} to{opacity:1} }
        </style>
        <div style="font-size:54px;font-weight:bold;letter-spacing:8px;
                    color:#ffe080;text-shadow:0 0 30px #ffaa30,0 0 60px #ff6a00;">
            ✦ A CORRUPÇÃO FOI BANIDA ✦
        </div>
        <div style="font-size:18px;color:#cde2ff;max-width:680px;line-height:1.55;">
            O Soberano tombou. A luz volta a bafejar as terras outrora consumidas pelo nevoeiro.
            <br>O teu nome será lembrado até onde a maré alcança.
        </div>
        <div style="font-size:14px;color:#a08060;margin-top:14px;">— FIM —</div>
    `;
    document.body.appendChild(o);
}


