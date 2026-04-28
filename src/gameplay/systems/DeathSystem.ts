import type { System, World } from '@core/ecs';
import type { Components } from '@gameplay/components';
import { spawnFloatingText } from '@gameplay/entities/floatingText';
import { spawnItem } from '@gameplay/entities/items';
import { MOBS, type MobKind } from '@data/balance';
import { rollLoot } from '@data/items';

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
        }
        const loot = rollLoot(Math.random(), Math.random());
        if (loot) {
          spawnItem(world, loot, pos.x, pos.y);
        }
      }
      world.destroyEntity(id);
    }
  }

  destroy(): void {
    this.listener = null;
    this.playerDeathFired = false;
  }
}
