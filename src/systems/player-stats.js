export const playerStats = {
    level: 1,
    xp: 0,
    xpToNext: 100,
    hp: 30,
    maxHp: 30,
    atk: 6,
    derrotado: false,        // true → bloqueia novos encontros até recuperar
    // slots de equipamento (id de item ou null)
    equipped: { cabeca: null },
};

// modificadores acumulados (multiplicadores) — preenchidos pelos itens equipados
const _atkBonusPct = { coroa_magica: 0.10 };

export function getAtkEfetivo() {
    let mult = 1;
    for (const id of Object.values(playerStats.equipped)) {
        if (id && _atkBonusPct[id]) mult += _atkBonusPct[id];
    }
    return Math.round(playerStats.atk * mult);
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
        // ao subir de nível: aumenta HP máximo e cura
        playerStats.maxHp += 5;
        playerStats.atk   += 1;
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
