import type { Application } from 'pixi.js';
import { Container, Graphics, Text } from 'pixi.js';
import { t } from '@services/I18nService';

const PORTRAIT_SIZE = 72;
const BAR_WIDTH = 200;
const BAR_HEIGHT = 14;
const PADDING = 12;
const BAR_GAP = 6;

const HP_BG = 0x3a0808;
const HP_FG = 0xd03030;
const SP_BG = 0x0a1a3a;
const SP_FG = 0x4a8fff;

/**
 * Bottom-left HUD: portrait, HP bar, SP bar.
 * `update(world, playerId)` is called each frame from the scene.
 */
export class Hud {
  readonly container: Container;
  private readonly hpBar: Graphics;
  private readonly hpText: Text;
  private readonly spBar: Graphics;
  private readonly spText: Text;
  private app: Application;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container({ label: 'hud' });

    // Portrait placeholder.
    const portraitBg = new Graphics()
      .roundRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE, 6)
      .fill(0x202020)
      .stroke({ width: 2, color: 0xa08050, alpha: 0.9 });
    const portraitText = new Text({
      text: t('hud.dart'),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
      },
    });
    portraitText.anchor.set(0.5);
    portraitText.position.set(PORTRAIT_SIZE / 2, PORTRAIT_SIZE / 2);

    const barsX = PORTRAIT_SIZE + 10;

    // HP
    const hpBg = new Graphics().roundRect(barsX, 4, BAR_WIDTH, BAR_HEIGHT, 3).fill(HP_BG);
    this.hpBar = new Graphics();
    this.hpText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
      },
    });
    this.hpText.position.set(barsX + 6, 5);

    // SP
    const spY = 4 + BAR_HEIGHT + BAR_GAP;
    const spBg = new Graphics().roundRect(barsX, spY, BAR_WIDTH, BAR_HEIGHT, 3).fill(SP_BG);
    this.spBar = new Graphics();
    this.spText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
      },
    });
    this.spText.position.set(barsX + 6, spY + 1);

    this.container.addChild(
      portraitBg,
      portraitText,
      hpBg,
      this.hpBar,
      this.hpText,
      spBg,
      this.spBar,
      this.spText,
    );

    this.reposition();
    app.renderer.on('resize', () => this.reposition());
  }

  setHealth(current: number, max: number): void {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.hpBar
      .clear()
      .roundRect(PORTRAIT_SIZE + 10, 4, BAR_WIDTH * ratio, BAR_HEIGHT, 3)
      .fill(HP_FG);
    this.hpText.text = `HP ${Math.round(current)} / ${max}`;
  }

  setSp(current: number, max: number): void {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    const spY = 4 + BAR_HEIGHT + BAR_GAP;
    this.spBar
      .clear()
      .roundRect(PORTRAIT_SIZE + 10, spY, BAR_WIDTH * ratio, BAR_HEIGHT, 3)
      .fill(SP_FG);
    this.spText.text = `SP ${Math.round(current)} / ${max}`;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private reposition(): void {
    this.container.position.set(PADDING, this.app.screen.height - PORTRAIT_SIZE - PADDING);
  }
}
