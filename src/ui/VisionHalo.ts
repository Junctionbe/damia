import { Sprite, Texture } from 'pixi.js';
import type { Application, Container } from 'pixi.js';
import { TILE_HALF_H, TILE_HALF_W } from '@core/math/iso';
import { FogOfWar } from '@services/FogOfWar';

/** Fully-clear core radius (px). The player + their immediate surroundings
 *  always read at full brightness inside this disc, no fade applied. */
const HALO_INNER_RADIUS_PX = 140;
/** Maximum darkness applied beyond the vision radius (0..1). The radial
 *  reaches this alpha at OUTER_RADIUS and stays at it for the rest of the
 *  screen, so memory cells beyond the halo's outer ring all read at the same
 *  dimming level. */
const HALO_EDGE_ALPHA = 0.5;
/** Color of the dimming. Same dark-blue as the unexplored blackout so the
 *  two layers feel like part of the same fog system. */
const HALO_COLOR = '0, 0, 16';
/** Halo-radius flicker amplitude (fraction of nominal scale). The scale
 *  range is `[1.0, 1.0 + 2 × AMP]` — clamped above 1.0 so the screen-sized
 *  sprite never shrinks below the viewport bounds (which would expose a
 *  bright border of un-darkened world). Subtle on purpose: larger values
 *  misalign the smooth edge from the per-tile mob-hide ring, briefly
 *  surfacing mobs in the dark. */
const FLICKER_SCALE_AMP = 0.025;

/**
 * Screen-space radial darkening that creates the smooth Diablo-style "torch
 * around the player" halo. Pairs with the world-space `FogOfWarOverlay`:
 *   - This overlay   → smooth circular fade vision → memory.
 *   - FogOfWarOverlay → hard opaque blackout for never-revealed cells.
 *
 * Wild scenes lock the camera onto the player, so the player is always at
 * screen centre and a static centred radial cutout produces the correct
 * "halo follows the player" illusion without per-frame redraws.
 *
 * The outer radius is derived from `FogOfWar.REVEAL_RADIUS_TILES` so the
 * smooth edge of the halo lands exactly where mob visibility flips off (via
 * the Hidden tag in updateMobVisibility) — the player never sees a mob
 * sitting in the dark ring outside their lit zone.
 *
 * Mounted between the world viewport and the UI layer so it darkens the
 * world but leaves HUD / minimap / hotbar fully bright.
 */
export class VisionHalo {
  readonly sprite: Sprite;
  private app: Application;
  private cleanupResize: (() => void) | null = null;
  /** Accumulated frame time in ms — drives the flicker oscillators. */
  private elapsedMs = 0;

  constructor(app: Application) {
    this.app = app;
    this.sprite = new Sprite();
    this.sprite.label = 'vision-halo';
    // Anchor at centre so per-frame `sprite.scale` flicker grows / shrinks
    // the halo around the player position (= screen centre under camera-
    // follow), not from the top-left corner.
    this.sprite.anchor.set(0.5, 0.5);
    this.rebuild();

    const onResize = (): void => this.rebuild();
    app.renderer.on('resize', onResize);
    this.cleanupResize = () => app.renderer.off('resize', onResize);
  }

  /**
   * Per-frame flicker — modulates sprite scale only (no alpha pulse). Mixing
   * two sin waves at incommensurate frequencies gives a smooth pseudo-noise
   * close to real torch breathing. Scale rides above 1.0 always so the dim
   * outer ring keeps covering the full viewport (no bright leak at screen
   * edges). Cheap: a single scale write, no canvas/texture work.
   *
   * Brightness flicker (e.g. via `sprite.alpha`) was tried first but it
   * pulsed the dim memory zone at the screen corners — the player saw the
   * far-away dim breathe in opacity, which read as glitchy. Scale-only
   * keeps the modulation localised to the halo's spatial extent.
   */
  tick(dt: number): void {
    this.elapsedMs += dt;
    const t = this.elapsedMs / 1000;
    // Combined wave in [-1, 1]; 2.7 Hz + 5.3 Hz feels close to a real torch.
    const noise = 0.6 * Math.sin(t * 2.7) + 0.4 * Math.sin(t * 5.3);
    // Map [-1, 1] → [1.0, 1.0 + 2·AMP] so scale never dips below 1.
    this.sprite.scale.set(1 + FLICKER_SCALE_AMP * (noise + 1));
  }

  /**
   * Insert the halo just after the world viewport in the stage's children
   * array. With the stage's `sortableChildren = true` and equal zIndices,
   * array order is what dictates render order — this is more robust than a
   * fixed `addChildAt` index because the stage already has children at start
   * (e.g. the DebugOverlay).
   */
  mount(stage: Container, viewport: Container): void {
    stage.addChild(this.sprite);
    const viewportIdx = stage.getChildIndex(viewport);
    stage.setChildIndex(this.sprite, viewportIdx + 1);
  }

  destroy(): void {
    this.cleanupResize?.();
    this.cleanupResize = null;
    const tex = this.sprite.texture;
    this.sprite.destroy();
    if (tex) tex.destroy(true);
  }

  /** (Re)bake the canvas + bind it to the sprite. Called on construction and
   *  on every renderer resize event so the cutout stays centred when the
   *  window changes shape. */
  private rebuild(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w / 2;
    const cy = h / 2;
    // Outer radius = the on-screen footprint of the FogOfWar's vision radius.
    // 1 tile step in iso = (TILE_HALF_W, TILE_HALF_H), so its world distance
    // (= screen distance under iso projection) is √(W² + H²). Multiply by the
    // tile vision radius and you get the pixel radius that lines up exactly
    // with the per-tile mob hide check.
    const outer =
      FogOfWar.REVEAL_RADIUS_TILES *
      Math.sqrt(TILE_HALF_W * TILE_HALF_W + TILE_HALF_H * TILE_HALF_H);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Solid dim fill at terminal alpha. Pixels outside the inner ring sample
    // through this when the gradient erase below is fully transparent.
    ctx.fillStyle = `rgba(${HALO_COLOR}, ${HALO_EDGE_ALPHA})`;
    ctx.fillRect(0, 0, w, h);

    // Punch a soft hole at the centre. Inside HALO_INNER_RADIUS the dim is
    // fully erased (clear core); from INNER → OUTER it fades back in for a
    // smooth halo edge. Beyond OUTER the gradient stops adding alpha so the
    // base fill stays unchanged at HALO_EDGE_ALPHA.
    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(cx, cy, HALO_INNER_RADIUS_PX, cx, cy, outer);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Inner solid disc — guarantees the very centre is fully transparent so
    // the player isn't covered by the gradient's soft start.
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.beginPath();
    ctx.arc(cx, cy, HALO_INNER_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();

    // Free the previous texture before swapping so resize doesn't leak GPU
    // memory — `Texture.from(canvas)` creates a fresh upload each time.
    const old = this.sprite.texture;
    this.sprite.texture = Texture.from(canvas);
    // Anchor 0.5 means position is the SPRITE'S CENTRE → place at screen
    // centre so the halo lines up with the player.
    this.sprite.position.set(w / 2, h / 2);
    if (old) old.destroy(true);
  }
}
