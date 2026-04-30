/**
 * Character progression — TLoD's LV / EXP / next-level threshold. Lives on the
 * player only for now; if mobs ever scale by level we add it to spawnMob.
 *
 * TLoD model: `xp` is the lifetime cumulative counter (NEVER reset).
 * `xpToNext` is the cumulative threshold needed to reach the next level. On
 * level-up: advance `level` by 1, leave `xp` alone, recompute `xpToNext` via
 * `xpThresholdForLevel(level + 1)`. At level cap, `xpToNext` keeps the cap
 * threshold so the HUD reads "EXP X / cap" instead of NaN.
 */
export interface Progression {
  level: number;
  xp: number;
  xpToNext: number;
}
