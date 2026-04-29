import type { Sprite, Stats } from '@gameplay/components';

export const COMBAT = {
  /** Damage rolled uniformly in [base - variance, base + variance]. */
  damageVariance: 2,
  /** Multiplier applied to incoming damage while Defending. */
  defendingDamageMul: 0.5,
  /** Hard floor: every successful hit deals at least this much. */
  minDamage: 1,
} as const;

export const PLAYER_BASE = {
  health: 100,
  speed: 0.18,
  stats: { atk: 12, def: 3, atkSpeed: 1.5, range: 80, aggroRange: 0 } as Stats,
} as const;

export type MobKind = 'berserkMouse' | 'goblin' | 'assassinCock' | 'trent';

export interface MobDefinition {
  health: number;
  speed: number;
  stats: Stats;
  sprite: Omit<Sprite, 'layer' | 'scale'>;
  /** XP awarded on kill. */
  xp: number;
}

export const MOBS: Record<MobKind, MobDefinition> = {
  berserkMouse: {
    health: 20,
    speed: 0.12,
    stats: { atk: 5, def: 1, atkSpeed: 1, range: 80, aggroRange: 256 },
    sprite: { shape: 'circle', color: 0xc77ba0, width: 32, height: 32 },
    xp: 5,
  },
  goblin: {
    health: 40,
    speed: 0.1,
    stats: { atk: 8, def: 4, atkSpeed: 1, range: 80, aggroRange: 200 },
    sprite: { shape: 'capsule', color: 0x4a8f3a, width: 26, height: 44 },
    xp: 12,
  },
  assassinCock: {
    health: 30,
    speed: 0.16,
    stats: { atk: 7, def: 2, atkSpeed: 1.4, range: 96, aggroRange: 320 },
    sprite: { shape: 'diamond', color: 0x6a3a8f, width: 36, height: 32 },
    xp: 8,
  },
  trent: {
    health: 50,
    speed: 0.06,
    stats: { atk: 12, def: 6, atkSpeed: 0.5, range: 80, aggroRange: 192 },
    // Foliage tinted blood-red so Trent (living mob) is unmistakable from decorative trees.
    sprite: { shape: 'tree', color: 0x8a2a2a, width: 56, height: 80 },
    xp: 15,
  },
} as const;

/**
 * Pure damage formula. Tested in `tests/gameplay/combat.test.ts`.
 * Returns the integer damage dealt (clamped to `COMBAT.minDamage`).
 *
 * `roll` is a [0, 1) random factor (injected for testability).
 * `defending` halves the result before flooring.
 */
export function computeDamage(
  attackerAtk: number,
  defenderDef: number,
  roll: number,
  defending: boolean,
): number {
  const variance = (roll * 2 - 1) * COMBAT.damageVariance;
  let dmg = attackerAtk - defenderDef + variance;
  if (defending) dmg *= COMBAT.defendingDamageMul;
  return Math.max(COMBAT.minDamage, Math.round(dmg));
}
