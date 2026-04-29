import type { Application } from 'pixi.js';
import { Container, Graphics, Text } from 'pixi.js';

const SLOT_COUNT = 8;
const SLOT_SIZE = 48;
const SLOT_GAP = 6;
const PADDING_BOTTOM = 16;

/**
 * Centered bottom hotbar — 8 placeholder slots labeled 1..8. Inactive in MVP;
 * M-future will hook items / abilities here.
 */
export class Hotbar {
  readonly container: Container;
  private app: Application;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container({ label: 'hotbar' });

    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = i * (SLOT_SIZE + SLOT_GAP);
      const slot = new Graphics()
        .roundRect(x, 0, SLOT_SIZE, SLOT_SIZE, 5)
        .fill({ color: 0x101010, alpha: 0.7 })
        .stroke({ width: 1, color: 0x806040, alpha: 0.8 });
      const label = new Text({
        text: String(i + 1),
        style: { fontFamily: 'system-ui, sans-serif', fontSize: 11, fill: 0xa08050 },
      });
      label.position.set(x + 4, 3);
      this.container.addChild(slot, label);
    }

    this.reposition();
    app.renderer.on('resize', () => this.reposition());
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private reposition(): void {
    const totalWidth = SLOT_COUNT * SLOT_SIZE + (SLOT_COUNT - 1) * SLOT_GAP;
    this.container.position.set(
      (this.app.screen.width - totalWidth) / 2,
      this.app.screen.height - SLOT_SIZE - PADDING_BOTTOM,
    );
  }
}
