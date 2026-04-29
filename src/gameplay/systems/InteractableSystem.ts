import type { System, World } from '@core/ecs';
import { worldToGrid } from '@core/math/iso';
import type { Components, Interactable } from '@gameplay/components';

export interface InteractableTrigger {
  interactable: Interactable;
}

export type InteractableListener = (trigger: InteractableTrigger) => void;

/**
 * Mirrors ExitSystem's pattern: fires once per cell entry. The scene wires the
 * listener to a toast / dialog. M6 use case: Merchant placeholder.
 */
export class InteractableSystem implements System<Components> {
  private lastTriggeredCell: { gx: number; gy: number } | null = null;
  private listener: InteractableListener | null = null;

  onTrigger(listener: InteractableListener): void {
    this.listener = listener;
  }

  update(_dt: number, world: World<Components>): void {
    const players = world.query(['Player', 'Position']);
    if (players.length === 0) return;
    const playerId = players[0];
    if (playerId === undefined) return;
    const pos = world.getComponent(playerId, 'Position');
    if (!pos) return;

    const grid = worldToGrid(pos.x, pos.y);
    const gx = Math.round(grid.x);
    const gy = Math.round(grid.y);

    let onCell: Interactable | null = null;
    for (const id of world.query(['Interactable'])) {
      const i = world.getComponent(id, 'Interactable');
      if (!i) continue;
      if (i.gx === gx && i.gy === gy) {
        onCell = i;
        break;
      }
    }

    if (onCell) {
      const last = this.lastTriggeredCell;
      if (!last || last.gx !== gx || last.gy !== gy) {
        this.lastTriggeredCell = { gx, gy };
        this.listener?.({ interactable: onCell });
      }
    } else {
      this.lastTriggeredCell = null;
    }
  }
}
