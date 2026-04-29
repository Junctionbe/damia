import { Container, Graphics, Text } from 'pixi.js';
import type { GameContext } from '@/Game';
import type { Scene } from './Scene';
import { t } from '@services/I18nService';
import { SaveManager } from '@services/SaveManager';
import { playSfx, unlockAudio } from '@services/AudioManager';
import { ForestScene } from '@scenes/ForestOfSeles/ForestScene';

interface ButtonHandle {
  container: Container;
  setEnabled: (enabled: boolean) => void;
}

export class TitleScene implements Scene {
  readonly name = 'title';
  private container: Container | null = null;
  private cleanups: Array<() => void> = [];

  enter(ctx: GameContext): void {
    const { width, height } = ctx.app.screen;
    this.container = new Container({ label: 'title-scene' });

    const bg = new Graphics().rect(0, 0, width, height).fill(0x0e1814);
    this.container.addChild(bg);

    const title = new Text({
      text: t('title.name'),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 88,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 4 },
      },
    });
    title.anchor.set(0.5);
    title.position.set(width / 2, height / 2 - 130);

    const subtitle = new Text({
      text: t('title.subtitle'),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 18,
        fill: 0xc8b58a,
        fontStyle: 'italic',
      },
    });
    subtitle.anchor.set(0.5);
    subtitle.position.set(width / 2, height / 2 - 70);

    const newGameBtn = this.makeButton(t('title.newGame'), width / 2, height / 2, () => {
      playSfx('ui.click');
      SaveManager.clear();
      void ctx.scenes.switchTo(new ForestScene(), ctx);
    });
    const continueBtn = this.makeButton(t('title.continue'), width / 2, height / 2 + 60, () => {
      const save = SaveManager.load();
      if (!save) return;
      playSfx('ui.click');
      void ctx.scenes.switchTo(new ForestScene(save), ctx);
    });
    continueBtn.setEnabled(SaveManager.has());

    this.container.addChild(title, subtitle, newGameBtn.container, continueBtn.container);
    ctx.app.stage.addChild(this.container);

    // First user click anywhere unlocks the AudioContext (browser policy).
    const unlock = (): void => {
      unlockAudio();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    this.cleanups.push(() => window.removeEventListener('pointerdown', unlock));
  }

  exit(ctx: GameContext): void {
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    if (this.container) {
      ctx.app.stage.removeChild(this.container);
      this.container.destroy({ children: true });
      this.container = null;
    }
  }

  update(): void {}

  private makeButton(label: string, x: number, y: number, onClick: () => void): ButtonHandle {
    const w = 220;
    const h = 44;
    const container = new Container({ label: `btn-${label}` });
    const bg = new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, 6)
      .fill({ color: 0x202820, alpha: 0.95 })
      .stroke({ width: 2, color: 0xa08050 });
    const text = new Text({
      text: label,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 20, fill: 0xfaf6e8 },
    });
    text.anchor.set(0.5);
    container.addChild(bg, text);
    container.position.set(x, y);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    let enabled = true;

    container.on('pointertap', () => {
      if (enabled) onClick();
    });
    container.on('pointerover', () => {
      if (enabled) bg.tint = 0xc8b58a;
    });
    container.on('pointerout', () => {
      bg.tint = 0xffffff;
    });

    return {
      container,
      setEnabled: (e: boolean) => {
        enabled = e;
        container.alpha = e ? 1 : 0.4;
        container.eventMode = e ? 'static' : 'none';
      },
    };
  }
}
