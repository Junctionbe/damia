/**
 * Dart's per-level stat table (TLoD-canonical, levels 1..60). Source:
 * `shareAI/assetsTLOD/characters/Dart/stats.txt`. Level 60 is the cap; the
 * helper clamps any higher input to that row.
 *
 * Currently exposed as REFERENCE DATA — DeathSystem awards XP and bumps the
 * level via the M9 progression curve, but doesn't yet rewrite Dart's Stats
 * from this table. Switching to TLoD-canonical numbers requires a parallel
 * rebalance of MOBS (the current AT 12 / DF 3 baseline is action-RPG-tuned,
 * not TLoD-tuned). When that pass happens, swap PLAYER_BASE.stats for a
 * lookup into `DART_STATS_BY_LEVEL[level]`.
 *
 * The Addition unlock column from the source table lives in
 * `DART_ADDITION_UNLOCKS_BY_LEVEL`. Unknown kinds (volcano / burningRush /
 * etc.) are stored as strings — they're not yet declared in ADDITIONS, so
 * any consumer must guard with `kind in ADDITIONS`.
 */

export interface DartLevelRow {
  level: number;
  hp: number;
  atk: number;
  def: number;
  magicAtk: number;
  magicDef: number;
}

/**
 * Index 0 = level 1, index 56 = level 57. Indexing by `level - 1` is fine;
 * the helper below clamps out-of-range so callers don't have to.
 */
