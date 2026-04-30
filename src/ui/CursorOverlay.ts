import type { Application, FederatedPointerEvent, Texture } from 'pixi.js';
import { Sprite as PixiSprite } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { AssetManager } from '@services/AssetManager';

/** Frame period in ms for the attack-cursor animation (3 frames cycled). */
const FRAME_PERIOD_MS = 130;
/** Visual scale applied to the sword sprite. Source frames are ~50-80 px tall;
 *  0.55 brings them down to a typical cursor footprint without losing detail. */
const CURSOR_SCALE = 0.55;

export type CursorMode = 'default' | 'attack';

/**
 * Custom cursor overlay. Hides the OS cursor and draws our own Pixi sprite at
 * the mouse position, with a frame-cycled animation in 'attack' mode (sword
 * rotation through 3 poses). 'default' mode restores the system cursor.
 *
 * Mounted at the app stage level so it sits above every layer (UI included)
 * and isn't affected by the camera/viewport scale.
 *
 * The mouse position is tracked via `pointermove` on the viewport (world-input
 * surface). The screen coords come from `e.global` and apply directly to the
 * stage — no projection needed since both share the renderer's coordinate space.
 */
export class CursorOverlay {
  readonly node: PixiSprite;
  private mode: CursorMode = 'default';
  private elapsedMs = 0;
  private readonly textures: Texture[] = [];
  private readonly cleanups: Array<() => void> = [];
  private readonly canvas: HTMLCanvasElement;

  constructor(app: Application, viewport: Viewport) {
    this.canvas = app.canvas;
    this.node = new PixiSprite();
    this.node.anchor.set(0.5);
    this.node.scale.set(CURSOR_SCALE);
    this.node.visible = false;
    this.node.zIndex = 10000; // above everything
    this.node.eventMode = 'none'; // never intercept clicks itself

    for (const alias of ['cursor.sword.1', 'cursor.sword.2', 'cursor.sword.3'] as const) {
      const tex = AssetManager.getTexture(alias);
      if (tex) this.textures.push(tex);
    }
    if (this.textures[0]) this.node.texture = this.textures[0];

    const onMove = (e: FederatedPointerEvent): void => {
      this.node.position.set(e.global.x, e.global.y);
    };
    viewport.on('pointermove', onMove);
    this.cleanups.push(() => viewport.off('pointermove', onMove));
  }

  setMode(mode: CursorMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === 'attack' && this.textures.length > 0) {
      this.node.visible = true;
      this.canvas.style.cursor = 'none';
    } else {
      this.node.visible = false;
      this.canvas.style.cursor = '';
    }
  }

  /** Tick the frame animation. No-op outside 'attack' mode. */
  update(dt: number): void {
    if (this.mode !== 'attack' || this.textures.length === 0) return;
    this.elapsedMs += dt;
    const frame = Math.floor(this.elapsedMs / FRAME_PERIOD_MS) % this.textures.length;
    const tex = this.textures[frame];
    if (tex && this.node.texture !== tex) this.node.texture = tex;
  }

  destroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups.length = 0;
    this.canvas.style.cursor = '';
    this.node.destroy();
  }
}
