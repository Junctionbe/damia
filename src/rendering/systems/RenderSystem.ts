import type { Container, Texture } from 'pixi.js';
import { Graphics, Sprite as PixiSprite } from 'pixi.js';
import type { System, World, Entity } from '@core/ecs';
import { TILE_HALF_H, worldToGrid } from '@core/math/iso';
import type { Components, Sprite as SpriteComp } from '@gameplay/components';
import type { Layers } from '@rendering/Layers';
import { AssetManager, type AssetAlias } from '@services/AssetManager';

type RenderNode = Graphics | PixiSprite;

/**
 * Bridges ECS components → Pixi nodes. The only system that knows about Pixi
 * AND about gameplay components — by design, since rendering is its job.
 *
 * Two render paths:
 *  - `Sprite.textureAlias` set → loaded Texture rendered as Pixi.Sprite (M8 mob assets)
 *  - else → procedural Pixi.Graphics from `shape` + `color` (Dart capsule, props)
 */
export class RenderSystem implements System<Components> {
  private readonly nodes = new Map<Entity, RenderNode>();
  /** Accumulated frame time in ms — drives time-based visual effects (walk bob)
   *  in lockstep with the simulation clock so pause / lag spikes don't drift. */
  private elapsedMs = 0;

  constructor(private readonly layers: Layers) {}

