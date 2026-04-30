import type { Sprite, SpriteShape } from '@gameplay/components';
import type { AssetAlias } from '@services/AssetManager';
import type { SpellKind } from './spells';

export type ItemKind = 'healingPotion' | 'burnOut' | 'gold';

/**
 * Effect bound to an item when consumed from the inventory. `null` for items
 * with no usable effect (e.g. `gold` is currency only). `'spell'` items defer
 * to the spell pipeline (cast on consume; see `data/spells.ts`).
 */
export type ItemUseEffect =
  | { kind: 'heal'; percentMaxHp: number }
  | { kind: 'spell'; spell: SpellKind }
  | null;

export interface ItemDefinition {
  /** i18n key for the display name. */
  nameKey: string;
  sprite: { shape: SpriteShape; color: number; width: number; height: number };
  /** Optional textured icon used for both the world-drop and the Hotbar badge.
   *  When set, RenderSystem renders a Pixi.Sprite from this texture; the
   *  shape/color above is the fallback if the asset failed to load. */
  iconAlias?: AssetAlias;
  /** Loot weight relative to others (used by rollLoot). */
  weight: number;
  /** What happens when the player consumes this item from the inventory. */
  use: ItemUseEffect;
  /** True if this item should occupy a Hotbar slot when picked up. Currency items don't. */
  bindable: boolean;
}

export const ITEMS: Record<ItemKind, ItemDefinition> = {
  healingPotion: {
    nameKey: 'items.healingPotion',
    sprite: { shape: 'circle', color: 0xd03030, width: 22, height: 22 },
    iconAlias: 'sprite.item.healingPotion',
    weight: 50,
    use: { kind: 'heal', percentMaxHp: 0.5 },
    bindable: true,
  },
  // BurnOut is a magical attack item in TLoD: consume → cast Burn Out spell on
  // current target. Cast cost = 1 BurnOut item.
  burnOut: {
    nameKey: 'items.burnOut',
    sprite: { shape: 'circle', color: 0xe07020, width: 22, height: 22 },
    iconAlias: 'sprite.item.burnOut',
    weight: 30,
    use: { kind: 'spell', spell: 'burnOut' },
    bindable: true,
  },
  gold: {
    nameKey: 'items.gold',
    sprite: { shape: 'circle', color: 0xeec040, width: 16, height: 16 },
    weight: 20,
    use: null,
    bindable: false,
  },
};

/** Probability that a kill drops anything at all. TODO: revert to 0.3 before ship. */
export const DROP_CHANCE = 0.9;

/**
 * Pure roll: returns an ItemKind or `null`. Two `roll` parameters in [0, 1)
 * are injected for testability — first decides if anything drops, second
 * picks among kinds weighted by `weight`.
 */
export function rollLoot(rollDrop: number, rollKind: number): ItemKind | null {
  if (rollDrop >= DROP_CHANCE) return null;
  const totalWeight = (Object.values(ITEMS) as ItemDefinition[]).reduce(
    (sum, def) => sum + def.weight,
    0,
  );
  let target = rollKind * totalWeight;
  for (const kind of Object.keys(ITEMS) as ItemKind[]) {
    target -= ITEMS[kind].weight;
    if (target <= 0) return kind;
  }
  return null;
}

export function itemSpriteComponent(kind: ItemKind, layer: Sprite['layer']): Sprite {
  const def = ITEMS[kind];
  return {
    ...def.sprite,
    layer,
    ...(def.iconAlias ? { textureAlias: def.iconAlias } : {}),
  };
}
