import type { Entity, World } from '@core/ecs';
import { gridToWorld } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import { PROPS, type PropKind } from '@data/props';

export interface SpawnPropOptions {
  kind: PropKind;
  gx: number;
  gy: number;
}

export function spawnProp(world: World<Components>, opts: SpawnPropOptions): Entity {
  const def = PROPS[opts.kind];
  const { x, y } = gridToWorld(opts.gx, opts.gy);
  const id = world.createEntity();

  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Sprite', { ...def.sprite, layer: 'entities' });
  if (def.blocks) {
    world.addComponent(id, 'Collider', { gx: opts.gx, gy: opts.gy, blocks: true });
  }
  return id;
}
