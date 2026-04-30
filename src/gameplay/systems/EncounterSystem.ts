import type { Entity, System, World } from '@core/ecs';
import { TILE_W, gridToWorld, worldToGrid } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import { spawnMob } from '@gameplay/entities/mobs';
import { ENCOUNTERS, pickFormation, type EncounterZoneId } from '@data/encounters';

/** Player-relative spawn ring, in tiles. Tight enough that the encounter feels
 *  immediate — mobs reach the player in a few steps and aggro instantly
 *  (CombatIntent is granted at spawn, no aggroRange detection needed). */
const SPAWN_RING_TILES_MIN = 3;
const SPAWN_RING_TILES_MAX = 5;
/** How many tile candidates to try before giving up on a spawn for this tick. */
const SPAWN_CANDIDATES = 24;

/**
 * Random-encounter pacing for an action-RPG. Adapts the TLoD field-meter to
 * real-time: walking accumulates progress; reaching 100% rolls a group of mobs
 * from the zone pool and spawns them just outside the camera. The meter does
 * NOT fill while the player is in active combat (any enemy holds a CombatIntent
 * targeting the player) so chained fights don't insta-respawn waves.
 *
 * Spawn placement avoids cells the player can see and prefers walkable cells
 * the AI can pathfind from. If no usable cell is found this tick, the meter
 * stays full and we retry next frame (player just needs to take a step).
 */
export class EncounterSystem implements System<Components> {
  private prevPos: { x: number; y: number } | null = null;
  private accumulatedPx = 0;

  constructor(
    private readonly zoneId: EncounterZoneId,
    private readonly mapSize: { width: number; height: number },
    private readonly isCellWalkable: (gx: number, gy: number) => boolean,
    private readonly registerSpawn: (entity: Entity, kind: Parameters<typeof spawnMob>[1]) => void,
  ) {}

  /** [0, 1] fraction read by the HUD. */
  fraction(): number {
    return this.accumulatedPx / ENCOUNTERS[this.zoneId].pxPerEncounter;
  }

  update(_dt: number, world: World<Components>): void {
    const players = world.query(['Player', 'Position']);
    const playerId = players[0];
    if (playerId === undefined) {
      this.prevPos = null;
      return;
    }
    const pos = world.getComponent(playerId, 'Position');
    if (!pos) return;

    // Track distance walked since last frame.
    if (this.prevPos) {
      const dx = pos.x - this.prevPos.x;
      const dy = pos.y - this.prevPos.y;
      const stepPx = Math.hypot(dx, dy);
      // Cap per-frame contribution: a teleport / scene-load shouldn't blow the meter.
      const safeStep = Math.min(stepPx, TILE_W);
      if (!this.isInCombat(world, playerId) && !world.hasComponent(playerId, 'Dying')) {
        this.accumulatedPx += safeStep;
      }
    }
    this.prevPos = { x: pos.x, y: pos.y };

    const zone = ENCOUNTERS[this.zoneId];
    if (this.accumulatedPx < zone.pxPerEncounter) return;

    // Cap reached. Check if we're under the simultaneous-mob cap.
    const liveRandomMobs = this.countRandomMobs(world);
    if (liveRandomMobs >= zone.maxConcurrentRandomMobs) {
      // Hold the meter full; don't reset until we actually spawn.
      this.accumulatedPx = zone.pxPerEncounter;
      return;
    }

    const spawned = this.tryTriggerEncounter(world, playerId, pos.x, pos.y);
    if (spawned > 0) {
      this.accumulatedPx = 0;
    } else {
      // Keep the meter pinned; player needs to move to a spawnable spot.
      this.accumulatedPx = zone.pxPerEncounter;
    }
  }

  private isInCombat(world: World<Components>, playerId: Entity): boolean {
    for (const id of world.query(['CombatIntent'])) {
      const intent = world.getComponent(id, 'CombatIntent');
      if (intent && intent.targetId === playerId) return true;
    }
    return false;
  }

  private countRandomMobs(world: World<Components>): number {
    let n = 0;
    for (const _ of world.query(['RandomEncounter'])) n++;
    return n;
  }

  private tryTriggerEncounter(
    world: World<Components>,
    playerId: Entity,
    px: number,
    py: number,
  ): number {
    const zone = ENCOUNTERS[this.zoneId];
    const formation = pickFormation(zone, Math.random());
    const cap = zone.maxConcurrentRandomMobs - this.countRandomMobs(world);
    const wantSpawn = Math.min(formation.mobs.length, cap);
    if (wantSpawn <= 0) return 0;

    let actuallySpawned = 0;
    for (let i = 0; i < wantSpawn; i++) {
      const kind = formation.mobs[i]!;
      const cell = this.findSpawnCell(world, px, py);
      if (!cell) break;
      const mob = spawnMob(world, kind, cell.gx, cell.gy);
      world.addComponent(mob, 'RandomEncounter', {});
      // Aggro the player immediately — random encounters shouldn't have a
      // "wander into aggroRange" delay; the meter trigger is the encounter.
      world.addComponent(mob, 'CombatIntent', { targetId: playerId });
      this.registerSpawn(mob, kind);
      actuallySpawned++;
    }
    return actuallySpawned;
  }

  /**
   * Pick a walkable cell within a ring around the player. Player-relative (not
   * camera-relative) so encounters follow the player whether or not camera-
   * follow is on. Tries random angles + radii in the ring; returns null if no
   * candidate is inside the map AND walkable AND not stacked on an entity.
   */
  private findSpawnCell(
    world: World<Components>,
    px: number,
    py: number,
  ): { gx: number; gy: number } | null {
    for (let i = 0; i < SPAWN_CANDIDATES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radiusTiles =
        SPAWN_RING_TILES_MIN + Math.random() * (SPAWN_RING_TILES_MAX - SPAWN_RING_TILES_MIN);
      const radiusPx = radiusTiles * TILE_W;
      const wx = px + Math.cos(angle) * radiusPx;
      const wy = py + Math.sin(angle) * radiusPx;
      const grid = worldToGrid(wx, wy);
      const gx = Math.round(grid.x);
      const gy = Math.round(grid.y);
      if (gx < 0 || gy < 0 || gx >= this.mapSize.width || gy >= this.mapSize.height) continue;
      if (!this.isCellWalkable(gx, gy)) continue;
      if (this.cellOccupied(world, gx, gy)) continue;
      return { gx, gy };
    }
    return null;
  }

  private cellOccupied(world: World<Components>, gx: number, gy: number): boolean {
    const target = gridToWorld(gx, gy);
    for (const id of world.query(['Position', 'Health'])) {
      const p = world.getComponent(id, 'Position');
      if (!p) continue;
      if (Math.abs(p.x - target.x) < 1 && Math.abs(p.y - target.y) < 1) return true;
    }
    return false;
  }
}
