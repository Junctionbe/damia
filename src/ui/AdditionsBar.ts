import type { Application } from 'pixi.js';
import { Container, Graphics } from 'pixi.js';
import { ADDITIONS, type AdditionKind } from '@data/balance';
import { t } from '@services/I18nService';
import { paintAdditionSlot, paintSlotFrame } from './slot';
import { Tooltip } from './Tooltip';

const SLOT_SIZE = 36;
const SLOT_GAP = 4;
/** Vertical gap above the Hotbar (which sits at the bottom with its own padding). */
const PADDING_BOTTOM = 88;

export interface AdditionsBarState {
  /** Additions the player has access to right now (filter from progression). */
  unlocked: ReadonlyArray<AdditionKind>;
  /** Currently-active addition — triggered on right-click. */
  active: AdditionKind;
  /** AdditionKind → cooldown fraction in [0, 1]. 1 = just triggered, 0 = ready. */
  cooldowns: Partial<Record<AdditionKind, number>>;
}

/**
 * Horizontal bar of unlocked additions, sits just above the Hotbar. Click a
 * slot to make it the active addition (right-click in the world casts it).
 * Cooldown radial paints over the active slot when a recent cast is on CD.
 *
 * The "active" slot is highlighted with a gold border. Hover shows a tooltip
 * with the addition's name + description (i18n keys: `additions.<kind>` /
 * `additions.<kind>.desc`).
 */
export class AdditionsBar {
  readonly container: Container;
  private app: Application;
  /** Per-slot dynamic Container — repainted each frame from setState. */
  private readonly slotContainers: Container[] = [];
  /** Mirror of `unlocked` used by the click handler to map slot idx → kind. */
  private currentUnlocked: ReadonlyArray<AdditionKind> = [];
  /** Tooltip — single shared instance. */
  private readonly tooltip: Tooltip;
  private lastState: AdditionsBarState | null = null;
  private onSelectCb: ((kind: AdditionKind) => void) | null = null;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container({ label: 'additions-bar' });

    this.tooltip = new Tooltip();
    // Tooltip mounted last so it draws above any slot.
    this.container.addChild(this.tooltip.node);

    this.reposition();
    app.renderer.on('resize', () => this.reposition());
  }

  setOnSelect(cb: (kind: AdditionKind) => void): void {
    this.onSelectCb = cb;
  }

  setState(state: AdditionsBarState): void {
    this.lastState = state;
    if (state.unlocked.join('|') !== this.currentUnlocked.join('|')) {
      this.rebuildSlots(state.unlocked);
    }
    this.repaintSlots(state);
    this.reposition();
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private rebuildSlots(unlocked: ReadonlyArray<AdditionKind>): void {
    // Wipe previous frames' slot containers (keep tooltip alive at the end).
    for (const c of this.slotContainers) c.destroy();
    this.slotContainers.length = 0;
    this.currentUnlocked = unlocked;

    for (let i = 0; i < unlocked.length; i++) {
      const kind = unlocked[i]!;
      const slot = new Container();
      slot.position.set(i * (SLOT_SIZE + SLOT_GAP), 0);
      slot.eventMode = 'static';
      slot.cursor = 'pointer';
      slot.on('pointertap', () => this.onSelectCb?.(kind));
      slot.on('pointerover', () => this.showTooltipFor(i));
      slot.on('pointerout', () => this.hideTooltip());
      this.container.addChild(slot);
      this.slotContainers.push(slot);
    }

    // Reattach tooltip on top after children rebuild.
    this.container.removeChild(this.tooltip.node);
    this.container.addChild(this.tooltip.node);
  }

  private repaintSlots(state: AdditionsBarState): void {
    for (let i = 0; i < this.slotContainers.length; i++) {
      const slot = this.slotContainers[i]!;
      const kind = this.currentUnlocked[i]!;
      const isActive = kind === state.active;

      // Frame first (selected = gold border), then content.
      slot.removeChildren().forEach((c) => c.destroy());
      slot.addChild(paintSlotFrame(new Graphics(), SLOT_SIZE, isActive));
      const content = new Container();
      slot.addChild(content);
      paintAdditionSlot(content, kind, {
        size: SLOT_SIZE,
        cooldownFrac: state.cooldowns[kind] ?? 0,
      });
    }
  }

  private showTooltipFor(slotIdx: number): void {
    const kind = this.currentUnlocked[slotIdx];
    if (!kind || !this.lastState) return;
    const def = ADDITIONS[kind];
    const name = t(`additions.${kind}`) || def.name;
    const desc = t(`additions.${kind}.desc`);
    this.tooltip.setText(`${name}\n${desc}`);
    const slotCenterX = slotIdx * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
    this.tooltip.showAbove(slotCenterX, 0);
  }

  private hideTooltip(): void {
    this.tooltip.hide();
  }

  private reposition(): void {
    const totalWidth =
      this.currentUnlocked.length * SLOT_SIZE +
      Math.max(0, this.currentUnlocked.length - 1) * SLOT_GAP;
    this.container.position.set(
      (this.app.screen.width - totalWidth) / 2,
      this.app.screen.height - SLOT_SIZE - PADDING_BOTTOM,
    );
  }
}
