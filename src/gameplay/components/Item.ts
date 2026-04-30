import type { ItemKind } from '@data/items';

/** Marks an entity as a pickable item. The Position component places it on the ground. */
export interface Item {
  kind: ItemKind;
  /** Optional `performance.now()` floor before the item can be picked up. Used
   *  to keep player-dropped items from being re-grabbed the next frame. */
  pickableAfterMs?: number;
}
