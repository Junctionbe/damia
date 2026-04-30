import type { Application, FederatedPointerEvent } from 'pixi.js';
import { Container, Graphics, Sprite as PixiSprite, Text } from 'pixi.js';
import { ITEMS, type ItemKind } from '@data/items';
import { AssetManager } from '@services/AssetManager';
import { t } from '@services/I18nService';
import { type HotbarSlot, HOTBAR_SLOT_COUNT } from './Hotbar';
import { paintAdditionSlot, paintItemSlot, paintSlotFrame } from './slot';
import { Tooltip } from './Tooltip';

const COLS = 8;
const ROWS = 4;
const SLOT_SIZE = 48;
const SLOT_GAP = 6;
const PADDING = 16;
const HEADER_HEIGHT = 36;
const HOTBAR_LABEL_HEIGHT = 24;
const HINT_HEIGHT = 22;
const PANEL_WIDTH = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP + PADDING * 2;
const PANEL_HEIGHT =
  HEADER_HEIGHT +
  ROWS * SLOT_SIZE +
  (ROWS - 1) * SLOT_GAP +
  HOTBAR_LABEL_HEIGHT +
  SLOT_SIZE +
  HINT_HEIGHT +
  PADDING * 4;

export interface InventoryPanelState {
  /** Item count by kind. Insertion order is preserved (Object.keys). */
  items: Partial<Record<ItemKind, number>>;
  gold: number;
  hotbarSlots: ReadonlyArray<HotbarSlot>;
}

export interface InventoryPanelCallbacks {
  /** Player asked to bind `kind` to hotbar `slotIdx`. Replaces any existing binding. */
  onBind: (kind: ItemKind, slotIdx: number) => void;
  /** Player asked to consume one of `kind` (heal / cast spell). */
  onUse: (kind: ItemKind) => void;
  /** Player asked to drop one `kind` on the ground. */
  onDrop: (kind: ItemKind) => void;
}

/**
 * Modal inventory panel. Toggled by ForestScene on key `I`, with the world
 * paused while open (same pattern as SettingsPanel). Layout:
 *  - Header with title + gold counter.
 *  - 8x4 grid of slots, one per ItemKind owned (insertion order).
 *  - Mini-hotbar (8 slots) so drag-from-inventory drops land inside the modal.
 *  - Hint bar with control reminders.
 *
 * Interactions:
 *  - Hover: tooltip with name + description + count.
 *  - Click on item slot: select (gold border).
 *  - Drag from inventory slot to a mini-hotbar slot: bind.
 *  - Right-click on item slot: use.
 *  - Keyboard `1`..`8` while item selected: bind to that slot.
 *  - Keyboard `D` while item selected: drop.
 *  - Esc / I: close (handled by the scene's input).
 */
export class InventoryPanel {
  readonly container: Container;
  isOpen = false;
  private app: Application;
  private callbacks: InventoryPanelCallbacks | null = null;
  private state: InventoryPanelState = { items: {}, gold: 0, hotbarSlots: [] };

  // Layered Containers we rebuild each `setState`:
  private readonly overlay: Graphics; // full-screen dim
  private readonly panel: Container; // centered card
  private readonly grid: Container; // 8x4 inventory slots
  private readonly hotbarMini: Container; // 8-slot hotbar mirror inside the modal
  private readonly tooltip: Tooltip;
  private readonly goldText: Text;
  private readonly hintText: Text;

  // Drag-and-drop state.
  private drag: {
    kind: ItemKind;
    ghost: Container;
  } | null = null;
  /** Item kind selected via left-click (highlighted gold border). */
  private selectedKind: ItemKind | null = null;
  /** Per-mini-hotbar-slot Container so the drop hit-test can compare rects. */
  private readonly miniHotbarSlots: Container[] = [];

  constructor(app: Application) {
    this.app = app;
    this.container = new Container({ label: 'inventory-panel' });
    this.container.visible = false;
    this.container.eventMode = 'static';

    this.overlay = new Graphics();
    this.container.addChild(this.overlay);

    this.panel = new Container({ label: 'inventory-card' });
    this.container.addChild(this.panel);

    // Card background painted once on resize/build.
    const panelBg = new Graphics()
      .roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8)
      .fill({ color: 0x101010, alpha: 0.95 })
      .stroke({ color: 0xa08050, width: 2, alpha: 0.85 });
    this.panel.addChild(panelBg);

