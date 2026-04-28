import type { Sprite, SpriteShape } from '@gameplay/components';

export type ItemKind = 'healingPotion' | 'burnOut' | 'gold';

export interface ItemDefinition {
  /** i18n key for the display name. */
  nameKey: string;
  sprite: { shape: SpriteShape; color: number; width: number; height: number };
  /** Loot weight relative to others (used by rollLoot). */
  weight: number;
}

export const ITEMS: Record<ItemKind, ItemDefinition> = {
  healingPotion: {
    nameKey: 'items.healingPotion',
    sprite: { shape: 'circle', color: 0xd03030, width: 18, height: 18 },
    weight: 50,
  },
  burnOut: {
    nameKey: 'items.burnOut',
    sprite: { shape: 'circle', color: 0xe07020, width: 18, height: 18 },
    weight: 30,
  },
  gold: {
    nameKey: 'items.gold',
    sprite: { shape: 'circle', color: 0xeec040, width: 16, height: 16 },
    weight: 20,
  },
};

/** Probability that a kill drops anything at all. */
export const DROP_CHANCE = 0.3;

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
  return { ...ITEMS[kind].sprite, layer };
}
