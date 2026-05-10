import type { Application } from 'pixi.js';
import { Container, Graphics } from 'pixi.js';
import type { World } from '@core/ecs';
import { TILE_HALF_H, TILE_HALF_W, gridToWorld, worldToGrid } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import type { TileMapPathZone } from '@rendering/TileMap';
import type { FogOfWar } from '@services/FogOfWar';

const MAP_FIT_PX = 200;
const PADDING = 12;

interface MiniMapOptions {
  /** Shared per-zone fog state. The MiniMap reads from it to paint the fog
   *  overlay; it does NOT mutate the grid (the scene calls
   *  `fog.revealCellsAround` once per frame from its own update). */
  fog: FogOfWar;
  pathZones: readonly TileMapPathZone[];
}

/**
 * Top-right toggleable minimap. Iso-projected so the rendered shape matches the
 * playable area: the grid (0..W-1, 0..H-1) maps to a 2:1 diamond. Static layer
 * (frame + path zones) is drawn once; dynamic layer (player + enemies + exits)
 * + fog overlay redraw each tick.
 */
export class MiniMap {
  readonly container: Container;
  private readonly background: Graphics;
  private readonly staticLayer: Graphics;
  private readonly dynamicLayer: Graphics;
  /** World→minimap scale and offset so projected coords land inside the bbox. */
  private readonly scale: number;
  private readonly offsetX: number;
  private readonly offsetY: number;
  /** Final bbox of the diamond after scaling — used for layout / repositioning. */
  private readonly bboxW: number;
  private readonly bboxH: number;
  private app: Application;
  private cleanupKey: (() => void) | null = null;
  /** Shared fog source. The world overlay (FogOfWarOverlay) reads from the
   *  same instance, so both renderers stay in sync without extra plumbing. */
  private readonly fog: FogOfWar;
  /** Fog overlay (dark squares for unrevealed cells) — redrawn each frame. */
  private readonly fogLayer: Graphics;

