import type { System, World } from '@core/ecs';
import { worldToGrid } from '@core/math/iso';
import type { Components, Exit } from '@gameplay/components';

export interface ExitTrigger {
  exit: Exit;
}

export type ExitListener = (trigger: ExitTrigger) => void;

/**
 * Each frame, checks whether the player's current grid cell matches an Exit
 * entity. Fires the registered listener once per entry — re-triggers only after
 * the player has stepped off and back on.
 */
export class ExitSystem implements System<Components> {
  private lastTriggeredCell: { gx: number; gy: number } | null = null;
  private listener: ExitListener | null = null;

  onTrigger(listener: ExitListener): void {
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

    const exits = world.query(['Exit']);
    let onExit: Exit | null = null;
    for (const id of exits) {
      const exit = world.getComponent(id, 'Exit');
      if (!exit) continue;
      if (exit.gx === gx && exit.gy === gy) {
        onExit = exit;
        break;
      }
    }

    if (onExit) {
      const last = this.lastTriggeredCell;
      if (!last || last.gx !== gx || last.gy !== gy) {
        this.lastTriggeredCell = { gx, gy };
        this.listener?.({ exit: onExit });
      }
    } else {
      this.lastTriggeredCell = null;
    }
  }
}