export const DART_STATS_BY_LEVEL: ReadonlyArray<DartLevelRow> = [
  { level: 1, hp: 30, atk: 2, def: 4, magicAtk: 3, magicDef: 4 },
  { level: 2, hp: 60, atk: 4, def: 5, magicAtk: 5, magicDef: 5 },
  { level: 3, hp: 90, atk: 6, def: 7, magicAtk: 7, magicDef: 7 },
  { level: 4, hp: 120, atk: 8, def: 10, magicAtk: 9, magicDef: 9 },
  { level: 5, hp: 150, atk: 11, def: 12, magicAtk: 11, magicDef: 11 },
  { level: 6, hp: 180, atk: 13, def: 14, magicAtk: 13, magicDef: 13 },
  { level: 7, hp: 210, atk: 15, def: 16, magicAtk: 15, magicDef: 15 },
  { level: 8, hp: 240, atk: 18, def: 19, magicAtk: 17, magicDef: 17 },
  { level: 9, hp: 270, atk: 20, def: 21, magicAtk: 19, magicDef: 19 },
  { level: 10, hp: 300, atk: 22, def: 23, magicAtk: 21, magicDef: 21 },
  { level: 11, hp: 330, atk: 25, def: 26, magicAtk: 24, magicDef: 24 },
  { level: 12, hp: 413, atk: 27, def: 28, magicAtk: 26, magicDef: 26 },
  { level: 13, hp: 496, atk: 30, def: 31, magicAtk: 29, magicDef: 29 },
  { level: 14, hp: 579, atk: 32, def: 33, magicAtk: 31, magicDef: 32 },
  { level: 15, hp: 662, atk: 35, def: 36, magicAtk: 34, magicDef: 34 },
  { level: 16, hp: 745, atk: 37, def: 38, magicAtk: 36, magicDef: 37 },
  { level: 17, hp: 828, atk: 40, def: 41, magicAtk: 39, magicDef: 40 },
  { level: 18, hp: 911, atk: 42, def: 43, magicAtk: 41, magicDef: 42 },
  { level: 19, hp: 994, atk: 45, def: 46, magicAtk: 44, magicDef: 45 },
  { level: 20, hp: 1077, atk: 47, def: 48, magicAtk: 46, magicDef: 48 },
  { level: 21, hp: 1160, atk: 50, def: 51, magicAtk: 49, magicDef: 51 },
  { level: 22, hp: 1272, atk: 52, def: 53, magicAtk: 51, magicDef: 53 },
  { level: 23, hp: 1384, atk: 55, def: 56, magicAtk: 54, magicDef: 55 },
  { level: 24, hp: 1496, atk: 57, def: 58, magicAtk: 56, magicDef: 57 },
  { level: 25, hp: 1608, atk: 60, def: 61, magicAtk: 59, magicDef: 60 },
  { level: 26, hp: 1720, atk: 62, def: 63, magicAtk: 61, magicDef: 62 },
  { level: 27, hp: 1832, atk: 65, def: 66, magicAtk: 64, magicDef: 64 },
  { level: 28, hp: 1944, atk: 67, def: 68, magicAtk: 66, magicDef: 67 },
  { level: 29, hp: 2056, atk: 70, def: 71, magicAtk: 69, magicDef: 69 },
  { level: 30, hp: 2168, atk: 72, def: 73, magicAtk: 71, magicDef: 71 },
  { level: 31, hp: 2280, atk: 75, def: 76, magicAtk: 74, magicDef: 74 },
  { level: 32, hp: 2399, atk: 77, def: 78, magicAtk: 76, magicDef: 76 },
  { level: 33, hp: 2518, atk: 80, def: 81, magicAtk: 79, magicDef: 79 },
  { level: 34, hp: 2637, atk: 82, def: 83, magicAtk: 81, magicDef: 82 },
  { level: 35, hp: 2756, atk: 85, def: 86, magicAtk: 84, magicDef: 84 },
  { level: 36, hp: 2875, atk: 87, def: 88, magicAtk: 86, magicDef: 87 },
  { level: 37, hp: 2994, atk: 90, def: 91, magicAtk: 89, magicDef: 90 },
  { level: 38, hp: 3113, atk: 92, def: 93, magicAtk: 91, magicDef: 92 },
  { level: 39, hp: 3232, atk: 95, def: 96, magicAtk: 94, magicDef: 95 },
  { level: 40, hp: 3351, atk: 97, def: 98, magicAtk: 96, magicDef: 98 },
  { level: 41, hp: 3470, atk: 100, def: 101, magicAtk: 99, magicDef: 101 },
  { level: 42, hp: 3729, atk: 102, def: 103, magicAtk: 101, magicDef: 103 },
  { level: 43, hp: 3988, atk: 105, def: 105, magicAtk: 104, magicDef: 105 },
  { level: 44, hp: 4247, atk: 107, def: 108, magicAtk: 106, magicDef: 107 },
  { level: 45, hp: 4506, atk: 110, def: 110, magicAtk: 109, magicDef: 110 },
  { level: 46, hp: 4765, atk: 112, def: 113, magicAtk: 111, magicDef: 112 },
  { level: 47, hp: 5024, atk: 115, def: 115, magicAtk: 114, magicDef: 114 },
  { level: 48, hp: 5283, atk: 117, def: 118, magicAtk: 116, magicDef: 117 },
  { level: 49, hp: 5542, atk: 120, def: 120, magicAtk: 119, magicDef: 119 },
  { level: 50, hp: 5801, atk: 122, def: 123, magicAtk: 121, magicDef: 121 },
  { level: 51, hp: 6060, atk: 125, def: 125, magicAtk: 124, magicDef: 124 },
  { level: 52, hp: 6220, atk: 127, def: 128, magicAtk: 126, magicDef: 126 },
  { level: 53, hp: 6380, atk: 130, def: 131, magicAtk: 129, magicDef: 129 },
  { level: 54, hp: 6540, atk: 133, def: 133, magicAtk: 132, magicDef: 132 },
  { level: 55, hp: 6700, atk: 136, def: 136, magicAtk: 135, magicDef: 135 },
  { level: 56, hp: 6860, atk: 138, def: 139, magicAtk: 138, magicDef: 138 },
  { level: 57, hp: 7020, atk: 141, def: 141, magicAtk: 141, magicDef: 141 },
  { level: 58, hp: 7180, atk: 144, def: 144, magicAtk: 144, magicDef: 144 },
  { level: 59, hp: 7340, atk: 147, def: 147, magicAtk: 147, magicDef: 147 },
  { level: 60, hp: 7500, atk: 150, def: 150, magicAtk: 150, magicDef: 150 },
];

/** Lookup with clamping: returns the row for `level`, or the last row if higher. */
export function getDartStatsAtLevel(level: number): DartLevelRow {
  const idx = Math.max(1, Math.min(DART_STATS_BY_LEVEL.length, Math.round(level))) - 1;
  // Safe: idx is bounded by length above; the assertion is just for the type narrowing.
  return DART_STATS_BY_LEVEL[idx]!;
}

