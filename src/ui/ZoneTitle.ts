import type { Application } from 'pixi.js';
import { Container, Text } from 'pixi.js';

const FADE_IN_MS = 500;
const HOLD_MS = 2500;
const FADE_OUT_MS = 1000;

/**
 * Top-center zone title with optional objective subtitle. Fade in → hold → fade out.
 * Show again via `show()` (e.g. on scene re-entry).
 */
export class ZoneTitle {
  readonly container: Container;
  private readonly title: Text;
  private readonly subtitle: Text;
  private elapsedMs = 0;
  private active = false;
  private app: Application;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container({ label: 'zone-title' });
    this.title = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 38,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 4 },
      },
    });
    this.title.anchor.set(0.5, 0);

    this.subtitle = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 16,
        fill: 0xc8b58a,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    this.subtitle.anchor.set(0.5, 0);

    this.container.addChild(this.title, this.subtitle);
    this.container.alpha = 0;
    this.reposition();

    app.ticker.add(() => this.update(app.ticker.deltaMS));
    app.renderer.on('resize', () => this.reposition());
  }

  show(title: string, subtitle: string): void {
    this.title.text = title;
    this.subtitle.text = subtitle;
    this.elapsedMs = 0;
    this.active = true;
    this.reposition();
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private update(dt: number): void {
    if (!this.active) return;
    this.elapsedMs += dt;
    const total = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;
    if (this.elapsedMs < FADE_IN_MS) {
      this.container.alpha = this.elapsedMs / FADE_IN_MS;
    } else if (this.elapsedMs < FADE_IN_MS + HOLD_MS) {
      this.container.alpha = 1;
    } else if (this.elapsedMs < total) {
      this.container.alpha = 1 - (this.elapsedMs - FADE_IN_MS - HOLD_MS) / FADE_OUT_MS;
    } else {
      this.container.alpha = 0;
      this.active = false;
    }
  }

  private reposition(): void {
    const cx = this.app.screen.width / 2;
    this.container.position.set(cx, 40);
    this.title.position.set(0, 0);
    this.subtitle.position.set(0, 50);
  }
}
