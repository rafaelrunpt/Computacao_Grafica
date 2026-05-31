import { getReducaoCooldown, getLevelDamageMult } from './player-stats.js';

// ----------------------------------------------------------------------
// CATÁLOGO DE ATAQUES (físicos — sem magia)
// ----------------------------------------------------------------------
// Cada ataque tem:
//   multATK   — multiplicador do ATK efetivo do jogador
//   bonusMin/Max — bónus aleatório somado ao dano final
//   precisao  — probabilidade de acertar (1.0 = sempre)
//   hits      — número de golpes por ativação
//   cooldown  — turnos de espera depois de usado
//   elemento  — 'corte' | 'impacto' | 'arcano' | null (buff)
//               define a afinidade contra cada tipo de inimigo (ver AFINIDADES).
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// Cada ataque inclui metadata visual:
//   anim.tipo       — 'corte' | 'talho' | 'carga' | 'danca'
//   anim.cor        — cor principal do trail/slash (hex / css)
//   anim.lunge      — quanto o jogador avança no movimento (unidades 3D)
//   anim.dur        — duração total da animação (ms)
//   anim.impacto    — instante do impacto dentro da animação (ms)
//   anim.shake      — intensidade de tremor de câmara (px) opcional
// ----------------------------------------------------------------------
export const ATAQUES = {
    golpe_rapido: {
        id: 'golpe_rapido',
        nome: 'Lâmina Veloz',
        desc: 'Estocada de corte rápida. Boa contra espectros, fraca contra rocha.',
        icone: 'assets/icones/ataques/golpe_veloz.png',
        cooldown: 0,
        elemento: 'corte',
        multATK: 1.0,
        bonusMin: 0, bonusMax: 3,
        precisao: 1.0,
        hits: 1,
        anim: { tipo: 'corte', cor: '#dceeff', lunge: 1.2, dur: 520, impacto: 240, shake: 4 },
    },
    golpe_pesado: {
        id: 'golpe_pesado',
        nome: 'Talho Profundo',
        desc: 'Golpe de impacto poderoso. Estilhaça cascas rochosas (núcleos).',
        icone: 'assets/icones/ataques/golpe_pesado.png',
        cooldown: 1,
        elemento: 'impacto',
        multATK: 1.6,
        bonusMin: 2, bonusMax: 5,
        precisao: 0.85,
        hits: 1,
        anim: { tipo: 'talho', cor: '#ff6680', lunge: 1.6, dur: 820, impacto: 480, shake: 12 },
    },
    investida: {
        id: 'investida',
        nome: 'Carga Implacável',
        desc: 'Embate de impacto devastador. Ideal contra Núcleos Corrompidos.',
        icone: 'assets/icones/ataques/carga.png',
        cooldown: 2,
        elemento: 'impacto',
        multATK: 2.2,
        bonusMin: 4, bonusMax: 8,
        precisao: 0.65,
        hits: 1,
        anim: { tipo: 'carga', cor: '#ffaa44', lunge: 3.4, dur: 900, impacto: 520, shake: 18 },
    },
    combo_duplo: {
        id: 'combo_duplo',
        nome: 'Dança das Lâminas',
        desc: 'Dois cortes encadeados. Dilacera espectros (Shaco), fraco em rocha.',
        icone: 'assets/icones/ataques/slash_duplo.png',
        cooldown: 1,
        elemento: 'corte',
        multATK: 0.7,
        bonusMin: 0, bonusMax: 2,
        precisao: 0.9,
        hits: 2,
        anim: { tipo: 'danca', cor: '#c4b3ff', lunge: 1.1, dur: 780, impacto: 280, impacto2: 580, shake: 5 },
    },
    // Ataque NORMAL — vendido na taverna pelo bartender.
    // Múltiplos cortes giratórios à volta do inimigo.
    golpe_giratorio: {
        id: 'golpe_giratorio',
        nome: 'Tornado de Lâminas',
        desc: 'Três cortes giratórios. Excelente contra espectros, inútil em rocha.',
        icone: 'assets/icones/ataques/tornado.png',
        cooldown: 2,
        elemento: 'corte',
        multATK: 0.85,
        bonusMin: 1, bonusMax: 3,
        precisao: 0.85,
        hits: 3,
        anim: { tipo: 'tornado', cor: '#ffd86a', lunge: 1.3, dur: 940, impacto: 260, impacto2: 540, impacto3: 820, shake: 7 },
    },
    // BUFF DEFENSIVO — vendido pela Bruxa das Poções.
    // Não causa dano: aplica véu místico que reduz o dano recebido em 35%
    // durante 5 rondas. Consome o turno do jogador.
    veu: {
        id: 'veu',
        nome: 'Véu Arcano',
        desc: 'Reduz o dano sofrido em 35% durante 5 rondas.',
        icone: 'assets/icones/ataques/escudo.png',
        cooldown: 6,
        elemento: null,
        multATK: 0,
        bonusMin: 0, bonusMax: 0,
        precisao: 1.0,
        hits: 0,
        magico: true,
        buff: { tipo: 'reducao_dano', valor: 0.35, duracao: 5 },
        anim: { tipo: 'talho', cor: '#b385ff', lunge: 0, dur: 700, impacto: 320, shake: 0 },
    },
    // Ataque MÁGICO — vendido pelo mercador na loja.
    // Golpe único e devastador com energia arcana.
    relampago_arcano: {
        id: 'relampago_arcano',
        nome: 'Relâmpago Arcano',
        desc: 'Raio arcano de alto dano. Punge espectros e o Soberano; rocha resiste-lhe um pouco.',
        icone: 'assets/icones/ataques/ThunderGlyph.png',
        cooldown: 3,
        elemento: 'arcano',
        multATK: 2.0,
        bonusMin: 6, bonusMax: 10,
        precisao: 0.95,
        hits: 1,
        magico: true,
        anim: { tipo: 'trovao', cor: '#7ad8ff', lunge: 0.2, dur: 1000, impacto: 400, shake: 20 },
    },
};

