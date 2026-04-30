import type { Container} from 'pixi.js';
import { Graphics, Sprite as PixiSprite, Text } from 'pixi.js';
import { ADDITIONS, type AdditionKind } from '@data/balance';
import { ITEMS, type ItemKind } from '@data/items';
import { AssetManager } from '@services/AssetManager';

/**
 * Shared slot painters used by Hotbar / AdditionsBar / InventoryPanel. The
 * caller passes a Container, the painter wipes its children and rebuilds the
 * slot's content. Slot frames + interactivity remain the caller's job — these
 * helpers just draw the inner visuals.
 */

export interface SlotPaintOpts {
  size: number;
  /** Optional [0, 1] cooldown overlay (1 = just triggered, 0 = ready). Painted as a bottom-up dim rect. */
  cooldownFrac?: number;
  /** Optional count badge (anchored bottom-right). */
  count?: number;
  /** Visual "selected" style — gold border etc. Caller is responsible for the slot's outer frame; this only impacts drawn-on-top flair. */
  selected?: boolean;
}

/** Paint an item-slot's content (icon or color circle + count badge + optional cooldown). */
export function paintItemSlot(container: Container, kind: ItemKind, opts: SlotPaintOpts): void {
  container.removeChildren().forEach((c) => c.destroy());
  const def = ITEMS[kind];
  const tex = def.iconAlias ? AssetManager.getTexture(def.iconAlias) : null;
  if (tex) {
    const icon = new PixiSprite(tex);
    const fit = Math.min((opts.size - 8) / tex.width, (opts.size - 8) / tex.height);
    icon.scale.set(fit);
    icon.anchor.set(0.5);
    icon.position.set(opts.size / 2, opts.size / 2 + 1);
    container.addChild(icon);
  } else {
    container.addChild(
      new Graphics()
        .circle(opts.size / 2, opts.size / 2 + 1, 12)
        .fill(def.sprite.color)
        .stroke({ color: 0x101010, width: 1, alpha: 0.8 }),
    );
  }

  if (opts.count !== undefined) {
    const countText = new Text({
      text: String(opts.count),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        fill: opts.count > 0 ? 0xffffff : 0x808080,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 },
      },
    });
    countText.anchor.set(1, 1);
    countText.position.set(opts.size - 3, opts.size - 1);
    container.addChild(countText);
  }

  if (opts.cooldownFrac !== undefined && opts.cooldownFrac > 0) {
    container.addChild(
      new Graphics()
        .rect(0, opts.size * (1 - opts.cooldownFrac), opts.size, opts.size * opts.cooldownFrac)
        .fill({ color: 0x000000, alpha: 0.55 }),
    );
  }
}

/** Paint an addition-slot's content (initials tag + optional cooldown). */
export function paintAdditionSlot(
  container: Container,
  kind: AdditionKind,
  opts: SlotPaintOpts,
): void {
  container.removeChildren().forEach((c) => c.destroy());
  const tag = new Text({
    text: ADDITIONS[kind].name
      .split(' ')
      .map((w) => w[0])
      .join(''),
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 18,
      fill: 0xe8d8a0,
      fontWeight: 'bold',
    },
  });
  tag.anchor.set(0.5);
  tag.position.set(opts.size / 2, opts.size / 2 + 1);
  container.addChild(tag);

  if (opts.cooldownFrac !== undefined && opts.cooldownFrac > 0) {
    container.addChild(
      new Graphics()
        .rect(0, opts.size * (1 - opts.cooldownFrac), opts.size, opts.size * opts.cooldownFrac)
        .fill({ color: 0x000000, alpha: 0.55 }),
    );
  }
}

/** Paint a slot frame (bg + border). Caller positions the container and adds the painted frame as a child. */
export function paintSlotFrame(g: Graphics, size: number, selected = false): Graphics {
  return g
    .clear()
    .roundRect(0, 0, size, size, 4)
    .fill({ color: 0x101010, alpha: 0.7 })
    .stroke({
      color: selected ? 0xeec040 : 0x806040,
      width: selected ? 2 : 1,
      alpha: selected ? 1 : 0.7,
    });
}
