import type { Entity, World } from '@core/ecs';
import { gridToWorld } from '@core/math/iso';
import type { Components, Sprite } from '@gameplay/components';

export type InteractableKind = 'merchant';

interface InteractableDef {
  sprite: Omit<Sprite, 'layer'>;
  defaultMessageKey: string;
}

const INTERACTABLES: Record<InteractableKind, InteractableDef> = {
  merchant: {
    sprite: { shape: 'capsule', color: 0xb88a4a, width: 30, height: 50 },
    defaultMessageKey: 'interactables.merchantComingSoon',
  },
};

export interface SpawnInteractableOptions {
  kind: InteractableKind;
  gx: number;
  gy: number;
  messageKey?: string;
}

export function spawnInteractable(
  world: World<Components>,
  opts: SpawnInteractableOptions,
): Entity {
  const def = INTERACTABLES[opts.kind];
  const { x, y } = gridToWorld(opts.gx, opts.gy);
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Sprite', { ...def.sprite, layer: 'entities' });
  world.addComponent(id, 'Interactable', {
    gx: opts.gx,
    gy: opts.gy,
    messageKey: opts.messageKey ?? def.defaultMessageKey,
  });
  return id;
}
