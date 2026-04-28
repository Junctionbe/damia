import { AssetManager } from '@services/AssetManager';
import { gridToWorld } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import type { Entity, World } from '@core/ecs';

/** Default movement speed in pixels per millisecond (≈ 0.18 px/ms = 180 px/s). */
const DEFAULT_SPEED = 0.18;

export interface SpawnPlayerOptions {
  gx: number;
  gy: number;
  speed?: number;
}

export function spawnPlayer(world: World<Components>, opts: SpawnPlayerOptions): Entity {
  const { x, y } = gridToWorld(opts.gx, opts.gy);
  const id = world.createEntity();

  world.addComponent(id, 'Player', {});
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Velocity', { vx: 0, vy: 0 });
  world.addComponent(id, 'Speed', { value: opts.speed ?? DEFAULT_SPEED });
  world.addComponent(id, 'Pathfinder', {
    targetGrid: null,
    waypoints: null,
    computing: false,
  });
  world.addComponent(
    id,
    'Sprite',
    AssetManager.toSpriteComponent('sprite.player.dart', 'entities'),
  );

  return id;
}
