import { Container, Graphics } from 'pixi.js';
import type { FogOfWar } from '@services/FogOfWar';
import { TILE_HALF_H, TILE_HALF_W, gridToWorld } from '@core/math/iso';

/** Color used for the unknown-tile blackout. Dark blue rather than pure black
 *  so the world doesn't feel completely dead. */
const FOG_COLOR = 0x000810;
/** Reveal-fade duration (ms). When a cell transitions unknown → revealed for
 *  the first time, its blackout alpha lerps from 1 → 0 over this window. */
const FADE_MS = 280;

/**
 * World-space hard blackout for never-revealed tiles, with a smooth fade-out
 * animation when cells flip from unknown to revealed. Renders one iso diamond
 * per cell that's either fully unknown OR currently fading in; long-revealed
 * cells are skipped entirely. Memory ↔ vision smoothing is handled by the
 * companion screen-space `VisionHalo` overlay.
 *
 * Mounts on the dedicated `fog` layer of the world Layers stack so it sits
 * above the entities (mob sprites, HP bars, spell VFX) but below the
 * screen-space UI. The hard polygon edges around true unexplored regions
 * stay sharp — the fade only softens the moment of discovery.
 *
 * Performance — three redraw modes:
 *   - Player crosses a cell boundary → redraw immediately + arm a fade window
 *   - Inside fade window (≤ FADE_MS after the latest reveal) → redraw every
 *     frame so the alpha lerp animates smoothly
 *   - Otherwise → skip redraw (no state change)
 *   With ≤ 32×32 grids that's ~1024 polys per redraw, cheap on modern GPUs.
 */
export class FogOfWarOverlay {
  readonly container: Container;
  private graphics: Graphics;
  private fog: FogOfWar;
  private lastGx = Number.NaN;
  private lastGy = Number.NaN;
  /** Wall-clock deadline (ms, performance.now()) until which at least one
   *  recently-revealed cell is still fading. After this point we can stop
   *  redrawing until the player crosses another cell boundary. */
  private fadeDeadlineMs = 0;

  constructor(fog: FogOfWar) {
    this.fog = fog;
    this.container = new Container({ label: 'fog-of-war-overlay' });
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  /** Redraw the per-tile blackout. Triggers on player cell change OR while a
   *  reveal-fade window is still active. Pass the current player grid coords
   *  — the painted alpha itself comes from `fog.isRevealed` + `fog.revealAge`. */
  update(playerGx: number, playerGy: number): void {
    const now = performance.now();
    const cellChanged = playerGx !== this.lastGx || playerGy !== this.lastGy;
    if (cellChanged) {
      this.lastGx = playerGx;
      this.lastGy = playerGy;
      // Cells just revealed by `revealCellsAround` (called immediately before
      // this in the scene update) have age ≈ 0, so they need FADE_MS more
      // frames of redraws to animate fully out.
      this.fadeDeadlineMs = now + FADE_MS;
    }
    if (cellChanged || now < this.fadeDeadlineMs) {
      this.redraw(now);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private redraw(now: number): void {
    const g = this.graphics.clear();
    const w = this.fog.width;
    const h = this.fog.height;

    for (let gx = 0; gx < w; gx++) {
      for (let gy = 0; gy < h; gy++) {
        const age = this.fog.revealAge(gx, gy, now);
        let alpha: number;
        if (age === null) {
          // Never revealed → fully opaque blackout.
          alpha = 1;
        } else if (age < FADE_MS) {
          // Within the reveal-fade window → lerp 1 → 0 over FADE_MS.
          alpha = 1 - age / FADE_MS;
        } else {
          // Long revealed → no overlay needed.
          continue;
        }

        const wp = gridToWorld(gx, gy);
        // Iso diamond for this cell — same shape the TileMap uses, so the
        // overlay tiles seamlessly with the ground/path rendering below.
        const points = [
          wp.x,
          wp.y - TILE_HALF_H,
          wp.x + TILE_HALF_W,
          wp.y,
          wp.x,
          wp.y + TILE_HALF_H,
          wp.x - TILE_HALF_W,
          wp.y,
        ];
        g.poly(points).fill({ color: FOG_COLOR, alpha });
      }
    }
  }
}
