export const playerStats = {
    level: 1,
    xp: 0,
    xpToNext: 100,
};

// callback registado pelo hud.js para atualizar o ecrã
let _onLevelUp = null;
let _onXPChange = null;
export function registarCallbacksStats(onXPChange, onLevelUp) {
    _onXPChange = onXPChange;
    _onLevelUp  = onLevelUp;
}

export function ganharXP(amount) {
    playerStats.xp += amount;
    while (playerStats.xp >= playerStats.xpToNext) {
        playerStats.xp -= playerStats.xpToNext;
        playerStats.level++;
        playerStats.xpToNext = Math.floor(playerStats.xpToNext * 1.4);
        if (_onLevelUp) _onLevelUp(playerStats.level);
    }
    if (_onXPChange) _onXPChange();
}
