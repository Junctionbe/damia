import type { Container } from 'pixi.js';
import { Graphics } from 'pixi.js';
import type { Entity, System, World } from '@core/ecs';
import { TILE_HALF_H } from '@core/math/iso';
import type { Components } from '@gameplay/components';

const HP_BAR_WIDTH = 44;
const HP_BAR_HEIGHT = 5;
/** Vertical gap between the entity's reference point (tile bottom) and the HP bar. */
const HP_BAR_OFFSET_ABOVE_HEAD = 96;
const TARGET_RING_RADIUS_X = 36;
const TARGET_RING_RADIUS_Y = 16;
const TARGET_RING_COLOR = 0xffd166;

/**
 * In-world entity overlays (FX layer):
 *  - HP bar above any non-player entity that's been damaged (current < max),
 *    auto-hidden once it heals back to full or enters Dying.
 *  - Target ring at the feet of the entity currently held in the player's
 *    `CombatIntent` — yellow iso-diamond as a "you're aiming at this one" cue.
 *
 * Reuses Pixi nodes per entity (HP bar) and a single shared Graphics for the
 * target ring. Cleans up nodes when the entity disappears or the player drops
 * intent.
 */
export class EntityHudSystem implements System<Components> {
  private readonly hpBars = new Map<Entity, Graphics>();
  private readonly targetRing: Graphics;

  constructor(private readonly parent: Container) {
    this.targetRing = new Graphics();
    this.targetRing.visible = false;
    this.parent.addChild(this.targetRing);
  }

  update(_dt: number, world: World<Components>): void {
    // --- HP bars ---------------------------------------------------------
    const matched = new Set<Entity>();
    for (const id of world.query(['Health', 'Position'])) {
      if (world.hasComponent(id, 'Player')) continue;
      if (world.hasComponent(id, 'Dying')) continue;
      // Fog of war: don't paint HP bars for out-of-vision mobs — that would
      // leak combat info from beyond the player's sight.
      if (world.hasComponent(id, 'Hidden')) continue;
      const hp = world.getComponent(id, 'Health');
      const pos = world.getComponent(id, 'Position');
      if (!hp || !pos) continue;
      if (hp.current >= hp.max || hp.current <= 0) continue;

      matched.add(id);
      let bar = this.hpBars.get(id);
      if (!bar) {
        bar = new Graphics();
        this.parent.addChild(bar);
        this.hpBars.set(id, bar);
      }

      const frac = Math.max(0, Math.min(1, hp.current / hp.max));
      bar.clear();
      const x = pos.x - HP_BAR_WIDTH / 2;
      const y = pos.y - HP_BAR_OFFSET_ABOVE_HEAD;
      bar
        .rect(x - 1, y - 1, HP_BAR_WIDTH + 2, HP_BAR_HEIGHT + 2)
        .fill({ color: 0x000000, alpha: 0.7 })
        .rect(x, y, HP_BAR_WIDTH * frac, HP_BAR_HEIGHT)
        .fill(hpColor(frac));
    }

    for (const [id, node] of this.hpBars) {
      if (!matched.has(id)) {
        node.destroy();
        this.hpBars.delete(id);
      }
    }

    // --- Target ring -----------------------------------------------------
    const players = world.query(['Player']);
    const playerId = players[0];
    let ringPos: { x: number; y: number } | null = null;
    if (playerId !== undefined) {
      const intent = world.getComponent(playerId, 'CombatIntent');
      if (intent !== undefined) {
        const tHp = world.getComponent(intent.targetId, 'Health');
        const tPos = world.getComponent(intent.targetId, 'Position');
        if (
          tHp &&
          tPos &&
          tHp.current > 0 &&
          !world.hasComponent(intent.targetId, 'Dying') &&
          !world.hasComponent(intent.targetId, 'Hidden')
        ) {
          ringPos = { x: tPos.x, y: tPos.y };
        }
      }
    }

    if (ringPos) {
      this.targetRing.clear();
      this.targetRing
        .ellipse(0, 0, TARGET_RING_RADIUS_X, TARGET_RING_RADIUS_Y)
        .stroke({ color: TARGET_RING_COLOR, width: 2, alpha: 0.9 });
      this.targetRing.position.set(ringPos.x, ringPos.y + TILE_HALF_H);
      this.targetRing.visible = true;
    } else {
      this.targetRing.visible = false;
    }
  }

  destroy(): void {
    for (const node of this.hpBars.values()) node.destroy();
    this.hpBars.clear();
    this.targetRing.destroy();
  }
}

/** Green → yellow → red interpolation by HP fraction. */
function hpColor(frac: number): number {
  if (frac > 0.6) return 0x4caf50;
  if (frac > 0.3) return 0xffb74d;
  return 0xe53935;
}
