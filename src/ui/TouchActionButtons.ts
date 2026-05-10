import { Container, Graphics, Text } from 'pixi.js';
import type { Application, FederatedPointerEvent } from 'pixi.js';

const PADDING_PX = 24;
const BTN_LARGE = 38;
const BTN_MEDIUM = 30;
/** Vertical gap between stacked buttons. */
const STACK_GAP = 12;

/** Minimal button spec: visual size, glyph, and the tap callback. */
interface ButtonSpec {
  label: string;
  radius: number;
  /** Tap handler. The scene wires this to its own emit-click / emit-defend
   *  hooks on the InputController so the touch path joins the same event
   *  pipeline as keyboard / mouse. */
  onTap: () => void;
  /** Optional state-driven tint. When set, called on every render to decide
   *  whether the button is "active" (drawn with the active fill). Used by
   *  the defend toggle so the button visually reflects the on/off state. */
  isActive?: () => boolean;
}

/**
 * On-screen action buttons for touch devices. Renders a vertical stack at
 * bottom-right: Attack (largest), Addition, Defend (toggle). Each button is
 * a Pixi container with a circular fill + label; the scene supplies the
 * `onTap` handlers so this class stays UI-only.
 *
 * Defend supports an `isActive` poll so the visual toggles between the idle
 * and pressed fills based on the controller's current defend state — single
 * source of truth, no internal state to drift.
 */
export class TouchActionButtons {
  readonly container: Container;
  private app: Application;
  private buttons: Array<{ spec: ButtonSpec; bg: Graphics }> = [];
  private cleanupFns: Array<() => void> = [];
  /** Tick handle so we can poll `isActive` callbacks each frame and re-tint
   *  buttons that opt in (e.g. the defend toggle). */
  private tickerCb: (() => void) | null = null;

  constructor(
    app: Application,
    handlers: {
      onAttack: () => void;
      onAddition: () => void;
      onDefendToggle: () => void;
      isDefending: () => boolean;
    },
  ) {
    this.app = app;
    this.container = new Container({ label: 'touch-action-buttons' });

    const specs: ButtonSpec[] = [
      { label: 'A', radius: BTN_LARGE, onTap: handlers.onAttack },
      { label: '*', radius: BTN_MEDIUM, onTap: handlers.onAddition },
      {
        label: 'D',
        radius: BTN_MEDIUM,
        onTap: handlers.onDefendToggle,
        isActive: handlers.isDefending,
      },
    ];

    for (const spec of specs) {
      const btn = this.makeButton(spec);
      this.buttons.push({ spec, bg: btn.bg });
      this.container.addChild(btn.container);
    }

    this.layoutStack();
    const onResize = (): void => this.layoutStack();
    app.renderer.on('resize', onResize);
    this.cleanupFns.push(() => app.renderer.off('resize', onResize));

    // Per-frame poll for `isActive` flags — cheap, ≤3 buttons. Pixi's ticker
    // already runs at 60fps so we just piggy-back instead of wiring a custom
    // animation frame.
    this.tickerCb = (): void => this.refreshTints();
    app.ticker.add(this.tickerCb);
  }

  destroy(): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.tickerCb = null;
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns.length = 0;
    this.container.destroy({ children: true });
  }

  /** Build a single circular button. Returns the container + its bg Graphics
   *  so the caller can re-tint it later (active state). */
  private makeButton(spec: ButtonSpec): { container: Container; bg: Graphics } {
    const container = new Container({ label: `touch-btn-${spec.label}` });
    const bg = new Graphics()
      .circle(0, 0, spec.radius)
      .fill({ color: 0x1c2840, alpha: 0.85 })
      .stroke({ width: 2, color: 0xa08050, alpha: 0.9 });
    const text = new Text({
      text: spec.label,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: spec.radius,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 },
      },
    });
    text.anchor.set(0.5);
    container.addChild(bg, text);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    const onTap = (e: FederatedPointerEvent): void => {
      e.stopPropagation();
      spec.onTap();
    };
    container.on('pointertap', onTap);
    this.cleanupFns.push(() => container.off('pointertap', onTap));

    return { container, bg };
  }

  /** Vertically stack the buttons against the bottom-right corner with the
   *  largest at the bottom (thumb-friendly). The button containers were
   *  pushed in spec order, so `container.children[i]` matches `buttons[i]`. */
  private layoutStack(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    let cursorY = h - PADDING_PX;
    for (let i = 0; i < this.buttons.length; i++) {
      const entry = this.buttons[i];
      const child = this.container.children[i];
      if (!entry || !child) continue;
      cursorY -= entry.spec.radius;
      child.position.set(w - PADDING_PX - entry.spec.radius, cursorY);
      cursorY -= entry.spec.radius + STACK_GAP;
    }
  }

  /** Re-paint each button's fill based on its `isActive` poll. Safe to call
   *  every frame — Pixi only re-uploads the geometry when `clear()` is hit. */
  private refreshTints(): void {
    for (const { spec, bg } of this.buttons) {
      const active = spec.isActive?.() ?? false;
      const colour = active ? 0xa08050 : 0x1c2840;
      bg.clear()
        .circle(0, 0, spec.radius)
        .fill({ color: colour, alpha: active ? 0.95 : 0.85 })
        .stroke({ width: 2, color: 0xa08050, alpha: 0.9 });
    }
  }
}
