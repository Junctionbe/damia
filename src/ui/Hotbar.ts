import type { Application } from 'pixi.js';
import { Container, Graphics, Text } from 'pixi.js';
import { ADDITIONS, type AdditionKind } from '@data/balance';
import { ITEMS, type ItemKind } from '@data/items';
import { t } from '@services/I18nService';
import { paintAdditionSlot, paintItemSlot } from './slot';
import { Tooltip } from './Tooltip';

export const HOTBAR_SLOT_COUNT = 8;
const SLOT_SIZE = 48;
const SLOT_GAP = 6;
const PADDING_BOTTOM = 16;

export type HotbarSlot =
  | { kind: 'addition'; addition: AdditionKind }
  | { kind: 'item'; item: ItemKind }
  | null;

export interface HotbarState {
  /** Length-`HOTBAR_SLOT_COUNT` array. Use `null` for empty slots. */
  slots: ReadonlyArray<HotbarSlot>;
  /** AdditionKind → cooldown fraction in [0, 1]. 1 = just triggered, 0 = ready. */
  additionCooldowns: Partial<Record<AdditionKind, number>>;
  /** ItemKind → owned count (so the slot can show the badge). */
  itemCounts: Partial<Record<ItemKind, number>>;
}

/**
 * Centered bottom hotbar — 8 slots labeled 1..8. Pure renderer: takes a state
 * object each frame and repaints content (binding tag/icon, cooldown radial,
 * item count badge). The static layer (slot frames + key labels) is drawn once.
 *
 * Bindings live in the scene; this class doesn't own them so save/load can
 * persist them at the gameplay layer.
 */
export class Hotbar {
  readonly container: Container;
  private app: Application;
  /** Per-slot dynamic content container — cleared and repainted each frame. */
  private readonly slotContents: Container[] = [];
  /** Hover tooltip — single shared instance, hidden by default. */
  private readonly tooltip: Tooltip;
  /** Latest state passed to setState — read by hover handlers to format the tooltip. */
  private lastState: HotbarState | null = null;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container({ label: 'hotbar' });

    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
      const x = i * (SLOT_SIZE + SLOT_GAP);
      const slot = new Graphics()
        .roundRect(x, 0, SLOT_SIZE, SLOT_SIZE, 5)
        .fill({ color: 0x101010, alpha: 0.7 })
        .stroke({ width: 1, color: 0x806040, alpha: 0.8 });
      // Make the slot frame interactive for hover tooltips.
      slot.eventMode = 'static';
      slot.cursor = 'help';
      slot.on('pointerover', () => this.showTooltipFor(i));
      slot.on('pointerout', () => this.hideTooltip());
      const label = new Text({
        text: String(i + 1),
        style: { fontFamily: 'system-ui, sans-serif', fontSize: 11, fill: 0xa08050 },
      });
      label.position.set(x + 4, 3);
      const content = new Container();
      content.position.set(x, 0);
      this.container.addChild(slot, label, content);
      this.slotContents.push(content);
    }

    // Tooltip — added LAST so it draws above the slot frames.
    this.tooltip = new Tooltip();
    this.container.addChild(this.tooltip.node);

    this.reposition();
    app.renderer.on('resize', () => this.reposition());
  }

  private showTooltipFor(slotIdx: number): void {
    const slot = this.lastState?.slots[slotIdx] ?? null;
    if (!slot) {
      this.tooltip.hide();
      return;
    }
    this.tooltip.setText(this.formatTooltip(slot));
    const slotCenterX = slotIdx * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
    this.tooltip.showAbove(slotCenterX, 0);
  }

  private hideTooltip(): void {
    this.tooltip.hide();
  }

  private formatTooltip(slot: HotbarSlot): string {
    if (!slot) return '';
    if (slot.kind === 'addition') {
      const def = ADDITIONS[slot.addition];
      const name = t(`additions.${slot.addition}`) || def.name;
      const desc = t(`additions.${slot.addition}.desc`);
      return `${name}\n${desc}`;
    }
    const def = ITEMS[slot.item];
    const count = this.lastState?.itemCounts[slot.item] ?? 0;
    const name = t(def.nameKey);
    const desc = t(`items.${slot.item}.desc`);
    return `${name} (×${count})\n${desc}`;
  }

  /** Full repaint of dynamic content — call once per frame from the scene. */
  setState(state: HotbarState): void {
    this.lastState = state;
    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
      const slot = state.slots[i] ?? null;
      const container = this.slotContents[i];
      if (!container) continue;
      if (!slot) {
        container.removeChildren().forEach((c) => c.destroy());
        continue;
      }
      if (slot.kind === 'addition') {
        paintAdditionSlot(container, slot.addition, {
          size: SLOT_SIZE,
          cooldownFrac: state.additionCooldowns[slot.addition] ?? 0,
        });
      } else {
        paintItemSlot(container, slot.item, {
          size: SLOT_SIZE,
          count: state.itemCounts[slot.item] ?? 0,
        });
      }
    }
  }

  destroy(): void {
    this.slotContents.length = 0;
    this.container.destroy({ children: true });
  }

  private reposition(): void {
    const totalWidth = HOTBAR_SLOT_COUNT * SLOT_SIZE + (HOTBAR_SLOT_COUNT - 1) * SLOT_GAP;
    this.container.position.set(
      (this.app.screen.width - totalWidth) / 2,
      this.app.screen.height - SLOT_SIZE - PADDING_BOTTOM,
    );
  }
}