// ----------------------------------------------------------------------
// AFINIDADES ELEMENTAIS — multiplicador de dano por (tipo de inimigo × elemento)
// ----------------------------------------------------------------------
// Dá uma razão concreta para comprar e alternar ataques: cada inimigo tem
// uma fraqueza e uma resistência claras.
//   • Núcleo Corrompido — casca de ROCHA fracturada. As lâminas escorregam
//     (corte fraco), mas o impacto estilhaça-a (impacto forte).
//   • Wraith / Shaco — espectro etéreo e veloz. Os golpes pesados atravessam
//     o vazio (impacto fraco); cortes rápidos e magia arcana ferem-no (fortes).
//   • Soberano (boss) — couraça densa, mas vulnerável à energia arcana.
// Valores: 1.5 = super eficaz, 1.0 = neutro, 0.6 = resistente.
export const AFINIDADES = {
    nucleo: { impacto: 1.5, corte: 0.6, arcano: 1.0 },
    wraith: { impacto: 0.6, corte: 1.4, arcano: 1.5 },
    boss:   { impacto: 1.0, corte: 1.0, arcano: 1.4 },
};

// Devolve o multiplicador de afinidade de um elemento contra um tipo de
// inimigo. Sem elemento (buff) ou tipo desconhecido → 1.0 (neutro).
export function getAfinidade(elemento, tipoInimigo) {
    if (!elemento) return 1;
    const tabela = AFINIDADES[tipoInimigo];
    if (!tabela) return 1;
    return tabela[elemento] ?? 1;
}

// ----------------------------------------------------------------------
// ESTADO — 2 slots equipáveis e catálogo desbloqueado pelo jogador
// ----------------------------------------------------------------------
export const ataqueState = {
    slots: ['golpe_rapido', 'golpe_pesado', null, null],   // 4 slots, 2 preenchidos
    desbloqueados: new Set(['golpe_rapido', 'golpe_pesado']),
    cooldowns: { golpe_rapido: 0, golpe_pesado: 0 },
};
// ataques que foram usados neste turno — não devem decrementar no tick imediato
const _justApplied = new Set();

// ---- consultas ----
export function getSlotAtaque(idx) {
    const id = ataqueState.slots[idx];
    return id ? ATAQUES[id] : null;
}

export function getCooldownSlot(idx) {
    const id = ataqueState.slots[idx];
    if (!id) return 0;
    return ataqueState.cooldowns[id] || 0;
}

export function podeUsarSlot(idx) {
    const id = ataqueState.slots[idx];
    if (!id) return false;
    return (ataqueState.cooldowns[id] || 0) === 0;
}

// ---- mutações ----
export function aplicarCooldown(idx) {
    const id = ataqueState.slots[idx];
    if (!id) return;
    const at = ATAQUES[id];
    if (at.cooldown > 0) {
        // Aplica redução de equipamento (ex.: Óculos do Vidente: −1).
        // Cap máximo de 2 rounds de espera.
        const cd = Math.min(2, Math.max(0, at.cooldown - getReducaoCooldown()));
        if (cd > 0) {
            ataqueState.cooldowns[id] = cd;
            _justApplied.add(id);
        }
    }
}

export function tickCooldowns() {
    for (const id of Object.keys(ataqueState.cooldowns)) {
        if (_justApplied.has(id)) continue;          // não decrementa no turno em que foi usado
        if (ataqueState.cooldowns[id] > 0) ataqueState.cooldowns[id]--;
    }
    _justApplied.clear();
}

export function resetCooldowns() {
    for (const id of Object.keys(ataqueState.cooldowns)) {
        ataqueState.cooldowns[id] = 0;
    }
    _justApplied.clear();
}

// ---- equipar / desbloquear (preparação para sistema futuro) ----
export function desbloquearAtaque(ataqueId) {
    if (!ATAQUES[ataqueId]) return false;
    ataqueState.desbloqueados.add(ataqueId);
    if (!(ataqueId in ataqueState.cooldowns)) ataqueState.cooldowns[ataqueId] = 0;
    return true;
}

export function equiparAtaque(slotIdx, ataqueId) {
    if (slotIdx < 0 || slotIdx >= ataqueState.slots.length) return false;
    if (!ATAQUES[ataqueId]) return false;
    if (!ataqueState.desbloqueados.has(ataqueId)) return false;
    ataqueState.slots[slotIdx] = ataqueId;
    if (!(ataqueId in ataqueState.cooldowns)) ataqueState.cooldowns[ataqueId] = 0;
    return true;
}

// ----------------------------------------------------------------------
// RESOLUÇÃO DE ATAQUE — devolve { totalDano, hitsAcertos, hitsTotais, falhou }
// ----------------------------------------------------------------------
export function resolverAtaque(idx, atkBase) {
    const at = getSlotAtaque(idx);
    if (!at) return null;
    const levelMult = getLevelDamageMult();
    let totalDano = 0, hitsAcertos = 0;
    for (let h = 0; h < at.hits; h++) {
        if (Math.random() <= at.precisao) {
            const range = at.bonusMax - at.bonusMin + 1;
            const danoBase = Math.round(atkBase * at.multATK) + at.bonusMin + Math.floor(Math.random() * range);
            const dano = Math.max(1, Math.round(danoBase * levelMult));
            totalDano += dano;
            hitsAcertos++;
        }
    }
    return { ataque: at, totalDano, hitsAcertos, hitsTotais: at.hits, falhou: hitsAcertos === 0 };
}
