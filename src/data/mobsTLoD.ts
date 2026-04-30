import type { MobKind } from './balance';
import type { SpellElement } from './spells';

/**
 * TLoD-canonical mob stats (US/EU values when the wiki lists both regions).
 * Source: https://legendofdragoon.fandom.com per-monster pages.
 *
 * REFERENCE DATA only — `MOBS` in `data/balance.ts` keeps the action-RPG
 * tuned values that the live engine reads. Switching to TLoD-canonical
 * needs:
 *   1. Damage formula change (TLoD's `max(1, atk - def)` shape, not our
 *      additive variance);
 *   2. Parallel rebalance of Dart's stats (we already have `dart.ts`);
 *   3. Mob HP scaled to TLoD numbers (Mouse HP=2 vs our 20).
 *
 * Fields kept loose where TLoD doesn't expose them (no `range`/`aggroRange`
 * — that's our action-RPG-only concern).
 */

/**
 * Mob drop entry. `item` is a string slug rather than the strict `ItemKind`
 * union because the wiki references items we haven't declared yet
 * (`detonateRock`, `pellet`, etc.). Future consumers must guard with
 * `slug in ITEMS` before resolving an effect.
 */
export interface TLoDMobDrop {
  item: string;
  /** [0, 1] probability per kill. */
  chance: number;
}

export interface TLoDMobStats {
  /** Free-form area name from the wiki (e.g. "Forest", "Hellena Prison"). */
  location: string;
  /** Elemental affinity. Used by the (future) elemental multiplier system. */
  element: SpellElement;
  hp: number;
  xp: number;
  /** Gold dropped per kill (always, separate from `drops` table). */
  gold: number;
  /** P.Attack — physical attack stat. */
  pAtk: number;
  /** P.Defense — physical defense stat. */
  pDef: number;
  /** M.Attack — magical attack stat. */
  mAtk: number;
  /** M.Defense — magical defense stat. */
  mDef: number;
  speed: number;
  /**
   * Per-mob loot table. Each entry rolls independently — multiple drops
   * from the same kill are allowed if the wiki says so (rare).
   */
  drops: ReadonlyArray<TLoDMobDrop>;
  /** Wiki "Can Counterattack" flag. Drives a future retaliate-on-hit behavior. */
  canCounterAttack: boolean;
  /**
   * Dodge / evasion %. Wiki doesn't list it on every page yet; default 0.
   * User flagged this as a future stat to wire — exposed already so the
   * data shape doesn't churn when we add the dodge roll.
   */
  dodge?: number;
}

/**
 * Filled per mob as we collect wiki data. Entries can be added incrementally;
 * unknown mobs fall through to `null` via `getTLoDMobStats`.
 */
export const MOBS_TLOD: Partial<Record<MobKind, TLoDMobStats>> = {
  berserkMouse: {
    location: 'Forest',
    element: 'dark',
    hp: 2,
    xp: 3,
    gold: 3,
    pAtk: 2,
    pDef: 80,
    mAtk: 2,
    mDef: 120,
    speed: 50,
    drops: [{ item: 'healingPotion', chance: 0.1 }],
    canCounterAttack: true,
  },
  goblin: {
    location: 'Forest',
    element: 'fire',
    hp: 4,
    xp: 4,
    gold: 6,
    pAtk: 2,
    pDef: 120,
    mAtk: 3,
    mDef: 120,
    speed: 40,
    drops: [{ item: 'detonateRock', chance: 0.1 }],
    canCounterAttack: true,
  },
  assassinCock: {
    location: 'Forest',
    element: 'wind',
    hp: 3,
    xp: 5,
    gold: 6,
    pAtk: 2,
    pDef: 100,
    mAtk: 3,
    mDef: 120,
    speed: 50,
    drops: [{ item: 'healingPotion', chance: 0.1 }],
    canCounterAttack: true,
  },
  trent: {
    location: 'Forest',
    element: 'earth',
    hp: 5,
    xp: 4,
    gold: 9,
    pAtk: 3,
    pDef: 160,
    mAtk: 3,
    mDef: 120,
    speed: 30,
    drops: [{ item: 'pellet', chance: 0.1 }],
    canCounterAttack: true,
  },
};

/** Lookup helper — returns `null` for mobs not yet in the table. */
export function getTLoDMobStats(kind: MobKind): TLoDMobStats | null {
  return MOBS_TLOD[kind] ?? null;
}
