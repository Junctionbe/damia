import type { Container } from 'pixi.js';
import { Graphics } from 'pixi.js';
import type { System, World, Entity } from '@core/ecs';
import { TILE_HALF_H, worldToGrid } from '@core/math/iso';
import type { Components, Sprite as SpriteComp } from '@gameplay/components';
import type { Layers } from '@rendering/Layers';

/**
 * Bridges ECS components → Pixi nodes. The only system that knows about Pixi
 * AND about gameplay components — by design, since rendering is its job.
 */
export class RenderSystem implements System<Components> {
  private readonly nodes = new Map<Entity, Graphics>();

  constructor(private readonly layers: Layers) {}

  update(_dt: number, world: World<Components>): void {
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
      node.position.set(pos.x, pos.y);
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

  private createNode(sprite: SpriteComp): Graphics {
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
