import type { AdditionKind } from '@data/balance';
import type { ItemKind } from '@data/items';
import { xpThresholdForLevel } from '@data/progression';
import type { HotbarSlot } from '@ui/Hotbar';

const KEY = 'damia.save';

/** V1 (pre-M9): no inventory, no hotbar bindings, no progression. */
interface SaveDataV1Wire {
  schemaVersion: 1;
  zone: 'forest';
  player: { hp: number; maxHp: number; gx: number; gy: number };
  savedAtMs: number;
}

/** V2 (M9): adds inventory (items + gold) and hotbar slot bindings. */
interface SaveDataV2Wire {
  schemaVersion: 2;
  zone: 'forest';
  player: { hp: number; maxHp: number; gx: number; gy: number };
  inventory: { items: Partial<Record<ItemKind, number>>; gold: number };
  hotbar: ReadonlyArray<HotbarSlot>;
  savedAtMs: number;
}

/** V3: adds character progression (level / xp / xpToNext). */
interface SaveDataV3Wire {
  schemaVersion: 3;
  zone: 'forest';
  player: { hp: number; maxHp: number; gx: number; gy: number };
  inventory: { items: Partial<Record<ItemKind, number>>; gold: number };
  hotbar: ReadonlyArray<HotbarSlot>;
  progression: { level: number; xp: number; xpToNext: number };
  savedAtMs: number;
}

/** V4: adds `activeAddition` (the addition fired by right-click). The Hotbar
 *  no longer hosts additions; they live in their own AdditionsBar. */
interface SaveDataV4Wire {
  schemaVersion: 4;
  zone: 'forest';
  player: { hp: number; maxHp: number; gx: number; gy: number };
  inventory: { items: Partial<Record<ItemKind, number>>; gold: number };
  hotbar: ReadonlyArray<HotbarSlot>;
  progression: { level: number; xp: number; xpToNext: number };
  activeAddition: AdditionKind;
  savedAtMs: number;
}

/** Zone identifier — extend with each new playable zone. */
export type ZoneId = 'forest' | 'hellena';

/**
 * V5: multi-zone support. `currentZoneId` lets Continue resume the right zone.
 * `fogByZone` persists the minimap-revealed grid per zone so revisiting shows
 * what we already explored. `discoveredZones` is the set the WorldMap renders
 * markers for.
 */
export interface SaveDataV5 {
  schemaVersion: 5;
  currentZoneId: ZoneId;
  discoveredZones: ReadonlyArray<ZoneId>;
  /** Per-zone minimap fog reveal grid. Indexed by zone id; entries are 2D
   *  boolean arrays of `revealed[gx][gy]`. Optional — missing zones start fully
   *  unrevealed (the MiniMap will rebuild the grid). */
  fogByZone?: Partial<Record<ZoneId, boolean[][]>>;
  player: { hp: number; maxHp: number; gx: number; gy: number };
  inventory: { items: Partial<Record<ItemKind, number>>; gold: number };
  hotbar: ReadonlyArray<HotbarSlot>;
  progression: { level: number; xp: number; xpToNext: number };
  activeAddition: AdditionKind;
  savedAtMs: number;
}

/** Public aliases used by callers — always point at the latest schema. */
export type SaveDataV1 = SaveDataV5;
export type SaveDataV2 = SaveDataV5;
export type SaveDataV3 = SaveDataV5;
export type SaveDataV4 = SaveDataV5;

/** V2's defaults — additions still lived in slot 0 back then. */
const DEFAULT_HOTBAR_V2: ReadonlyArray<HotbarSlot> = [
  { kind: 'addition', addition: 'doubleSlash' },
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

function migrateV1ToV2(v1: SaveDataV1Wire): SaveDataV2Wire {
  return {
    schemaVersion: 2,
    zone: v1.zone,
    player: v1.player,
    inventory: { items: {}, gold: 0 },
    hotbar: DEFAULT_HOTBAR_V2,
    savedAtMs: v1.savedAtMs,
  };
}

function migrateV2ToV3(v2: SaveDataV2Wire): SaveDataV3Wire {
  return {
    schemaVersion: 3,
    zone: v2.zone,
    player: v2.player,
    inventory: v2.inventory,
    hotbar: v2.hotbar,
    progression: { level: 1, xp: 0, xpToNext: xpThresholdForLevel(2) },
    savedAtMs: v2.savedAtMs,
  };
}

/**
 * V3 → V4: additions moved out of the Hotbar into their own AdditionsBar.
 * Strip any 'addition' slot from the saved hotbar (becomes null) and seed
 * `activeAddition` with the slot 0 binding's addition if it was an addition,
 * else default to 'doubleSlash'.
 */
function migrateV3ToV4(v3: SaveDataV3Wire): SaveDataV4Wire {
  const slot0 = v3.hotbar[0];
  const seedActive: AdditionKind =
    slot0 && slot0.kind === 'addition' ? slot0.addition : 'doubleSlash';
  const cleanedHotbar: HotbarSlot[] = v3.hotbar.map((s) => (s && s.kind === 'addition' ? null : s));
  return {
    schemaVersion: 4,
    zone: v3.zone,
    player: v3.player,
    inventory: v3.inventory,
    hotbar: cleanedHotbar,
    progression: v3.progression,
    activeAddition: seedActive,
    savedAtMs: v3.savedAtMs,
  };
}

/**
 * V4 → V5: introduce multi-zone support. The single legacy `zone: 'forest'`
 * becomes `currentZoneId`; we seed `discoveredZones` with both Forest and
 * Hellena so migrated saves can immediately access the WorldMap (matches
 * the new-game default — see DEFAULT_DISCOVERED_ZONES at the call site).
 */
function migrateV4ToV5(v4: SaveDataV4Wire): SaveDataV5 {
  return {
    schemaVersion: 5,
    currentZoneId: v4.zone,
    discoveredZones: ['forest', 'hellena'],
    player: v4.player,
    inventory: v4.inventory,
    hotbar: v4.hotbar,
    progression: v4.progression,
    activeAddition: v4.activeAddition,
    savedAtMs: v4.savedAtMs,
  };
}

export const SaveManager = {
  save(payload: Omit<SaveDataV5, 'schemaVersion' | 'savedAtMs'>): void {
    const data: SaveDataV5 = { schemaVersion: 5, savedAtMs: Date.now(), ...payload };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[SaveManager] failed to persist save:', e);
    }
  },

  load(): SaveDataV5 | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { schemaVersion?: number };
      if (parsed.schemaVersion === 5) return parsed as SaveDataV5;
      if (parsed.schemaVersion === 4) return migrateV4ToV5(parsed as SaveDataV4Wire);
      if (parsed.schemaVersion === 3) {
        return migrateV4ToV5(migrateV3ToV4(parsed as SaveDataV3Wire));
      }
      if (parsed.schemaVersion === 2) {
        return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(parsed as SaveDataV2Wire)));
      }
      if (parsed.schemaVersion === 1) {
        return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(parsed as SaveDataV1Wire))));
      }
      return null;
    } catch {
      return null;
    }
  },

  has(): boolean {
    return SaveManager.load() !== null;
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};
