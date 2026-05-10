import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { GameContext } from '@/Game';
import type { Scene } from './Scene';
import type { SaveDataV5, ZoneId } from '@services/SaveManager';
import { AssetManager } from '@services/AssetManager';
import { playSfx } from '@services/AudioManager';
import { ForestScene } from './ForestOfSeles/ForestScene';
import { HellenaScene } from './HellenaPrison/HellenaScene';

interface ZoneMarker {
  id: ZoneId;
  label: string;
  /** Fractional position on the worldmap image (0..1 in both axes). Resolution-
   *  independent — the marker scales with the cover-fitted background. */
  fx: number;
  fy: number;
}

/**
 * Damia's overworld navigation. Real implementation now (was a gradient
 * placeholder until M9.x): the TLoD `00 World Map.png` illustration of Endiness
 * is the backdrop, with markers placed at known zone locations. Discovered
 * zones show a clickable marker; undiscovered zones are hidden behind a "fog of
 * war" cloud at their map position.
 *
 * No FoV here — the map is a strategic / navigation view, the player must see
 * the entire revealed world at once. Fog is static (revealed on first visit
 * and persisted in `discoveredZones`); compare the per-zone MiniMap fog which
 * advances continuously with exploration.
 */
export class WorldMapScene implements Scene {
  readonly name = 'world-map';

  private container: Container | null = null;
  private cleanups: Array<() => void> = [];

  /**
   * Master registry of every zone known to the world map. Each entry has a
   * fractional position on the backdrop image so the layout scales with cover-
   * fit. Add new zones here as they get registered in `ZoneId`. Coordinates
   * are eyeballed against `00 World Map.png` and refined by visual check.
   */
  private static readonly MARKERS: ZoneMarker[] = [
    { id: 'forest', label: 'Forêt de Seles', fx: 0.945, fy: 0.78 },
    { id: 'hellena', label: 'Prison Hellena', fx: 0.77, fy: 0.92 },
  ];

  constructor(private readonly saveData: SaveDataV5 | null = null) {}

  enter(ctx: GameContext): void {
    const { width: screenW, height: screenH } = ctx.app.screen;
    this.container = new Container({ label: 'world-map' });

    const tex = AssetManager.getTexture('ui.worldmap');
    // Cover-fit the worldmap image so it always fills the screen, with the
    // overflow cropped symmetrically (same approach as TitleScene). We compute
    // the cover scale + offset once, then place markers in those local coords.
    let bgW = screenW;
    let bgH = screenH;
    let bgOffsetX = 0;
    let bgOffsetY = 0;
    if (tex) {
      const cover = Math.max(screenW / tex.width, screenH / tex.height);
      bgW = tex.width * cover;
      bgH = tex.height * cover;
      bgOffsetX = (screenW - bgW) / 2;
      bgOffsetY = (screenH - bgH) / 2;
      const bg = new Sprite(tex);
      bg.scale.set(cover);
      bg.position.set(bgOffsetX, bgOffsetY);
      this.container.addChild(bg);
    } else {
      // Fallback if the texture didn't load — flat dark fill so the screen is
      // never blank (the markers still work, just without the illustration).
      this.container.addChild(new Graphics().rect(0, 0, screenW, screenH).fill(0x0e1a28));
    }

    // Header overlay — reads "Map of Endiness" already in the bg art, so we
    // keep a small subtitle hint instead of duplicating a big title.
    const hint = new Text({
      text: 'Choisissez une zone',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fill: 0xfaf6e8,
        fontStyle: 'italic',
        stroke: { color: 0x000000, width: 3 },
      },
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(screenW / 2, 16);
    this.container.addChild(hint);

    const discovered = new Set<ZoneId>(this.saveData?.discoveredZones ?? ['forest', 'hellena']);

    // Project a fractional coord on the source image to a screen pixel coord.
    const project = (fx: number, fy: number): { x: number; y: number } => ({
      x: bgOffsetX + fx * bgW,
      y: bgOffsetY + fy * bgH,
    });

    // Fog of war pass: draw a soft dark cloud at every undiscovered zone's
    // position. Static (no per-frame update) — fog only changes on zone
    // discovery, which mutates `discoveredZones` in the save and the next
    // WorldMap entry will redraw without that cloud.
    const fog = new Graphics();
    for (const marker of WorldMapScene.MARKERS) {
      if (discovered.has(marker.id)) continue;
      const p = project(marker.fx, marker.fy);
      // Concentric circles fake a soft radial gradient so we don't need a
      // generated texture for two clouds. Adjust radii if the cloud should
      // cover more / less of the surrounding region.
      fog
        .circle(p.x, p.y, 70)
        .fill({ color: 0x000814, alpha: 0.55 })
        .circle(p.x, p.y, 50)
        .fill({ color: 0x000814, alpha: 0.7 })
        .circle(p.x, p.y, 30)
        .fill({ color: 0x000814, alpha: 0.85 });
    }
    this.container.addChild(fog);

    // Markers — only for discovered zones. Hover tooltip is the label; click
    // switches to the zone (carrying the save through so progression follows).
    for (const marker of WorldMapScene.MARKERS) {
      if (!discovered.has(marker.id)) continue;
      const p = project(marker.fx, marker.fy);
      const node = this.makeMarker(marker.label, p.x, p.y, () => {
        playSfx('ui.click');
        const next: Scene =
          marker.id === 'forest' ? new ForestScene(this.saveData) : new HellenaScene(this.saveData);
        void ctx.scenes.switchTo(next, ctx);
      });
      this.container.addChild(node);
    }

    ctx.app.stage.addChild(this.container);
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

  /** Build a clickable marker: a glowing dot with a hover label. */
  private makeMarker(label: string, x: number, y: number, onClick: () => void): Container {
    const container = new Container({ label: `worldmap-marker-${label}` });
    container.position.set(x, y);

    // Outer glow + inner dot. Two-layer Graphics so hover can re-tint just the
    // inner dot without disturbing the halo.
    const glow = new Graphics().circle(0, 0, 14).fill({ color: 0xffd060, alpha: 0.35 });
    const dot = new Graphics()
      .circle(0, 0, 6)
      .fill(0xffd060)
      .stroke({ width: 1.5, color: 0x000000 });

    const tip = new Text({
      text: label,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 3 },
      },
    });
    tip.anchor.set(0.5, 1);
    tip.position.set(0, -16);
    tip.visible = false;

    container.addChild(glow, dot, tip);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', onClick);
    container.on('pointerover', () => {
      tip.visible = true;
      dot.tint = 0xffffff;
    });
    container.on('pointerout', () => {
      tip.visible = false;
      dot.tint = 0xffd060;
    });
    return container;
  }
}
