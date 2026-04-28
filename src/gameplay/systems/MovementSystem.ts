import type { System, World } from '@core/ecs';
import type { Components } from '@gameplay/components';

/** Snap distance: when within this many pixels of a waypoint, consider it reached. */
const ARRIVAL_EPSILON = 0.5;

/**
 * Walks each entity along its Pathfinder waypoints at its Speed.
 * Constant-speed linear interpolation; no acceleration.
 */
export class MovementSystem implements System<Components> {
  update(dt: number, world: World<Components>): void {
    for (const id of world.query(['Position', 'Pathfinder', 'Speed'])) {
      const pos = world.getComponent(id, 'Position');
      const pf = world.getComponent(id, 'Pathfinder');
      const speed = world.getComponent(id, 'Speed');
      if (!pos || !pf || !speed) continue;

      const waypoints = pf.waypoints;
      if (!waypoints || waypoints.length === 0) continue;

      let remaining = speed.value * dt;
      while (remaining > 0 && waypoints.length > 0) {
        const target = waypoints[0];
        if (!target) break;
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= remaining || dist < ARRIVAL_EPSILON) {
          pos.x = target.x;
          pos.y = target.y;
          waypoints.shift();
          remaining -= dist;
        } else {
          pos.x += (dx / dist) * remaining;
          pos.y += (dy / dist) * remaining;
          remaining = 0;
        }
      }

      if (waypoints.length === 0) {
        pf.waypoints = null;
        pf.targetGrid = null;
      }
    }
  }
}
