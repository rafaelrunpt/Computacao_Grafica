export const playerStats = {
    level: 1,
    xp: 0,
    xpToNext: 100,
    hp: 30,
    baseMaxHp: 30,           // HP máximo "base" (sobe com level-up)
    maxHp: 30,               // HP máximo efectivo = base + bónus de equipamento
    atk: 6,
    derrotado: false,        // true → bloqueia novos encontros até recuperar
    // slots de equipamento (id de item ou null) — um único slot "acessorio"
    equipped: { acessorio: null },
};

// modificadores por item equipado
const _atkBonusPct       = { coroa_magica: 0.10 };
const _maxHpBonus        = { brincos_vida: 10 };
// _cooldownReduction reservado para o futuro — os óculos passaram a
// "ver o próximo ataque do inimigo" (mecânica a implementar mais tarde).
const _cooldownReduction = {};
const _curaPosCombate    = { aureola_caidos: 5 };   // HP curado a cada vitória
const _chanceEvasao      = { mascara_eclipse: 0.25 }; // probabilidade [0..1]

export function getAtkEfetivo() {
    let mult = 1;
    for (const id of Object.values(playerStats.equipped)) {
        if (id && _atkBonusPct[id]) mult += _atkBonusPct[id];
    }
    return Math.round(playerStats.atk * mult);
}

export function getMaxHpBonus() {
    let bonus = 0;
    for (const id of Object.values(playerStats.equipped)) {
        if (id && _maxHpBonus[id]) bonus += _maxHpBonus[id];
    }
    return bonus;
}

export function getReducaoCooldown() {
    let red = 0;
    for (const id of Object.values(playerStats.equipped)) {
        if (id && _cooldownReduction[id]) red += _cooldownReduction[id];
    }
    return red;
}

export function getCuraPosCombate() {
    let cura = 0;
    for (const id of Object.values(playerStats.equipped)) {
        if (id && _curaPosCombate[id]) cura += _curaPosCombate[id];
    }
    return cura;
}

export function getChanceEvasao() {
    let c = 0;
    for (const id of Object.values(playerStats.equipped)) {
        if (id && _chanceEvasao[id]) c += _chanceEvasao[id];
    }
    return Math.min(1, c);
}

// Multiplicador de dano em função do nível do jogador.
// Nível 1 → ×1.00, nível 2 → ×1.15, nível 5 → ×1.60, etc.
// Usado por resolverAtaque para todos os ataques escalarem suavemente.
export function getLevelDamageMult() {
    return 1 + 0.15 * (playerStats.level - 1);
}

// Recalcula maxHp a partir da base + bónus de equipamento. Chamar
// sempre que muda o equipamento ou se sobe de nível.
export function recalcularMaxHp() {
    const novoMax = playerStats.baseMaxHp + getMaxHpBonus();
    const delta = novoMax - playerStats.maxHp;
    playerStats.maxHp = novoMax;
    if (delta > 0) {
        // ao ganhar HP máx (ex.: equipar brincos), aproveita o boost
        playerStats.hp = Math.min(playerStats.maxHp, playerStats.hp + delta);
    } else {
        playerStats.hp = Math.min(playerStats.hp, playerStats.maxHp);
    }
    if (_onHPChange) _onHPChange();
}

// callbacks registados pela HUD / sistema de combate
let _onLevelUp  = null;
let _onXPChange = null;
let _onHPChange = null;

export function registarCallbacksStats(onXPChange, onLevelUp, onHPChange) {
    _onXPChange = onXPChange;
    _onLevelUp  = onLevelUp;
    _onHPChange = onHPChange;
}

export function ganharXP(amount) {
    playerStats.xp += amount;
    while (playerStats.xp >= playerStats.xpToNext) {
        playerStats.xp -= playerStats.xpToNext;
        playerStats.level++;
        playerStats.xpToNext = Math.floor(playerStats.xpToNext * 1.4);
        // ao subir de nível: aumenta HP máximo base e cura
        playerStats.baseMaxHp += 5;
        playerStats.atk       += 1;
        playerStats.maxHp = playerStats.baseMaxHp + getMaxHpBonus();
        playerStats.hp    = playerStats.maxHp;
        if (_onLevelUp)  _onLevelUp(playerStats.level);
        if (_onHPChange) _onHPChange();
    }
    if (_onXPChange) _onXPChange();
}

export function receberDano(amount) {
    playerStats.hp = Math.max(0, playerStats.hp - amount);
    if (playerStats.hp === 0) playerStats.derrotado = true;
    if (_onHPChange) _onHPChange();
}

export function curar(amount) {
    playerStats.hp = Math.min(playerStats.maxHp, playerStats.hp + amount);
    if (_onHPChange) _onHPChange();
}

// recupera totalmente (chamar quando se recupera após derrota)
export function recuperarTotal() {
    playerStats.hp = playerStats.maxHp;
    playerStats.derrotado = false;
    if (_onHPChange) _onHPChange();
}
