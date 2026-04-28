import type { ItemKind } from '@data/items';

/** Marks an entity as a pickable item. The Position component places it on the ground. */
export interface Item {
  kind: ItemKind;
}
