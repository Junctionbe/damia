import { Container, Graphics, Text } from 'pixi.js';
import type { Application, FederatedPointerEvent } from 'pixi.js';

const PADDING_PX = 12;
const BTN_RADIUS = 22;
const HORIZONTAL_GAP = 10;

interface MenuButtonSpec {
  label: string;
  onTap: () => void;
}

/**
 * Top-left menu button cluster for touch devices: Inventory + Settings.
 * Provides tap-equivalents of the `I` and `Esc` keys so mobile players have a
 * way to open those panels. Sits in the top-LEFT corner so it doesn't compete
 * with the minimap (which lives top-right).
 *
 * Kept deliberately small (22 px radius) — these are infrequent actions, no
 * need to take up thumb-prime real estate.
 */
export class TouchMenuButtons {
  readonly container: Container;
  private cleanupFns: Array<() => void> = [];

  constructor(app: Application, handlers: { onInventory: () => void; onSettings: () => void }) {
    this.container = new Container({ label: 'touch-menu-buttons' });

    const specs: MenuButtonSpec[] = [
      { label: 'I', onTap: handlers.onInventory },
      { label: '⚙', onTap: handlers.onSettings },
    ];
    for (const spec of specs) {
      this.container.addChild(this.makeButton(spec));
    }

    this.layoutStack(app.screen.width, app.screen.height);
    const onResize = (): void => this.layoutStack(app.screen.width, app.screen.height);
    app.renderer.on('resize', onResize);
    this.cleanupFns.push(() => app.renderer.off('resize', onResize));
  }

  destroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns.length = 0;
    this.container.destroy({ children: true });
  }

  private makeButton(spec: MenuButtonSpec): Container {
    const container = new Container({ label: `touch-menu-${spec.label}` });
    const bg = new Graphics()
      .circle(0, 0, BTN_RADIUS)
      .fill({ color: 0x1c2840, alpha: 0.85 })
      .stroke({ width: 2, color: 0xa08050, alpha: 0.9 });
    const text = new Text({
      text: spec.label,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: BTN_RADIUS,
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
    return container;
  }

  /** Horizontal row at the top-left, padded from the corner. The HUD's
   *  portrait + stats live there too — these icons sit just to the right of
   *  the portrait box so they don't overlap the level / HP readout. The
   *  width / height args are kept in the signature so future responsive
   *  tweaks (e.g. snap to the right edge on tablet) drop in without churn. */
  private layoutStack(_screenWidth: number, _screenHeight: number): void {
    // The HUD portrait box is roughly 200 px wide; offset the menu icons to
    // the right of it so they don't sit on top.
    const HUD_PORTRAIT_WIDTH = 220;
    let cursorX = HUD_PORTRAIT_WIDTH + PADDING_PX + BTN_RADIUS;
    for (const child of this.container.children) {
      child.position.set(cursorX, PADDING_PX + BTN_RADIUS);
      cursorX += BTN_RADIUS * 2 + HORIZONTAL_GAP;
    }
  }
}
