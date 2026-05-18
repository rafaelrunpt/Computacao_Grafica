import { grassZones, limparZonaBatalha } from '../world/mapa.js';
import { ganharXP, playerStats, receberDano, curar, recuperarTotal, getAtkEfetivo, getCuraPosCombate, getChanceEvasao } from './player-stats.js';
import { ganharCintilas } from './currency.js';
import { entrarCombate, sairCombate, getMundoSnapshot, sairBossParaCastelo } from '../core/transicoes.js';
import { notificarVitoria as notificarVitoriaQuest } from './merchant-quest.js';
import { combateInimigo, setBossMode, isBossMode } from '../world/combate-scene.js';
import { getBossRoot } from '../world/boss.js';
import { iniciarFaseDesvio, pararFaseDesvio, atualizarFaseDesvio, isFaseDesvioActiva, setOnPlayerDerrotado, setBossHpFrac } from './boss-attacks.js';

// quando o player morre durante a fase de desvio, encerrar o combate
setOnPlayerDerrotado(() => {
    setBotoesAtivos(false);
    setLog('Caíste perante o Soberano...');
    setTimeout(() => sairDaArena(), 1200);
});
import { getItens, usarItem, adicionarItem, CATALOGO, quantidade as qtdItem } from './inventario.js';
import { playSFX, switchMusic } from './audio.js';
import { mostrarRecompensa } from '../ui/popup-recompensa.js';
import { player } from '../entities/jogador.js';
import {
    mostrarCombateUI, esconderCombateUI, setCombateHandlers,
    setHpInimigo, setHpPlayer, setLog, setBotoesAtivos, preencherItens,
    setAtaqueSlots
} from '../ui/combate-ui.js';
import {
    getSlotAtaque, getCooldownSlot, podeUsarSlot,
    aplicarCooldown, tickCooldowns, resetCooldowns, resolverAtaque,
} from './ataques.js';
import { lancarAnimacaoAtaque } from '../ui/combate-anims.js';

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

export function iniciarCombateEm(x, z) {
    if (estadoJogo.emCombate || playerStats.derrotado) return;
    estadoJogo.combateX = x;
    estadoJogo.combateZ = z;
    iniciarCombate();
}

// ----------------------------------------------------------------------
// ESTADO DE COMBATE (turn-based simples)
// ----------------------------------------------------------------------
const inimigoBase = {
    nome: 'SHACO CORROMPIDO',
    hp: 30, maxHp: 30,
    atk: 4,
    xpDrop: 35,
    cintilasDrop: 12,
};
let inimigoAtual = { ...inimigoBase };

// ----------------------------------------------------------------------
// DIFICULDADE ESCALÁVEL
// ----------------------------------------------------------------------
// Nível de dificuldade atual dos inimigos normais (não-boss). Começa em 1.
// Pode ser alterado externamente via setNivelInimigo() — por exemplo
// ao desbloquear novas regiões, ao subir o nível do jogador, ou para
// uma curva pré-definida por zona/quest.
//
// A escala aplica-se em novoInimigo() e iniciarBossFight() e afecta
// HP, ATK, XP e Cintilas a partir dos valores `*Base` declarados acima.
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
    inimigoAtual = escalarStats(inimigoBase);
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
    // NÃO paramos a fase de desvio — o boss continua a atacar enquanto o
    // jogador executa o seu ataque (assim os projécteis não dão pausa).

    const resultado = resolverAtaque(idx, getAtkEfetivo());
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
            return;
        }
        inimigoAtual.hp = Math.max(0, inimigoAtual.hp - parcial);
        if (resultado.hitsTotais > 1) {
            setLog(`${at.nome}! ${resultado.hitsAcertos}/${resultado.hitsTotais} acertos — ${danoTotal} dano.`);
        } else {
            setLog(`${at.nome}! ${danoTotal} de dano.`);
        }
        refreshHpUI();
        // Notifica a fase de desvio do novo HP — projécteis aceleram e
        // entram em rage mode (cores trocadas) abaixo dos 25%.
        if (isBossMode()) {
            setBossHpFrac(inimigoAtual.hp / inimigoAtual.maxHp);
        }
    };

    lancarAnimacaoAtaque(at, resultado.falhou, {
        onImpacto1: () => {
            if (resultado.hitsTotais > 1) {
                aplicarImpacto(danoPorHit);
            } else {
                aplicarImpacto(danoTotal);
            }
        },
        onImpacto2: resultado.hitsTotais > 1 ? () => aplicarImpacto(danoTotal - danoPorHit) : null,
    });

    bloquearTurno(animDur + 100, vaiVencer ? finalizarVitoria : turnoInimigo);
}

