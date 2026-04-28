import type { Application } from 'pixi.js';
import { Container, Graphics, Text } from 'pixi.js';

const FADE_IN_MS = 150;
const VISIBLE_MS = 2200;
const FADE_OUT_MS = 400;
const PADDING_X = 22;
const PADDING_Y = 12;

interface ActiveToast {
  container: Container;
  elapsed: number;
}

/**
 * Simple bottom-center toast manager. Used in M3 for "Path overgrown" feedback.
 * Will be superseded by the proper ActionLog in M6.
 */
export class Toast {
  private readonly app: Application;
  private readonly parent: Container;
  private readonly active: ActiveToast[] = [];

  constructor(app: Application, parent: Container) {
    this.app = app;
    this.parent = parent;
    app.ticker.add(() => this.update(app.ticker.deltaMS));
  }

  show(message: string): void {
    const text = new Text({
      text: message,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 18,
        fill: 0xfaf6e8,
        align: 'center',
      },
    });
    const bg = new Graphics()
      .roundRect(
        -text.width / 2 - PADDING_X,
        -text.height / 2 - PADDING_Y,
        text.width + PADDING_X * 2,
        text.height + PADDING_Y * 2,
        6,
      )
      .fill({ color: 0x000000, alpha: 0.7 });

    const container = new Container({ label: 'toast' });
    container.addChild(bg, text);
    text.position.set(-text.width / 2, -text.height / 2);
    container.alpha = 0;

    this.repositionAll();
    this.parent.addChild(container);
    this.active.push({ container, elapsed: 0 });
    this.repositionAll();
  }

  private update(dt: number): void {
    const total = FADE_IN_MS + VISIBLE_MS + FADE_OUT_MS;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      if (!item) continue;
      item.elapsed += dt;
      const t = item.elapsed;
      if (t < FADE_IN_MS) {
        item.container.alpha = t / FADE_IN_MS;
      } else if (t < FADE_IN_MS + VISIBLE_MS) {
        item.container.alpha = 1;
      } else if (t < total) {
        item.container.alpha = 1 - (t - FADE_IN_MS - VISIBLE_MS) / FADE_OUT_MS;
      } else {
        item.container.destroy();
        this.active.splice(i, 1);
      }
    }
  }

  private repositionAll(): void {
    const cx = this.app.screen.width / 2;
    const baseY = this.app.screen.height - 90;
    const spacing = 60;
    for (let i = 0; i < this.active.length; i++) {
      const item = this.active[i];
      if (!item) continue;
      item.container.position.set(cx, baseY - (this.active.length - 1 - i) * spacing);
    }
  }

  destroy(): void {
    for (const item of this.active) item.container.destroy();
    this.active.length = 0;
  }
}
