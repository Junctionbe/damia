import type { System, World } from '@core/ecs';
import type { Components } from '@gameplay/components';
import { spawnFloatingText } from '@gameplay/entities/floatingText';
import { spawnItem } from '@gameplay/entities/items';
import { MOBS, type MobKind } from '@data/balance';
import { rollLoot } from '@data/items';
import { DART_XP_TO_REACH_LEVEL, applyDartRow } from '@data/dart';
import { xpThresholdForLevel } from '@data/progression';
import { playSfx } from '@services/AudioManager';

export type PlayerDeathListener = () => void;

/**
 * Sweeps entities at or below 0 HP. Players trigger Game Over (via listener).
 * Other entities are destroyed and yield XP + a chance for a loot drop.
 *
 * `mobKindResolver` is provided by the scene so we know what XP value / loot
 * table to use per mob.
 */
export class DeathSystem implements System<Components> {
  private listener: PlayerDeathListener | null = null;
  private playerDeathFired = false;

  constructor(private readonly mobKindResolver?: (id: number) => MobKind | null) {}

  onPlayerDeath(listener: PlayerDeathListener): void {
    this.listener = listener;
  }

  update(_dt: number, world: World<Components>): void {
    for (const id of world.query(['Health'])) {
      const hp = world.getComponent(id, 'Health');
      if (!hp || hp.current > 0) continue;

      if (world.hasComponent(id, 'Player')) {
        if (!this.playerDeathFired) {
          this.playerDeathFired = true;
          this.listener?.();
        }
        continue;
      }

      // Skip entities already converted to a Dying state (DyingSystem owns them).
      if (world.hasComponent(id, 'Dying')) continue;

      const pos = world.getComponent(id, 'Position');
      const mobKind = this.mobKindResolver?.(id) ?? null;
      if (pos && mobKind) {
        const xp = MOBS[mobKind].xp;
        if (xp > 0) {
          spawnFloatingText(world, {
            x: pos.x,
            y: pos.y,
            text: `+${xp} XP`,
            color: 0xffe27a,
            durationMs: 1100,
          });
          this.awardXp(world, xp, pos.x, pos.y);
        }
        const loot = rollLoot(Math.random(), Math.random());
        if (loot) {
          spawnItem(world, loot, pos.x, pos.y);
        }
      }
      playSfx('combat.death');

      // If the mob has a death sprite, defer destruction so the death-pose
      // texture lingers — DyingSystem cleans it up after the timer. Freeze the
      // entity by stripping anything that would still drive it (AI / pathing /
      // swing / pending intents) and zeroing velocity.
      const sprite = world.getComponent(id, 'Sprite');
      if (sprite?.deathTextureAlias) {
        if (world.hasComponent(id, 'AI')) world.removeComponent(id, 'AI');
        if (world.hasComponent(id, 'Pathfinder')) world.removeComponent(id, 'Pathfinder');
        if (world.hasComponent(id, 'CombatIntent')) world.removeComponent(id, 'CombatIntent');
        if (world.hasComponent(id, 'AttackSwing')) world.removeComponent(id, 'AttackSwing');
        if (world.hasComponent(id, 'Defending')) world.removeComponent(id, 'Defending');
        world.addComponent(id, 'Dying', { elapsedMs: 0, totalMs: 700 });
        continue;
      }

      world.destroyEntity(id);
    }
  }

  destroy(): void {
    this.listener = null;
    this.playerDeathFired = false;
  }

  /**
   * Add XP to the player's Progression and consume as many level-ups as the
   * total covers. Level-up: full HP heal (TLoD convention) + floating text.
   * No-op if there's no player or no Progression.
   */
  private awardXp(world: World<Components>, xp: number, mobX: number, mobY: number): void {
    const players = world.query(['Player', 'Progression']);
    const playerId = players[0];
    if (playerId === undefined) return;
    const prog = world.getComponent(playerId, 'Progression');
    if (!prog) return;
    prog.xp += xp;
    const cap = DART_XP_TO_REACH_LEVEL.length; // 60
    // TLoD model: xp accumulates lifelong. We level up while the cumulative
    // counter crosses the threshold for the next level. xpToNext stays the
    // cumulative threshold (NOT a delta).
    while (prog.level < cap && prog.xp >= prog.xpToNext) {
      prog.level += 1;
      prog.xpToNext = xpThresholdForLevel(prog.level + 1);
      const stats = world.getComponent(playerId, 'Stats');
      const hp = world.getComponent(playerId, 'Health');
      applyDartRow(stats, hp, prog.level, false);
      // Full heal on level up — match TLoD's level-up behavior.
      if (hp) hp.current = hp.max;
      spawnFloatingText(world, {
        x: mobX,
        y: mobY - 30,
        text: `LV ${prog.level}!`,
        color: 0xffd166,
        durationMs: 1400,
      });
      playSfx('items.pickup');
    }
  }
}
