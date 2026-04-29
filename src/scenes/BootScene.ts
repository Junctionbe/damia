import type { GameContext } from '@/Game';
import type { Scene } from './Scene';
import { TitleScene } from './TitleScene';

export class BootScene implements Scene {
  readonly name = 'boot';

  async enter(ctx: GameContext): Promise<void> {
    // M7: i18n + audio are bootstrapped in Game.start before we get here.
    // Future: AssetManager preloads zone tiles / spritesheets here.
    await ctx.scenes.switchTo(new TitleScene(), ctx);
  }

  exit(): void {}

  update(): void {}
}
