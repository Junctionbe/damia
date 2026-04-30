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
export interface SaveDataV4 {
  schemaVersion: 4;
  zone: 'forest';
  player: { hp: number; maxHp: number; gx: number; gy: number };
  inventory: { items: Partial<Record<ItemKind, number>>; gold: number };
  hotbar: ReadonlyArray<HotbarSlot>;
  progression: { level: number; xp: number; xpToNext: number };
  activeAddition: AdditionKind;
  savedAtMs: number;
}

/** Public aliases used by callers — always point at the latest schema. */
export type SaveDataV1 = SaveDataV4;
export type SaveDataV2 = SaveDataV4;
export type SaveDataV3 = SaveDataV4;

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
function migrateV3ToV4(v3: SaveDataV3Wire): SaveDataV4 {
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

export const SaveManager = {
  save(payload: Omit<SaveDataV4, 'schemaVersion' | 'savedAtMs'>): void {
    const data: SaveDataV4 = { schemaVersion: 4, savedAtMs: Date.now(), ...payload };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[SaveManager] failed to persist save:', e);
    }
  },

  load(): SaveDataV4 | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { schemaVersion?: number };
      if (parsed.schemaVersion === 4) return parsed as SaveDataV4;
      if (parsed.schemaVersion === 3) return migrateV3ToV4(parsed as SaveDataV3Wire);
      if (parsed.schemaVersion === 2) {
        return migrateV3ToV4(migrateV2ToV3(parsed as SaveDataV2Wire));
      }
      if (parsed.schemaVersion === 1) {
        return migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(parsed as SaveDataV1Wire)));
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