  constructor(app: Application, opts: MiniMapOptions) {
    this.app = app;
    this.fog = opts.fog;

    // Iso bbox of the grid (0,0)..(W-1, H-1) in world px:
    //  width  = (W + H - 2) * TILE_HALF_W
    //  height = (W + H - 2) * TILE_HALF_H
    // (TILE_HALF_W = 64, TILE_HALF_H = 32 → height = width / 2.)
    const span = this.fog.width + this.fog.height - 2;
    const isoW = span * TILE_HALF_W;
    const isoH = span * TILE_HALF_H;
    this.scale = MAP_FIT_PX / Math.max(isoW, isoH);
    // gridToWorld puts (0,0) at world (0,0); the leftmost point is (0, H-1) at
    // world x = -(H-1)*TILE_HALF_W. Shift everything so the diamond starts at x=0.
    this.offsetX = (this.fog.height - 1) * TILE_HALF_W * this.scale;
    this.offsetY = 0;
    this.bboxW = isoW * this.scale;
    this.bboxH = isoH * this.scale;

    this.container = new Container({ label: 'minimap' });

    // Background = the iso diamond itself (top / right / bottom / left points).
    this.background = new Graphics()
      .poly([
        this.bboxW / 2,
        0,
        this.bboxW,
        this.bboxH / 2,
        this.bboxW / 2,
        this.bboxH,
        0,
        this.bboxH / 2,
      ])
      .fill({ color: 0x000000, alpha: 0.6 })
      .stroke({ width: 1, color: 0xa08050, alpha: 0.7 });

    // Path zones become parallelograms (4 grid corners projected through iso).
    this.staticLayer = new Graphics();
    for (const z of opts.pathZones) {
      const x0 = z.x;
      const y0 = z.y;
      const x1 = z.x + z.w;
      const y1 = z.y + z.h;
      const a = this.projectGrid(x0, y0);
      const b = this.projectGrid(x1, y0);
      const c = this.projectGrid(x1, y1);
      const d = this.projectGrid(x0, y1);
      this.staticLayer
        .poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y])
        .fill({ color: 0x6e4a2c, alpha: 0.6 });
    }

    this.dynamicLayer = new Graphics();
    this.fogLayer = new Graphics();
    // Order: background → path zones → fog overlay → live dots on top.
    this.container.addChild(this.background, this.staticLayer, this.fogLayer, this.dynamicLayer);

    this.reposition();
    app.renderer.on('resize', () => this.reposition());

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'm' || e.key === 'M') this.container.visible = !this.container.visible;
    };
    window.addEventListener('keydown', onKey);
    this.cleanupKey = () => window.removeEventListener('keydown', onKey);
  }

  /** Redraws fog reveal + dynamic dots from the world state. Called each frame.
   *  The shared FogOfWar grid is mutated by the scene (NOT here) before this
   *  is called, so the overlay always paints the latest state. */
  update(world: World<Components>): void {
    let playerGx = -1;
    let playerGy = -1;
    for (const id of world.query(['Player', 'Position'])) {
      const pos = world.getComponent(id, 'Position');
      if (!pos) continue;
      const grid = worldToGrid(pos.x, pos.y);
      playerGx = Math.round(grid.x);
      playerGy = Math.round(grid.y);
      break;
    }

    if (!this.container.visible) return;

    // Fog overlay — dark squares for unrevealed cells, redrawn each frame
    // because per-cell state changes as the player explores.
    const fogG = this.fogLayer.clear();
    const cellW = TILE_HALF_W * this.scale;
    const cellH = TILE_HALF_H * this.scale;
    for (let gx = 0; gx < this.fog.width; gx++) {
      for (let gy = 0; gy < this.fog.height; gy++) {
        if (this.fog.isRevealed(gx, gy)) continue;
        const p = this.projectGrid(gx, gy);
        // Each grid cell projects to a small iso diamond on the minimap.
        fogG
          .poly([
            p.x,
            p.y - cellH / 2,
            p.x + cellW / 2,
            p.y,
            p.x,
            p.y + cellH / 2,
            p.x - cellW / 2,
            p.y,
          ])
          .fill({ color: 0x000000, alpha: 0.85 });
      }
    }

    const g = this.dynamicLayer.clear();

    for (const id of world.query(['Exit'])) {
      const e = world.getComponent(id, 'Exit');
      if (!e) continue;
      // Don't reveal exits in unexplored cells.
      if (!this.fog.isRevealed(e.gx, e.gy)) continue;
      const color = e.kind === 'transition' ? 0xffd060 : 0x808080;
      this.dot(g, e.gx, e.gy, 4, color);
    }

    for (const id of world.query(['Faction', 'Position', 'Health'])) {
      const fac = world.getComponent(id, 'Faction');
      const pos = world.getComponent(id, 'Position');
      if (!fac || !pos) continue;
      if (fac.side === 'player') continue;
      const grid = worldToGrid(pos.x, pos.y);
      const gx = Math.round(grid.x);
      const gy = Math.round(grid.y);
      // Hide enemy dots in fog — only show what the player can "see".
      if (!this.fog.isRevealed(gx, gy)) continue;
      this.dot(g, gx, gy, 3, 0xff6060);
    }

    if (playerGx >= 0) this.dot(g, playerGx, playerGy, 4, 0x60d8ff);
  }

  destroy(): void {
    this.cleanupKey?.();
    this.cleanupKey = null;
    this.container.destroy({ children: true });
  }

  /** Project a grid cell (gx, gy) to local minimap coords. */
  private projectGrid(gx: number, gy: number): { x: number; y: number } {
    const w = gridToWorld(gx, gy);
    return { x: w.x * this.scale + this.offsetX, y: w.y * this.scale + this.offsetY };
  }

  private dot(g: Graphics, gx: number, gy: number, radius: number, color: number): void {
    if (gx < 0 || gy < 0 || gx >= this.fog.width || gy >= this.fog.height) return;
    const p = this.projectGrid(gx, gy);
    g.circle(p.x, p.y, radius).fill(color);
  }

  private reposition(): void {
    this.container.position.set(this.app.screen.width - this.bboxW - PADDING, PADDING);
  }
}
