import type { System, World } from '@core/ecs';
import { worldToGrid } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import { computeDamage } from '@data/balance';
import { spawnFloatingText } from '@gameplay/entities/floatingText';
import { playSfx } from '@services/AudioManager';

const TARGET_RECHECK_MS = 100;

/**
 * Drives entities that have CombatIntent:
 * - If target out of range → set Pathfinder to chase (rate-limited refresh).
 * - If target in range → stop moving and attack on cooldown.
 * - Cleans intent if target is dead/destroyed.
 */
export class CombatSystem implements System<Components> {
  private lastTargetRecheckMs = new Map<number, number>();
  private elapsedMs = 0;

  update(dt: number, world: World<Components>): void {
    this.elapsedMs += dt;

    for (const id of world.query(['CombatIntent', 'Stats', 'Position', 'AttackCooldown'])) {
      // Don't fire regular swings while a skill / spell animation is playing —
      // the Addition / Spell pipelines own the attacker for their duration.
      if (world.hasComponent(id, 'Addition')) continue;
      if (world.hasComponent(id, 'Spell')) continue;
      const intent = world.getComponent(id, 'CombatIntent');
      const stats = world.getComponent(id, 'Stats');
      const pos = world.getComponent(id, 'Position');
      const cd = world.getComponent(id, 'AttackCooldown');
      if (!intent || !stats || !pos || !cd) continue;

      const targetHealth = world.getComponent(intent.targetId, 'Health');
      const targetPos = world.getComponent(intent.targetId, 'Position');
      const targetStats = world.getComponent(intent.targetId, 'Stats');

      // Target gone, dead, or playing a death animation.
      if (
        !targetHealth ||
        !targetPos ||
        !targetStats ||
        targetHealth.current <= 0 ||
        world.hasComponent(intent.targetId, 'Dying')
      ) {
        world.removeComponent(id, 'CombatIntent');
        this.lastTargetRecheckMs.delete(id);
        continue;
      }

      const dx = targetPos.x - pos.x;
      const dy = targetPos.y - pos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > stats.range) {
        // Not in range — request a path refresh, throttled to avoid spamming easystar.
        const last = this.lastTargetRecheckMs.get(id) ?? -Infinity;
        if (this.elapsedMs - last >= TARGET_RECHECK_MS) {
          this.lastTargetRecheckMs.set(id, this.elapsedMs);
          const pf = world.getComponent(id, 'Pathfinder');
          if (pf) {
            const grid = worldToGrid(targetPos.x, targetPos.y);
            const tgx = Math.round(grid.x);
            const tgy = Math.round(grid.y);
            if (!pf.targetGrid || pf.targetGrid.gx !== tgx || pf.targetGrid.gy !== tgy) {
              pf.targetGrid = { gx: tgx, gy: tgy };
              pf.waypoints = null;
              pf.computing = false;
            }
          }
        }
        continue;
      }

      // In range — stop and attack on cooldown.
      const pf = world.getComponent(id, 'Pathfinder');
      if (pf) {
        pf.waypoints = null;
        pf.targetGrid = null;
      }

      if (cd.remainingMs > 0) continue;

      const defending = world.hasComponent(intent.targetId, 'Defending');
      const dmg = computeDamage(stats.atk, targetStats.def, Math.random(), defending);
      targetHealth.current = Math.max(0, targetHealth.current - dmg);
      cd.remainingMs = 1000 / Math.max(0.1, stats.atkSpeed);

      spawnFloatingText(world, {
        x: targetPos.x,
        y: targetPos.y,
        text: String(dmg),
        color: defending ? 0x9bb6ff : 0xff6b6b,
      });

      // Visual lunge: store unit-vector toward target so RenderSystem can
      // offset the attacker's sprite forward then back over `totalMs`.
      const len = Math.hypot(dx, dy) || 1;
      world.addComponent(id, 'AttackSwing', {
        elapsedMs: 0,
        totalMs: 220,
        dirX: dx / len,
        dirY: dy / len,
      });

      playSfx('combat.swing');
      playSfx('combat.hit');
    }
  }

  destroy(): void {
    this.lastTargetRecheckMs.clear();
  }
}
