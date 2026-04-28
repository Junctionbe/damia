import type { Entity, System, World } from '@core/ecs';
import { worldToGrid } from '@core/math/iso';
import type { Components, Position } from '@gameplay/components';

const FLEE_HP_THRESHOLD = 0.3;
const FLEE_DISTANCE_PX = 320;
const COCK_RETREAT_DISTANCE_PX = 200;
/** Cock starts retreating when its cooldown is more than this fraction of full. */
const COCK_RETREAT_COOLDOWN_RATIO = 0.5;

interface SceneBounds {
  width: number;
  height: number;
}

/**
 * Per-mob behavior dispatcher. Each mob with an AI component is routed to a
 * handler that updates CombatIntent and Pathfinder accordingly.
 *
 * Behaviors:
 * - mouse  : aggros short-range, flees below 30% HP toward a cell opposite the player
 * - goblin : standard aggro at medium range, no special behavior
 * - cock   : aggros long-range, hit-and-run — retreats while cooldown is fresh
 * - trent  : standard aggro at short range (slow stats already differentiate it)
 */
export class AISystem implements System<Components> {
  constructor(private readonly bounds: SceneBounds) {}

  update(_dt: number, world: World<Components>): void {
    const players = world.query(['Player', 'Position']);
    const playerId = players[0];
    if (playerId === undefined) return;
    const playerPos = world.getComponent(playerId, 'Position');
    if (!playerPos) return;

    for (const id of world.query(['AI', 'Position', 'Stats'])) {
      const ai = world.getComponent(id, 'AI');
      if (!ai) continue;
      switch (ai.behavior) {
        case 'mouse':
          updateMouse(id, world, playerId, playerPos, this.bounds);
          break;
        case 'goblin':
        case 'trent':
          updateStandardMelee(id, world, playerId, playerPos);
          break;
        case 'cock':
          updateCock(id, world, playerId, playerPos, this.bounds);
          break;
      }
    }
  }
}

function updateMouse(
  id: Entity,
  world: World<Components>,
  playerId: Entity,
  playerPos: Position,
  bounds: SceneBounds,
): void {
  const pos = world.getComponent(id, 'Position');
  const hp = world.getComponent(id, 'Health');
  const stats = world.getComponent(id, 'Stats');
  const pf = world.getComponent(id, 'Pathfinder');
  if (!pos || !hp || !stats || !pf) return;

  const fleeing = hp.current / hp.max < FLEE_HP_THRESHOLD;
  if (fleeing) {
    if (world.hasComponent(id, 'CombatIntent')) world.removeComponent(id, 'CombatIntent');
    setFleeTarget(pf, pos, playerPos, FLEE_DISTANCE_PX, bounds);
    return;
  }

  const dist = distance(pos, playerPos);
  if (dist <= stats.aggroRange && !world.hasComponent(id, 'CombatIntent')) {
    world.addComponent(id, 'CombatIntent', { targetId: playerId });
  }
}

function updateStandardMelee(
  id: Entity,
  world: World<Components>,
  playerId: Entity,
  playerPos: Position,
): void {
  const pos = world.getComponent(id, 'Position');
  const stats = world.getComponent(id, 'Stats');
  if (!pos || !stats) return;
  if (world.hasComponent(id, 'CombatIntent')) return;
  if (distance(pos, playerPos) <= stats.aggroRange) {
    world.addComponent(id, 'CombatIntent', { targetId: playerId });
  }
}

function updateCock(
  id: Entity,
  world: World<Components>,
  playerId: Entity,
  playerPos: Position,
  bounds: SceneBounds,
): void {
  const pos = world.getComponent(id, 'Position');
  const stats = world.getComponent(id, 'Stats');
  const cd = world.getComponent(id, 'AttackCooldown');
  const pf = world.getComponent(id, 'Pathfinder');
  if (!pos || !stats || !cd || !pf) return;

  const dist = distance(pos, playerPos);
  if (dist > stats.aggroRange) return;

  const fullCooldown = 1000 / Math.max(0.1, stats.atkSpeed);
  const justAttacked = cd.remainingMs > fullCooldown * COCK_RETREAT_COOLDOWN_RATIO;

  if (justAttacked) {
    if (world.hasComponent(id, 'CombatIntent')) world.removeComponent(id, 'CombatIntent');
    setFleeTarget(pf, pos, playerPos, COCK_RETREAT_DISTANCE_PX, bounds);
  } else if (!world.hasComponent(id, 'CombatIntent')) {
    world.addComponent(id, 'CombatIntent', { targetId: playerId });
  }
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function setFleeTarget(
  pf: Components['Pathfinder'],
  selfPos: Position,
  fromPos: Position,
  distancePx: number,
  bounds: SceneBounds,
): void {
  const dx = selfPos.x - fromPos.x;
  const dy = selfPos.y - fromPos.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = selfPos.x + (dx / len) * distancePx;
  const ty = selfPos.y + (dy / len) * distancePx;
  const grid = worldToGrid(tx, ty);
  const gx = clamp(Math.round(grid.x), 0, bounds.width - 1);
  const gy = clamp(Math.round(grid.y), 0, bounds.height - 1);
  if (!pf.targetGrid || pf.targetGrid.gx !== gx || pf.targetGrid.gy !== gy) {
    pf.targetGrid = { gx, gy };
    pf.waypoints = null;
    pf.computing = false;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
