import { AssetManager } from '@services/AssetManager';
import { gridToWorld } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import type { Entity, World } from '@core/ecs';
import { PLAYER_BASE } from '@data/balance';

export interface SpawnPlayerOptions {
  gx: number;
  gy: number;
  /** Override starting HP (clamped to max). Defaults to PLAYER_BASE.health. */
  hp?: number;
}

export function spawnPlayer(world: World<Components>, opts: SpawnPlayerOptions): Entity {
  const { x, y } = gridToWorld(opts.gx, opts.gy);
  const id = world.createEntity();
  const max = PLAYER_BASE.health;
  const startHp = Math.max(1, Math.min(max, opts.hp ?? max));

  world.addComponent(id, 'Player', {});
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Velocity', { vx: 0, vy: 0 });
  world.addComponent(id, 'Speed', { value: PLAYER_BASE.speed });
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
  world.addComponent(id, 'Health', {
    current: startHp,
    max,
    invulnUntilMs: 0,
  });
  world.addComponent(id, 'Stats', { ...PLAYER_BASE.stats });
  world.addComponent(id, 'Faction', { side: 'player' });
  world.addComponent(id, 'AttackCooldown', { remainingMs: 0 });

  return id;
}
