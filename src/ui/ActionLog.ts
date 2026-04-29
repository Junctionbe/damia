import type { Application } from 'pixi.js';
import { Container, Text } from 'pixi.js';

const MAX_LINES = 3;
const LINE_HEIGHT = 22;
const FADE_DELAY_MS = 4000;
const FADE_OUT_MS = 1000;
const PADDING = 16;

interface LogLine {
  text: Text;
  elapsed: number;
}

/**
 * Bottom-right action log: gameplay events (XP, items, kills). Shows up to MAX_LINES
 * stacked, each fading out FADE_DELAY_MS after creation.
 */
export class ActionLog {
  readonly container: Container;
  private readonly lines: LogLine[] = [];
  private app: Application;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container({ label: 'action-log' });
    this.reposition();
    app.ticker.add(() => this.update(app.ticker.deltaMS));
    app.renderer.on('resize', () => this.reposition());
  }

  push(message: string): void {
    const text = new Text({
      text: message,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fill: 0xfaf6e8,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    text.anchor.set(1, 1); // bottom-right
    this.container.addChild(text);
    this.lines.push({ text, elapsed: 0 });
    if (this.lines.length > MAX_LINES) {
      const oldest = this.lines.shift();
      oldest?.text.destroy();
    }
    this.layout();
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.lines.length = 0;
  }

  private update(dt: number): void {
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const line = this.lines[i];
      if (!line) continue;
      line.elapsed += dt;
      if (line.elapsed > FADE_DELAY_MS + FADE_OUT_MS) {
        line.text.destroy();
        this.lines.splice(i, 1);
        this.layout();
      } else if (line.elapsed > FADE_DELAY_MS) {
        line.text.alpha = 1 - (line.elapsed - FADE_DELAY_MS) / FADE_OUT_MS;
      }
    }
  }

  private layout(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line) continue;
      // Stack from bottom: newest at y=0, older lines above by LINE_HEIGHT.
      line.text.position.set(0, -(this.lines.length - 1 - i) * LINE_HEIGHT);
    }
  }

  private reposition(): void {
    this.container.position.set(
      this.app.screen.width - PADDING,
      this.app.screen.height - PADDING - 70,
    );
  }
}
