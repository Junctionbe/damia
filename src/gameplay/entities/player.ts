import { gridToWorld } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import type { Entity, World } from '@core/ecs';
import { PLAYER_BASE } from '@data/balance';
import { getDartStatsAtLevel } from '@data/dart';
import { xpThresholdForLevel } from '@data/progression';

export interface SpawnPlayerOptions {
  gx: number;
  gy: number;
  /** Override starting HP (clamped to max). Defaults to PLAYER_BASE.health. */
  hp?: number;
}

export function spawnPlayer(world: World<Components>, opts: SpawnPlayerOptions): Entity {
  const { x, y } = gridToWorld(opts.gx, opts.gy);
  const id = world.createEntity();
  // Pull Dart's TLoD-canonical level-1 row for HP / AT / DF / MAT / MDF.
  // PLAYER_BASE keeps the action-RPG-only fields (atkSpeed / range / aggroRange /
  // hit/avoid percentages / SPEED scalar) — they're not in the per-level table.
  const lvl1 = getDartStatsAtLevel(1);
  const max = lvl1.hp;
  const startHp = Math.max(1, Math.min(max, opts.hp ?? max));

  world.addComponent(id, 'Player', {});
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Speed', { value: PLAYER_BASE.speed });
  world.addComponent(id, 'Pathfinder', {
    targetGrid: null,
    waypoints: null,
    computing: false,
  });
  // Dart sprite uses the M8 textureAlias pipeline (rendered as Pixi.Sprite from
  // the loaded texture, base-anchored on the tile bottom point). Shape/color
  // here are the fallback if the texture failed to load.
  world.addComponent(id, 'Sprite', {
    shape: 'capsule',
    color: 0xc8201f,
    width: 54,
    height: 81,
    layer: 'entities',
    fitMode: 'height',
    textureAlias: 'sprite.player.dart',
    attackTextureAlias: 'sprite.player.dart.attack',
    defendTextureAlias: 'sprite.player.dart.defend',
    // Double Slash: 1st hit = regular attack pose, 2nd hit = dedicated sprite.
    // RenderSystem swaps frames by progress fraction (0-50% = frame 0, 50-100% = frame 1).
    additionTextureAliases: ['sprite.player.dart.attack', 'sprite.player.dart.doubleSlash.2'],
  });
  world.addComponent(id, 'Health', {
    current: startHp,
    max,
  });
  world.addComponent(id, 'Stats', {
    ...PLAYER_BASE.stats,
    atk: lvl1.atk,
    def: lvl1.def,
    magicAtk: lvl1.magicAtk,
    magicDef: lvl1.magicDef,
  });
  world.addComponent(id, 'Faction', { side: 'player' });
  world.addComponent(id, 'AttackCooldown', { remainingMs: 0 });
  world.addComponent(id, 'SkillCooldown', { remainingMs: {} });
  world.addComponent(id, 'Inventory', { items: {}, gold: 0 });
  // xpToNext = cumulative XP threshold to reach LV 2 (= 20 for Dart).
  world.addComponent(id, 'Progression', {
    level: 1,
    xp: 0,
    xpToNext: xpThresholdForLevel(2),
  });

  return id;
}
