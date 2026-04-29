import type { Application } from 'pixi.js';
import { Container, Graphics } from 'pixi.js';
import type { World } from '@core/ecs';
import { worldToGrid } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import type { TileMapPathZone } from '@rendering/TileMap';

const MAP_SIZE_PX = 200;
const PADDING = 12;

interface MiniMapOptions {
  gridWidth: number;
  gridHeight: number;
  pathZones: readonly TileMapPathZone[];
}

/**
 * Top-right toggleable minimap. Renders the grid + path zones once (static),
 * then redraws moving dots (player / enemies / exits) each tick.
 */
export class MiniMap {
  readonly container: Container;
  private readonly background: Graphics;
  private readonly staticLayer: Graphics;
  private readonly dynamicLayer: Graphics;
  private readonly cellSize: number;
  private readonly gridWidth: number;
  private readonly gridHeight: number;
  private app: Application;
  private cleanupKey: (() => void) | null = null;

  constructor(app: Application, opts: MiniMapOptions) {
    this.app = app;
    this.gridWidth = opts.gridWidth;
    this.gridHeight = opts.gridHeight;
    this.cellSize = MAP_SIZE_PX / Math.max(opts.gridWidth, opts.gridHeight);

    this.container = new Container({ label: 'minimap' });
    this.background = new Graphics()
      .roundRect(0, 0, MAP_SIZE_PX, MAP_SIZE_PX, 6)
      .fill({ color: 0x000000, alpha: 0.6 })
      .stroke({ width: 1, color: 0xa08050, alpha: 0.7 });

    this.staticLayer = new Graphics();
    for (const z of opts.pathZones) {
      this.staticLayer
        .rect(z.x * this.cellSize, z.y * this.cellSize, z.w * this.cellSize, z.h * this.cellSize)
        .fill({ color: 0x6e4a2c, alpha: 0.6 });
    }

    this.dynamicLayer = new Graphics();
    this.container.addChild(this.background, this.staticLayer, this.dynamicLayer);

    this.reposition();
    app.renderer.on('resize', () => this.reposition());

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'm' || e.key === 'M') this.container.visible = !this.container.visible;
    };
    window.addEventListener('keydown', onKey);
    this.cleanupKey = () => window.removeEventListener('keydown', onKey);
  }

  /** Redraws all dynamic dots from the world state. Called each frame. */
  update(world: World<Components>): void {
    if (!this.container.visible) return;
    const g = this.dynamicLayer.clear();

    for (const id of world.query(['Exit'])) {
      const e = world.getComponent(id, 'Exit');
      if (!e) continue;
      const color = e.kind === 'transition' ? 0xffd060 : 0x808080;
      this.dot(g, e.gx, e.gy, 4, color);
    }

    for (const id of world.query(['Faction', 'Position', 'Health'])) {
      const fac = world.getComponent(id, 'Faction');
      const pos = world.getComponent(id, 'Position');
      if (!fac || !pos) continue;
      if (fac.side === 'player') continue;
      const grid = worldToGrid(pos.x, pos.y);
      this.dot(g, Math.round(grid.x), Math.round(grid.y), 3, 0xff6060);
    }

    for (const id of world.query(['Player', 'Position'])) {
      const pos = world.getComponent(id, 'Position');
      if (!pos) continue;
      const grid = worldToGrid(pos.x, pos.y);
      this.dot(g, Math.round(grid.x), Math.round(grid.y), 4, 0x60d8ff);
    }
  }

  destroy(): void {
    this.cleanupKey?.();
    this.cleanupKey = null;
    this.container.destroy({ children: true });
  }

  private dot(g: Graphics, gx: number, gy: number, radius: number, color: number): void {
    if (gx < 0 || gy < 0 || gx >= this.gridWidth || gy >= this.gridHeight) return;
    g.circle((gx + 0.5) * this.cellSize, (gy + 0.5) * this.cellSize, radius).fill(color);
  }

  private reposition(): void {
    this.container.position.set(this.app.screen.width - MAP_SIZE_PX - PADDING, PADDING);
  }
}
