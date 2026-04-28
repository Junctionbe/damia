import type { Entity, World } from '@core/ecs';
import { gridToWorld } from '@core/math/iso';
import type { AIBehavior, Components } from '@gameplay/components';
import { MOBS, type MobKind } from '@data/balance';

const KIND_TO_BEHAVIOR: Record<MobKind, AIBehavior> = {
  berserkMouse: 'mouse',
  goblin: 'goblin',
  assassinCock: 'cock',
  trent: 'trent',
};

/** Generic mob assembler. Looks up stats/sprite in `MOBS` and AI behavior in the table above. */
export function spawnMob(world: World<Components>, kind: MobKind, gx: number, gy: number): Entity {
  const def = MOBS[kind];
  const { x, y } = gridToWorld(gx, gy);
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Velocity', { vx: 0, vy: 0 });
  world.addComponent(id, 'Speed', { value: def.speed });
  world.addComponent(id, 'Pathfinder', { targetGrid: null, waypoints: null, computing: false });
  world.addComponent(id, 'Health', { current: def.health, max: def.health, invulnUntilMs: 0 });
  world.addComponent(id, 'Stats', { ...def.stats });
  world.addComponent(id, 'Faction', { side: 'enemy' });
  world.addComponent(id, 'AttackCooldown', { remainingMs: 0 });
  world.addComponent(id, 'Sprite', { ...def.sprite, layer: 'entities' });
  world.addComponent(id, 'AI', { behavior: KIND_TO_BEHAVIOR[kind] });
  return id;
}
