import type { Entity, World } from '@core/ecs';
import { gridToWorld } from '@core/math/iso';
import type { Components, Exit } from '@gameplay/components';

/** Spawns an invisible trigger entity. ExitSystem reads it. */
export function spawnExit(world: World<Components>, exit: Exit): Entity {
  const { x, y } = gridToWorld(exit.gx, exit.gy);
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Exit', exit);
  return id;
}