  update(dt: number, world: World<Components>): void {
    this.elapsedMs += dt;
    const matched = new Set<Entity>(world.query(['Position', 'Sprite']));

    for (const id of matched) {
      const sprite = world.getComponent(id, 'Sprite');
      const pos = world.getComponent(id, 'Position');
      if (!sprite || !pos) continue;

      let node = this.nodes.get(id);
      if (!node) {
        node = this.createNode(sprite);
        this.layerContainer(sprite.layer).addChild(node);
        this.nodes.set(id, node);
      }

      // Fog-of-war: entities tagged Hidden (out-of-vision mobs in wild zones)
      // render as invisible. We still run the position / animation updates
      // below so the mob re-appears at its CURRENT location the moment it
      // re-enters vision (no stale snapshots from when it was tagged).
      node.visible = !world.hasComponent(id, 'Hidden');

      const swing = world.getComponent(id, 'AttackSwing');
      const addition = world.getComponent(id, 'Addition');
      const spell = world.getComponent(id, 'Spell');
      const defending = world.hasComponent(id, 'Defending');
      const pf = world.getComponent(id, 'Pathfinder');
      const walking =
        !swing && !addition && !spell && !defending && !!pf?.waypoints && pf.waypoints.length > 0;

      // Texture swap priority: Dying > Spell > Addition > Defending > AttackSwing > idle.
      // Walking keeps the idle sprite — only the bob below conveys motion.
      if (node instanceof PixiSprite) {
        const dying = world.hasComponent(id, 'Dying');
        let desiredAlias: AssetAlias | undefined = sprite.textureAlias;
        if (dying && sprite.deathTextureAlias) {
          desiredAlias = sprite.deathTextureAlias;
        } else if (addition && sprite.additionTextureAliases?.length) {
          // Split duration evenly across the frame array. With 2 frames this
          // means: frame 0 for the first half, frame 1 for the second.
          const frames = sprite.additionTextureAliases;
          const t = Math.min(0.999, addition.elapsedMs / addition.totalMs);
          desiredAlias = frames[Math.floor(t * frames.length)];
        } else if (defending && sprite.defendTextureAlias) {
          desiredAlias = sprite.defendTextureAlias;
        } else if (swing && sprite.attackTextureAlias) {
          desiredAlias = sprite.attackTextureAlias;
        }
        if (desiredAlias) {
          const desiredTex = AssetManager.getTexture(desiredAlias);
          if (desiredTex && node.texture !== desiredTex) {
            node.texture = desiredTex;
          }
        }
      }

      // Pixi.Sprite uses base anchor (0.5, 1); Graphics shapes draw baseY internally.
      // Shift textured sprites down by TILE_HALF_H so their feet land on the tile's
      // bottom point — same visual convention as tree/log/roots Graphics shapes.
      const yOffset = node instanceof PixiSprite ? TILE_HALF_H : 0;

      // Lunge offset: forward+return motion during a transient action.
      // Doesn't touch Position so combat / pathfinding stay correct.
      // Spell uses a small "anticipation backstep" early then a forward push
      // around the hit timing — reads as a windup-and-release.
      let swingX = 0;
      let swingY = 0;
      if (spell) {
        const t = Math.min(1, spell.elapsedMs / spell.totalMs);
        // Curve in [-0.4, 1]: small backstep before t=0.5, big forward push after.
        const curve = t < 0.5 ? -0.4 * (t / 0.5) : (t - 0.5) / 0.5;
        const reach = 18;
        swingX = spell.dirX * curve * reach;
        swingY = spell.dirY * curve * reach;
      } else if (addition) {
        const t = Math.min(1, addition.elapsedMs / addition.totalMs);
        // Two-bump curve so the lunge "pulses" once per hit (Double Slash = 2 hits).
        const curve = Math.abs(Math.sin(t * Math.PI * 2));
        const reach = 28;
        swingX = addition.dirX * curve * reach;
        swingY = addition.dirY * curve * reach;
      } else if (swing) {
        const t = Math.min(1, swing.elapsedMs / swing.totalMs);
        const curve = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
        const reach = 22; // px toward target
        swingX = swing.dirX * curve * reach;
        swingY = swing.dirY * curve * reach;
      }

      // Walk bob: rectified sine — sprite "hops" once per step while pathing.
      // Applies generically to any entity with active waypoints (player + mobs).
      // Per-entity phase offset (id * 0.7 rad) desyncs hops so a swarm doesn't bob in lockstep.
      // Driven by `this.elapsedMs` (accumulated dt), not performance.now(), so a paused
      // scene freezes the bob alongside everything else.
      let bobY = 0;
      if (walking) {
        const phase = (this.elapsedMs / 360) * Math.PI + id * 0.7;
        bobY = -Math.abs(Math.sin(phase)) * 5;
      }

      node.position.set(pos.x + swingX, pos.y + yOffset + swingY + bobY);

      // Compute scale every frame: fit textured nodes to the sprite's intended size
      // (otherwise they'd render at native texture resolution), then multiply by
      // sprite.scale (currently always 1 — kept for future hit-flash/knockback fx).
      // `fitMode: 'height'` matches by texture height only so wider poses (e.g. attack
      // sword extension) keep a consistent on-screen character height.
      const scaleMod = sprite.scale ?? 1;
      let fitScale = 1;
      if (node instanceof PixiSprite && node.texture) {
        fitScale =
          sprite.fitMode === 'height'
            ? sprite.height / node.texture.height
            : Math.min(sprite.width / node.texture.width, sprite.height / node.texture.height);
      }
      node.scale.set(fitScale * scaleMod);
      // Iso depth-sort: render lines further away (smaller gx+gy) first.
      const grid = worldToGrid(pos.x, pos.y);
      node.zIndex = Math.round(grid.x + grid.y);
    }

    // Cleanup: remove Pixi nodes for entities that no longer match.
    for (const [id, node] of this.nodes) {
      if (!matched.has(id)) {
        node.destroy();
        this.nodes.delete(id);
      }
    }
  }

  destroy(): void {
    for (const node of this.nodes.values()) node.destroy();
    this.nodes.clear();
  }

  private layerContainer(layer: SpriteComp['layer']): Container {
    switch (layer) {
      case 'ground':
        return this.layers.ground;
      case 'entities':
        return this.layers.entities;
      case 'fx':
        return this.layers.fx;
    }
  }

  private createNode(sprite: SpriteComp): RenderNode {
    if (sprite.textureAlias) {
      const tex = AssetManager.getTexture(sprite.textureAlias);
      if (tex) return this.createTexturedSprite(sprite, tex);
      console.warn(
        `[RenderSystem] missing texture for alias "${sprite.textureAlias}", falling back to shape`,
      );
    }
    return this.createGraphicsShape(sprite);
  }

