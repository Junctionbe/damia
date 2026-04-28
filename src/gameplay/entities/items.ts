import type { Entity, World } from '@core/ecs';
import type { Components } from '@gameplay/components';
import { itemSpriteComponent, type ItemKind } from '@data/items';

export function spawnItem(
  world: World<Components>,
  kind: ItemKind,
  worldX: number,
  worldY: number,
): Entity {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x: worldX, y: worldY });
  // Items live on the fx layer so they sit above the ground checker but below mobs.
  world.addComponent(id, 'Sprite', itemSpriteComponent(kind, 'fx'));
  world.addComponent(id, 'Item', { kind });
  return id;
}
