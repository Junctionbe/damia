import type { MobKind } from './balance';

export type EncounterZoneId = 'forest';

/**
 * A pre-composed group of mobs spawned together when this formation is rolled.
 * Mirrors TLoD's per-zone "battle formations" — each zone has a finite list of
 * specific compositions (e.g. Trent + Goblin) rather than randomised count of
 * a single kind.
 */
export interface EncounterFormation {
  /** Mob kinds spawned for this encounter — one entity per entry, in order. */
  mobs: ReadonlyArray<MobKind>;
  /** Pick weight inside the zone (relative; doesn't need to sum to 1). */
  weight: number;
}

export interface EncounterZone {
  /** Distance the player must walk for the encounter meter to fill once. */
  pxPerEncounter: number;
  /** Cap on simultaneous random-spawned mobs in the zone (scripted mobs don't count). */
  maxConcurrentRandomMobs: number;
  formations: ReadonlyArray<EncounterFormation>;
}

export const ENCOUNTERS: Record<EncounterZoneId, EncounterZone> = {
  forest: {
    // DEV: aggressive 200 px (~2 s of walking) so encounters fire fast for
    // testing. TODO: bump back to ~800 before ship.
    pxPerEncounter: 200,
    maxConcurrentRandomMobs: 5,
    // TLoD-canonical Forest of Seles formations. Equal weights — adjust if
    // some compositions feel too rare / common after playtesting.
    formations: [
      { mobs: ['trent'], weight: 1 },
      { mobs: ['trent', 'goblin'], weight: 1 },
      { mobs: ['trent', 'assassinCock'], weight: 1 },
      { mobs: ['assassinCock'], weight: 1 },
      { mobs: ['assassinCock', 'assassinCock'], weight: 1 },
      { mobs: ['assassinCock', 'goblin'], weight: 1 },
      { mobs: ['assassinCock', 'berserkMouse'], weight: 1 },
    ],
  },
};

/** Pick a formation by weight. `roll` is a [0, 1) random factor (injected for testability). */
export function pickFormation(zone: EncounterZone, roll: number): EncounterFormation {
  const total = zone.formations.reduce((s, f) => s + f.weight, 0);
  let acc = roll * total;
  for (const f of zone.formations) {
    acc -= f.weight;
    if (acc <= 0) return f;
  }
  return zone.formations[zone.formations.length - 1]!;
}