function acaoItem(item) {
    if (turnoBloqueado) return;
    if (item.quantidade <= 0) return;
    const r = usarItem(item.id);
    setLog(r.mensagem);
    refreshHpUI();
    // refresca o painel para mostrar nova quantidade
    preencherItens(getItens(), acaoItem);
    if (!r.ok) {
        // tentativa inválida não consome turno
        setBotoesAtivos(true);
        return;
    }
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
    setBotoesAtivos(true);
    if (isBossMode() && !playerStats.derrotado && inimigoAtual.hp > 0) {
        iniciarFaseDesvio();
    }
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

    // Esquiva (Máscara do Eclipse)
    if (Math.random() < getChanceEvasao()) {
        setLog(`${inimigoAtual.nome} ataca, mas esquivaste-te! Sem dano.`);
        tickCooldowns();
        atualizarSlotsUI();
        _devolverTurnoAoPlayer();
        return;
    }

    const dano = inimigoAtual.atk + Math.floor(Math.random() * 3);
    receberDano(dano);
    setLog(`${inimigoAtual.nome} ataca! Sofreste ${dano} de dano.`);
    pulsarPlayer();
    refreshHpUI();

    if (playerStats.hp <= 0) {
        bloquearTurno(900, finalizarDerrota);
        return;
    }
    tickCooldowns();
    atualizarSlotsUI();
    _devolverTurnoAoPlayer();
}

// ---- micro-animações (flash) ----
function pulsarInimigo() {
    const m = combateInimigo.material;
    const original = m.emissiveIntensity;
    m.emissiveIntensity = 2.5;
    setTimeout(() => { m.emissiveIntensity = original; }, 180);
}
function pulsarPlayer() {
    const overlay = document.getElementById('combate-flash') || (() => {
        const o = document.createElement('div');
        o.id = 'combate-flash';
        o.style.cssText = 'position:fixed;inset:0;background:rgba(255,40,80,0.0);pointer-events:none;z-index:79;transition:background 0.18s;';
        document.body.appendChild(o);
        return o;
    })();
    overlay.style.background = 'rgba(255,40,80,0.35)';
    setTimeout(() => { overlay.style.background = 'rgba(255,40,80,0.0)'; }, 180);
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

    const m = combateInimigo.material;
    m.transparent = true;
    const fadeId = setInterval(() => {
        f -= 0.08;
        m.opacity = Math.max(0, f);
        combateInimigo.scale.setScalar(Math.max(0.01, f));
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
            setLog(`Um ${inimigoAtual.nome} apareceu! O que vais fazer?`);
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
    // O boss escala com o mesmo `_nivelInimigo`; podes futuramente
    // forçar um nível mínimo aqui (ex: Math.max(_nivelInimigo, 3))
    // se quiseres que o boss seja sempre acima de uma certa fasquia.
    inimigoAtual = escalarStats(BOSS_DEFS);
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
            O Soberano caiu. A luz volta a tocar as terras outrora consumidas pelo nevoeiro.
            <br>O teu nome será cantado até onde a maré chega.
        </div>
        <div style="font-size:14px;color:#a08060;margin-top:14px;">— FIM —</div>
    `;
    document.body.appendChild(o);
}
