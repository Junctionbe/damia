import type { Application } from 'pixi.js';
import { createRenderer, describeRenderer } from '@rendering/Renderer';
import { DebugOverlay } from '@rendering/debug/DebugOverlay';
import { SceneManager } from '@scenes/SceneManager';
import { BootScene } from '@scenes/BootScene';
import { initI18n } from '@services/I18nService';
import { initAudioManager } from '@services/AudioManager';

export interface GameContext {
  app: Application;
  scenes: SceneManager;
}

const BACKGROUND_COLOR = '#1a2820';

export class Game {
  private app!: Application;
  private scenes!: SceneManager;
  private debug!: DebugOverlay;

  async start(mountInto: HTMLElement): Promise<void> {
    // Bootstrap services that the rest of the app depends on.
    await initI18n();
    initAudioManager();

    this.app = await createRenderer({ background: BACKGROUND_COLOR });
    mountInto.appendChild(this.app.canvas);

    this.scenes = new SceneManager();
    const ctx: GameContext = { app: this.app, scenes: this.scenes };

    this.app.stage.sortableChildren = true;

    this.debug = new DebugOverlay(describeRenderer(this.app));
    this.debug.attach(this.app);
    this.debug.container.zIndex = 1000;
    this.app.stage.addChild(this.debug.container);

    this.app.ticker.add((ticker) => {
      this.scenes.update(ticker.deltaMS, ctx);
    });

    await this.scenes.switchTo(new BootScene(), ctx);

    console.info('[Damia] Game started — renderer:', describeRenderer(this.app));
  }
}
