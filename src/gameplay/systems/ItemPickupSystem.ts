import type { System, World } from '@core/ecs';
import type { Components } from '@gameplay/components';
import type { ItemKind } from '@data/items';

const PICKUP_RADIUS_PX = 36;

export interface ItemPickupEvent {
  kind: ItemKind;
}

export type ItemPickupListener = (event: ItemPickupEvent) => void;

/**
 * Each frame, picks up any Item entity whose Position is within `PICKUP_RADIUS_PX`
 * of the player. Fires `onPickup` once per item.
 */
export class ItemPickupSystem implements System<Components> {
  private listener: ItemPickupListener | null = null;

  onPickup(listener: ItemPickupListener): void {
    this.listener = listener;
  }

  update(_dt: number, world: World<Components>): void {
    const players = world.query(['Player', 'Position']);
    const playerId = players[0];
    if (playerId === undefined) return;
    const ppos = world.getComponent(playerId, 'Position');
    if (!ppos) return;

    for (const id of world.query(['Item', 'Position'])) {
      const ipos = world.getComponent(id, 'Position');
      const item = world.getComponent(id, 'Item');
      if (!ipos || !item) continue;
      if (Math.hypot(ipos.x - ppos.x, ipos.y - ppos.y) <= PICKUP_RADIUS_PX) {
        this.listener?.({ kind: item.kind });
        world.destroyEntity(id);
      }
    }
  }

  destroy(): void {
    this.listener = null;
  }
}
