import type { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export interface CameraOptions {
  worldWidth: number;
  worldHeight: number;
  minZoom?: number;
  maxZoom?: number;
}

const DEFAULT_MIN_ZOOM = 0.5;
const DEFAULT_MAX_ZOOM = 2;

export function createCamera(app: Application, opts: CameraOptions): Viewport {
  const viewport = new Viewport({
    screenWidth: app.screen.width,
    screenHeight: app.screen.height,
    worldWidth: opts.worldWidth,
    worldHeight: opts.worldHeight,
    events: app.renderer.events,
  });

  // Middle mouse only: left/right are reserved for game actions (move/attack).
  viewport
    .drag({ mouseButtons: 'middle' })
    .pinch()
    .wheel({ smooth: 5 })
    .clampZoom({
      minScale: opts.minZoom ?? DEFAULT_MIN_ZOOM,
      maxScale: opts.maxZoom ?? DEFAULT_MAX_ZOOM,
    });

  // Keep the viewport sized to the window on resize.
  app.renderer.on('resize', (width: number, height: number) => {
    viewport.resize(width, height, opts.worldWidth, opts.worldHeight);
  });

  return viewport;
}
