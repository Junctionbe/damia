import EasyStar from 'easystarjs';
import type { System, World } from '@core/ecs';
import { gridToWorld, worldToGrid } from '@core/math/iso';
import type { Components } from '@gameplay/components';

const WALKABLE = 0;

/**
 * For every entity with a Pathfinder.targetGrid set but no waypoints, computes a
 * path through easystarjs and stores the resulting waypoints in world coords.
 */
export class PathfindingSystem implements System<Components> {
  private readonly easystar: EasyStar.js;

  constructor(grid: number[][]) {
    this.easystar = new EasyStar.js();
    this.easystar.setGrid(grid);
    this.easystar.setAcceptableTiles([WALKABLE]);
    this.easystar.enableDiagonals();
    this.easystar.disableCornerCutting();
  }

  update(_dt: number, world: World<Components>): void {
    for (const id of world.query(['Pathfinder', 'Position'])) {
      const pf = world.getComponent(id, 'Pathfinder');
      const pos = world.getComponent(id, 'Position');
      if (!pf || !pos) continue;

      if (pf.targetGrid && !pf.waypoints && !pf.computing) {
        const startGrid = worldToGrid(pos.x, pos.y);
        const sx = Math.round(startGrid.x);
        const sy = Math.round(startGrid.y);
        const tx = pf.targetGrid.gx;
        const ty = pf.targetGrid.gy;

        if (sx === tx && sy === ty) {
          pf.targetGrid = null;
          continue;
        }

        pf.computing = true;
        this.easystar.findPath(sx, sy, tx, ty, (path) => {
          if (!path || path.length === 0) {
            pf.targetGrid = null;
            pf.waypoints = null;
            pf.computing = false;
            return;
          }
          // Skip the first node (current cell) to avoid jitter around the start.
          const skipFirst = path[0]?.x === sx && path[0]?.y === sy ? 1 : 0;
          pf.waypoints = path.slice(skipFirst).map(({ x, y }) => gridToWorld(x, y));
          pf.computing = false;
        });
      }
    }
    this.easystar.calculate();
  }
}
