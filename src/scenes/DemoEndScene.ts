import { Container, Graphics, Text } from 'pixi.js';
import type { GameContext } from '@/Game';
import type { Scene } from './Scene';
import { t } from '@services/I18nService';

export class DemoEndScene implements Scene {
  readonly name = 'demo-end';
  private container: Container | null = null;

  enter(ctx: GameContext): void {
    const { width, height } = ctx.app.screen;
    this.container = new Container({ label: 'demo-end-scene' });

    const bg = new Graphics().rect(0, 0, width, height).fill(0x000000);
    this.container.addChild(bg);

    const title = new Text({
      text: t('exits.demoEndTitle'),
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 56, fill: 0xfaf6e8 },
    });
    title.position.set((width - title.width) / 2, height / 2 - 60);

    const subtitle = new Text({
      text: t('exits.demoEndSubtitle'),
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 22, fill: 0xb89a6b },
    });
    subtitle.position.set((width - subtitle.width) / 2, height / 2 + 10);

    this.container.addChild(title, subtitle);
    ctx.app.stage.addChild(this.container);
  }

  exit(ctx: GameContext): void {
    if (this.container) {
      ctx.app.stage.removeChild(this.container);
      this.container.destroy({ children: true });
      this.container = null;
    }
  }

  update(): void {}
}