/**
 * Apply Dart's TLoD-canonical row for `level` to a player's `Stats` + `Health`.
 * Mutates in place: rewrites AT/DF/MAT/MDF and HP max. `clampHpToMax` keeps the
 * player's current HP under the new max (used on save-load); when `false`, the
 * caller is expected to refill HP itself (level-up does a full heal).
 *
 * Other Stats fields (atkSpeed, range, aggroRange, hit/avoid percentages, the
 * SPEED scalar) live in `PLAYER_BASE` and are NOT touched here.
 */
export function applyDartRow(
  stats: { atk: number; def: number; magicAtk: number; magicDef: number } | undefined,
  hp: { current: number; max: number } | undefined,
  level: number,
  clampHpToMax: boolean,
): void {
  const row = getDartStatsAtLevel(level);
  if (stats) {
    stats.atk = row.atk;
    stats.def = row.def;
    stats.magicAtk = row.magicAtk;
    stats.magicDef = row.magicDef;
  }
  if (hp) {
    hp.max = row.hp;
    if (clampHpToMax) hp.current = Math.min(hp.current, hp.max);
  }
}

/**
 * Cumulative XP needed to *reach* each level (Dart column from
 * `shareAI/assetsTLOD/characters/common/xp.txt`). Index 0 = level 1 (= 0 XP),
 * index 59 = level 60 (= 382 000 XP). The progression in TLoD is cumulative:
 * the XP counter never resets on level-up, it just keeps growing past the
 * threshold of the next level.
 */
export const DART_XP_TO_REACH_LEVEL: ReadonlyArray<number> = [
  /* LV 1  */ 0, /* LV 2  */ 20, /* LV 3  */ 43, /* LV 4  */ 102, /* LV 5  */ 200, /* LV 6  */ 345,
  /* LV 7  */ 548, /* LV 8  */ 819, /* LV 9  */ 1166, /* LV 10 */ 1600, /* LV 11 */ 2129,
  /* LV 12 */ 2764, /* LV 13 */ 3515, /* LV 14 */ 4390, /* LV 15 */ 5400, /* LV 16 */ 6553,
  /* LV 17 */ 7860, /* LV 18 */ 9331, /* LV 19 */ 10947, /* LV 20 */ 12800, /* LV 21 */ 14817,
  /* LV 22 */ 17036, /* LV 23 */ 19467, /* LV 24 */ 22118, /* LV 25 */ 25000, /* LV 26 */ 28121,
  /* LV 27 */ 31492, /* LV 28 */ 35123, /* LV 29 */ 39022, /* LV 30 */ 43200, /* LV 31 */ 47665,
  /* LV 32 */ 52428, /* LV 33 */ 57499, /* LV 34 */ 62886, /* LV 35 */ 68600, /* LV 36 */ 74649,
  /* LV 37 */ 81044, /* LV 38 */ 87795, /* LV 39 */ 94910, /* LV 40 */ 102400, /* LV 41 */ 110273,
  /* LV 42 */ 118540, /* LV 43 */ 127211, /* LV 44 */ 136294, /* LV 45 */ 145800,
  /* LV 46 */ 155737, /* LV 47 */ 166116, /* LV 48 */ 176947, /* LV 49 */ 188238,
  /* LV 50 */ 200000, /* LV 51 */ 215303, /* LV 52 */ 231216, /* LV 53 */ 247754,
  /* LV 54 */ 264928, /* LV 55 */ 282750, /* LV 56 */ 301232, /* LV 57 */ 320386,
  /* LV 58 */ 340224, /* LV 59 */ 360758, /* LV 60 */ 382000,
];

/**
 * Addition unlock schedule by level. Values are stored as strings (not the
 * stricter `AdditionKind` union) because future additions aren't declared in
 * `ADDITIONS` yet — consumers must guard with `kind in ADDITIONS`.
 *
 *   1  → Double Slash
 *   8  → Volcano
 *   15 → Burning Rush
 *   22 → Crush Dance
 *   29 → Madness Hero
 *   36 → Moon Strike
 *   50 → Blazing Dynamo
 */
export const DART_ADDITION_UNLOCKS_BY_LEVEL: ReadonlyMap<number, string> = new Map([
  [1, 'doubleSlash'],
  [8, 'volcano'],
  [15, 'burningRush'],
  [22, 'crushDance'],
  [29, 'madnessHero'],
  [36, 'moonStrike'],
  [50, 'blazingDynamo'],
]);
