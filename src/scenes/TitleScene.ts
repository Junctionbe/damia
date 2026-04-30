import { Container, Graphics, Sprite as PixiSprite, Text } from 'pixi.js';
import type { GameContext } from '@/Game';
import type { Scene } from './Scene';
import { t } from '@services/I18nService';
import { SaveManager } from '@services/SaveManager';
import { AssetManager } from '@services/AssetManager';
import { playMusic, playSfx, unlockAudio } from '@services/AudioManager';
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

    // Background — TLoD mainscreen image, cover-scaled (max ratio fills screen
    // without leaving gaps; some content may be cropped on extreme aspects).
    // Falls back to a flat dark fill if the texture didn't load.
    const bgTex = AssetManager.getTexture('ui.mainscreen');
    if (bgTex) {
      const bg = new PixiSprite(bgTex);
      const cover = Math.max(width / bgTex.width, height / bgTex.height);
      bg.scale.set(cover);
      bg.position.set((width - bgTex.width * cover) / 2, (height - bgTex.height * cover) / 2);
      this.container.addChild(bg);
    } else {
      this.container.addChild(new Graphics().rect(0, 0, width, height).fill(0x0e1814));
    }

    // The bg already carries the LoD logo, so we don't re-stamp a big "DAMIA"
    // title on top. Keep the project subtitle as a small footer caption so the
    // origin of the build is still visible.
    const subtitle = new Text({
      text: `${t('title.name')} — ${t('title.subtitle')}`,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fill: 0xc8b58a,
        fontStyle: 'italic',
        stroke: { color: 0x000000, width: 2 },
      },
    });
    subtitle.anchor.set(0.5, 1);
    subtitle.position.set(width / 2, height - 12);

    // Buttons sit at the bottom-center so they don't cover the logo art.
    const btnY1 = height - 130;
    const btnY2 = height - 70;
    const newGameBtn = this.makeButton(t('title.newGame'), width / 2, btnY1, () => {
      playSfx('ui.click');
      SaveManager.clear();
      void ctx.scenes.switchTo(new ForestScene(), ctx);
    });
    const continueBtn = this.makeButton(t('title.continue'), width / 2, btnY2, () => {
      const save = SaveManager.load();
      if (!save) return;
      playSfx('ui.click');
      void ctx.scenes.switchTo(new ForestScene(save), ctx);
    });
    continueBtn.setEnabled(SaveManager.has());

    this.container.addChild(subtitle, newGameBtn.container, continueBtn.container);
    ctx.app.stage.addChild(this.container);

    // First user click anywhere unlocks the AudioContext (browser policy)
    // and starts the title music. Re-entering the title later (after game
    // over / quit-to-title) skips the unlock but playMusic is idempotent.
    const startTitleMusic = (): void => playMusic('music.titleScreen');
    const unlock = (): void => {
      unlockAudio();
      startTitleMusic();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    this.cleanups.push(() => window.removeEventListener('pointerdown', unlock));
    // Try once on enter — works on subsequent visits when audio is already
    // unlocked. First-ever enter is a no-op until the unlock click fires.
    startTitleMusic();
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