    const titleText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 20,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
      },
    });
    titleText.position.set(PADDING, PADDING);
    this.panel.addChild(titleText);

    this.goldText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 16,
        fill: 0xeec040,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 },
      },
    });
    this.goldText.anchor.set(1, 0);
    this.goldText.position.set(PANEL_WIDTH - PADDING, PADDING + 2);
    this.panel.addChild(this.goldText);

    // Inventory grid container — populated each setState.
    this.grid = new Container();
    this.grid.position.set(PADDING, PADDING + HEADER_HEIGHT);
    this.panel.addChild(this.grid);

    const gridHeightPx = ROWS * SLOT_SIZE + (ROWS - 1) * SLOT_GAP;
    const hotbarLabelY = PADDING + HEADER_HEIGHT + gridHeightPx + PADDING;
    const hotbarLabel = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fill: 0xc8b58a,
        fontStyle: 'italic',
      },
    });
    hotbarLabel.position.set(PADDING, hotbarLabelY);
    this.panel.addChild(hotbarLabel);

    this.hotbarMini = new Container();
    this.hotbarMini.position.set(PADDING, hotbarLabelY + HOTBAR_LABEL_HEIGHT);
    this.panel.addChild(this.hotbarMini);

    const hintY = hotbarLabelY + HOTBAR_LABEL_HEIGHT + SLOT_SIZE + PADDING;
    this.hintText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 11,
        fill: 0x806040,
      },
    });
    this.hintText.position.set(PADDING, hintY);
    this.panel.addChild(this.hintText);

    // Tooltip layer (above panel, below drag ghost).
    this.tooltip = new Tooltip();
    this.container.addChild(this.tooltip.node);

    // Cache i18n once so we don't t() every frame.
    titleText.text = t('inventory.title');
    hotbarLabel.text = t('inventory.hotbarLabel');
    this.hintText.text = t('inventory.hint');

    this.reposition();
    app.renderer.on('resize', () => this.reposition());

    // Mouse-up anywhere ends an in-flight drag.
    this.container.on('pointerup', (e) => this.endDrag(e));
    this.container.on('pointerupoutside', (e) => this.endDrag(e));
    this.container.on('pointermove', (e) => this.moveDrag(e));
  }

  /** Wire scene-side handlers for bind / use / drop. Call once on construction. */
  setCallbacks(cb: InventoryPanelCallbacks): void {
    this.callbacks = cb;
  }

  /** Returns the currently-selected item kind (set via left-click). */
  getSelectedKind(): ItemKind | null {
    return this.selectedKind;
  }

  open(state: InventoryPanelState): void {
    this.isOpen = true;
    this.container.visible = true;
    this.setState(state);
  }

  close(): void {
    this.isOpen = false;
    this.container.visible = false;
    this.cancelDrag();
    this.selectedKind = null;
    this.tooltip.hide();
  }

  /** Refresh the grid + mini-hotbar + gold from a fresh state snapshot. */
  setState(state: InventoryPanelState): void {
    this.state = state;
    this.goldText.text = `${state.gold} G`;
    this.rebuildGrid();
    this.rebuildHotbarMini();
  }

  destroy(): void {
    this.cancelDrag();
    this.container.destroy({ children: true });
  }

  // ---- internal ----

  private reposition(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.overlay.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.65 });
    this.panel.position.set((w - PANEL_WIDTH) / 2, (h - PANEL_HEIGHT) / 2);
  }

  private rebuildGrid(): void {
    this.grid.removeChildren().forEach((c) => c.destroy());

    const kinds = (Object.keys(this.state.items) as ItemKind[]).filter(
      (k) => (this.state.items[k] ?? 0) > 0,
    );

    for (let i = 0; i < COLS * ROWS; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * (SLOT_SIZE + SLOT_GAP);
      const y = row * (SLOT_SIZE + SLOT_GAP);

      const slot = new Container();
      slot.position.set(x, y);
      slot.eventMode = 'static';

      const kind = kinds[i] ?? null;
      const isSelected = kind !== null && kind === this.selectedKind;

      slot.addChild(paintSlotFrame(new Graphics(), SLOT_SIZE, isSelected));

      if (kind) {
        const content = new Container();
        slot.addChild(content);
        paintItemSlot(content, kind, {
          size: SLOT_SIZE,
          count: this.state.items[kind] ?? 0,
        });

        slot.cursor = 'grab';
        slot.on('pointerover', () => this.showTooltipAtSlot(slot, kind));
        slot.on('pointerout', () => this.hideTooltip());
        slot.on('pointerdown', (e) => this.onSlotPointerDown(e, kind));
        slot.on('rightclick', () => this.callbacks?.onUse(kind));
      } else {
        slot.cursor = 'default';
      }

      this.grid.addChild(slot);
    }
  }

  private rebuildHotbarMini(): void {
    this.hotbarMini.removeChildren().forEach((c) => c.destroy());
    this.miniHotbarSlots.length = 0;

    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
      const x = i * (SLOT_SIZE + SLOT_GAP);
      const slot = new Container();
      slot.position.set(x, 0);
      slot.eventMode = 'static';
      slot.cursor = 'pointer';

      slot.addChild(paintSlotFrame(new Graphics(), SLOT_SIZE, false));

      const label = new Text({
        text: String(i + 1),
        style: { fontFamily: 'system-ui, sans-serif', fontSize: 11, fill: 0xa08050 },
      });
      label.position.set(4, 3);
      slot.addChild(label);

      const binding = this.state.hotbarSlots[i] ?? null;
      if (binding) {
        const content = new Container();
        slot.addChild(content);
        if (binding.kind === 'addition') {
          paintAdditionSlot(content, binding.addition, { size: SLOT_SIZE });
        } else {
          paintItemSlot(content, binding.item, { size: SLOT_SIZE });
        }
      }

      this.hotbarMini.addChild(slot);
      this.miniHotbarSlots.push(slot);
    }
  }

  private showTooltipAtSlot(slotContainer: Container, kind: ItemKind): void {
    const def = ITEMS[kind];
    const count = this.state.items[kind] ?? 0;
    const name = t(def.nameKey);
    const desc = t(`items.${kind}.desc`);
    this.tooltip.setText(`${name} (×${count})\n${desc}`);
    // Resolve absolute position of the slot in the screen-space container.
    const global = slotContainer.getGlobalPosition();
    const local = this.container.toLocal(global);
    this.tooltip.showAbove(local.x + SLOT_SIZE / 2, local.y, 4);
  }

  private hideTooltip(): void {
    this.tooltip.hide();
  }

  private onSlotPointerDown(e: FederatedPointerEvent, kind: ItemKind): void {
    if (e.button === 2) {
      // Right-click goes to onUse via the rightclick handler — no drag.
      return;
    }
    // Left-click selects + starts a drag.
    this.selectedKind = kind;
    this.startDrag(kind, e);
    this.rebuildGrid(); // re-render with the new selection highlight
  }

  private startDrag(kind: ItemKind, e: FederatedPointerEvent): void {
    this.cancelDrag();
    const def = ITEMS[kind];
    const tex = def.iconAlias ? AssetManager.getTexture(def.iconAlias) : null;
    const ghost = new Container();
    if (tex) {
      const icon = new PixiSprite(tex);
      const fit = Math.min((SLOT_SIZE - 8) / tex.width, (SLOT_SIZE - 8) / tex.height);
      icon.scale.set(fit);
      icon.anchor.set(0.5);
      ghost.addChild(icon);
    } else {
      ghost.addChild(new Graphics().circle(0, 0, 12).fill(def.sprite.color));
    }
    ghost.alpha = 0.85;
    ghost.eventMode = 'none'; // never intercept pointer events
    this.container.addChild(ghost);
    this.drag = { kind, ghost };
    this.moveDragTo(e.global.x, e.global.y);
  }

  private moveDrag(e: FederatedPointerEvent): void {
    if (!this.drag) return;
    this.moveDragTo(e.global.x, e.global.y);
  }

  private moveDragTo(globalX: number, globalY: number): void {
    if (!this.drag) return;
    const local = this.container.toLocal({ x: globalX, y: globalY });
    this.drag.ghost.position.set(local.x, local.y);
  }

  private endDrag(e: FederatedPointerEvent): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.container.removeChild(drag.ghost);
    drag.ghost.destroy();
    // Hit-test against mini-hotbar slots.
    for (let i = 0; i < this.miniHotbarSlots.length; i++) {
      const slot = this.miniHotbarSlots[i]!;
      const bounds = slot.getBounds();
      if (
        e.global.x >= bounds.x &&
        e.global.x <= bounds.x + bounds.width &&
        e.global.y >= bounds.y &&
        e.global.y <= bounds.y + bounds.height
      ) {
        this.callbacks?.onBind(drag.kind, i);
        return;
      }
    }
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.container.removeChild(drag.ghost);
    drag.ghost.destroy();
  }
}
