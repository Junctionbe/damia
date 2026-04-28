import { Container, Graphics } from 'pixi.js';
import { TILE_HALF_H, TILE_HALF_W, gridToWorld } from '@core/math/iso';

export interface TileMapPathZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileMapOptions {
  width: number;
  height: number;
  /** Two grass tones (alternated by checker pattern). */
  grassColors?: readonly [number, number];
  /** Two dirt tones (alternated by checker pattern) used inside path zones. */
  dirtColors?: readonly [number, number];
  /** Rectangular zones rendered as dirt path. Cells outside are grass. */
  pathZones?: readonly TileMapPathZone[];
}

const DEFAULT_GRASS: readonly [number, number] = [0x3a5a3f, 0x2e4a32];
const DEFAULT_DIRT: readonly [number, number] = [0x6e4a2c, 0x614127];

/**
 * M3 placeholder tilemap: per-tile checker, with optional rectangular path
 * zones rendered in dirt tones. Will be replaced by `@pixi/tilemap` + real
 * textures starting M6.
 */
export class TileMap {
  readonly container: Container;
  readonly width: number;
  readonly height: number;

  constructor(opts: TileMapOptions) {
    this.width = opts.width;
    this.height = opts.height;
    this.container = new Container({ label: 'tilemap' });

    const grass = opts.grassColors ?? DEFAULT_GRASS;
    const dirt = opts.dirtColors ?? DEFAULT_DIRT;
    const zones = opts.pathZones ?? [];
    this.draw(grass, dirt, zones);
  }

  private draw(
    grass: readonly [number, number],
    dirt: readonly [number, number],
    zones: readonly TileMapPathZone[],
  ): void {
    const g = new Graphics();
    for (let gy = 0; gy < this.height; gy++) {
      for (let gx = 0; gx < this.width; gx++) {
        const center = gridToWorld(gx, gy);
        const palette = this.isInZone(zones, gx, gy) ? dirt : grass;
        const color = palette[(gx + gy) % 2 === 0 ? 0 : 1];
        g.poly([
          center.x,
          center.y - TILE_HALF_H,
          center.x + TILE_HALF_W,
          center.y,
          center.x,
          center.y + TILE_HALF_H,
          center.x - TILE_HALF_W,
          center.y,
        ]);
        g.fill(color);
        g.stroke({ width: 1, color: 0x1a2b1d, alpha: 0.4 });
      }
    }
    this.container.addChild(g);
  }

  private isInZone(zones: readonly TileMapPathZone[], gx: number, gy: number): boolean {
    for (const z of zones) {
      if (gx >= z.x && gx < z.x + z.w && gy >= z.y && gy < z.y + z.h) return true;
    }
    return false;
  }

  worldBounds(): { width: number; height: number; minX: number; minY: number } {
    const left = gridToWorld(0, this.height - 1).x;
    const right = gridToWorld(this.width - 1, 0).x;
    const top = gridToWorld(0, 0).y;
    const bottom = gridToWorld(this.width - 1, this.height - 1).y;
    return {
      minX: left - TILE_HALF_W,
      minY: top - TILE_HALF_H,
      width: right - left + 2 * TILE_HALF_W,
      height: bottom - top + 2 * TILE_HALF_H,
    };
  }
}