  /** Build a Pixi.Sprite from a loaded Texture. Size is set every frame in
   *  update() (so DefenseSystem's scale modifier doesn't fight a baked-in size). */
  private createTexturedSprite(_sprite: SpriteComp, tex: Texture): PixiSprite {
    const node = new PixiSprite(tex);
    // Base-anchored (feet at tile bottom point — same convention as tree/log/roots).
    // anchor.y = 1 means the sprite's bottom edge sits at its position; we offset
    // node.y by +TILE_HALF_H elsewhere via Position handling? No, we let RenderSystem
    // place at tile center; subtract half a tile so feet land on tile bottom.
    node.anchor.set(0.5, 1);
    return node;
  }

  private createGraphicsShape(sprite: SpriteComp): Graphics {
    const g = new Graphics();
    const { shape, color, width, height } = sprite;
    const stroke = { width: 2, color: 0x101010, alpha: 0.7 } as const;
    switch (shape) {
      case 'capsule':
        g.roundRect(-width / 2, -height / 2, width, height, width / 2)
          .fill(color)
          .stroke(stroke);
        break;
      case 'circle':
        g.circle(0, 0, width / 2)
          .fill(color)
          .stroke(stroke);
        break;
      case 'diamond':
        g.poly([0, -height / 2, width / 2, 0, 0, height / 2, -width / 2, 0])
          .fill(color)
          .stroke(stroke);
        break;
      case 'tree': {
        // Base-anchored on tile bottom point (y = +TILE_HALF_H from tile center).
        const baseY = TILE_HALF_H;
        const trunkW = width * 0.22;
        const trunkH = height * 0.32;
        g.rect(-trunkW / 2, baseY - trunkH, trunkW, trunkH)
          .fill(0x4a3320)
          .stroke(stroke);
        const foliageBaseY = baseY - trunkH;
        g.poly([-width / 2, foliageBaseY, width / 2, foliageBaseY, 0, foliageBaseY - height * 0.45])
          .fill(color)
          .stroke(stroke);
        g.poly([
          -width * 0.4,
          foliageBaseY - height * 0.3,
          width * 0.4,
          foliageBaseY - height * 0.3,
          0,
          foliageBaseY - height * 0.65,
        ])
          .fill(color)
          .stroke(stroke);
        break;
      }
      case 'rock': {
        const baseY = TILE_HALF_H;
        g.poly([
          -width / 2,
          baseY,
          -width * 0.3,
          baseY - height * 0.7,
          width * 0.1,
          baseY - height * 0.95,
          width * 0.45,
          baseY - height * 0.5,
          width / 2,
          baseY + height * 0.05,
          0,
          baseY + height * 0.2,
        ])
          .fill(color)
          .stroke(stroke);
        break;
      }
      case 'log': {
        const baseY = TILE_HALF_H;
        g.roundRect(-width / 2, baseY - height, width, height, height / 2)
          .fill(color)
          .stroke(stroke);
        g.circle(-width / 2 + height / 2, baseY - height / 2, height / 2.5).stroke({
          width: 2,
          color: 0x301a08,
          alpha: 0.8,
        });
        g.circle(width / 2 - height / 2, baseY - height / 2, height / 2.5).stroke({
          width: 2,
          color: 0x301a08,
          alpha: 0.8,
        });
        break;
      }
      case 'roots': {
        const baseY = TILE_HALF_H;
        g.poly([
          -width / 2,
          baseY,
          -width * 0.35,
          baseY - height * 0.6,
          -width * 0.15,
          baseY - height * 0.2,
          0,
          baseY - height * 0.85,
          width * 0.2,
          baseY - height * 0.35,
          width * 0.4,
          baseY - height * 0.7,
          width / 2,
          baseY,
        ])
          .fill(color)
          .stroke(stroke);
        break;
      }
    }
    return g;
  }
}
