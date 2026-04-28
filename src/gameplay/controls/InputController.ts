import type { Application, FederatedPointerEvent } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { worldToGrid } from '@core/math/iso';

export interface MoveCommand {
  gx: number;
  gy: number;
}

type Listener<T> = (payload: T) => void;

export interface InputControllerOptions {
  app: Application;
  viewport: Viewport;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Translates raw browser input into game intentions.
 * - Left/right click on a grid cell → MoveCommand
 * - Key `C` → toggle camera follow
 *
 * In M4 this expands to: left click on entity → AttackCommand, key `S` → defend hold.
 */
export class InputController {
  private moveListeners = new Set<Listener<MoveCommand>>();
  private cameraFollowListeners = new Set<Listener<boolean>>();
  private cameraFollowState = false;
  private readonly cleanupFns: Array<() => void> = [];

  constructor(opts: InputControllerOptions) {
    const { app, viewport, gridWidth, gridHeight } = opts;
    viewport.eventMode = 'static';
    viewport.cursor = 'pointer';

    const onPointerUp = (e: FederatedPointerEvent): void => {
      // Left button (0) or right button (2). Middle (1) is reserved for camera drag.
      if (e.button !== 0 && e.button !== 2) return;
      const local = viewport.toWorld(e.global);
      const grid = worldToGrid(local.x, local.y);
      const gx = Math.round(grid.x);
      const gy = Math.round(grid.y);
      if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) return;
      const cmd: MoveCommand = { gx, gy };
      this.moveListeners.forEach((l) => l(cmd));
    };

    viewport.on('pointerup', onPointerUp);
    this.cleanupFns.push(() => viewport.off('pointerup', onPointerUp));

    // Disable browser context menu on right click within the canvas.
    const onContextMenu = (e: MouseEvent): void => e.preventDefault();
    app.canvas.addEventListener('contextmenu', onContextMenu);
    this.cleanupFns.push(() => app.canvas.removeEventListener('contextmenu', onContextMenu));

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'c' || e.key === 'C') {
        this.cameraFollowState = !this.cameraFollowState;
        this.cameraFollowListeners.forEach((l) => l(this.cameraFollowState));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    this.cleanupFns.push(() => window.removeEventListener('keydown', onKeyDown));
  }

  onMove(listener: Listener<MoveCommand>): () => void {
    this.moveListeners.add(listener);
    return () => this.moveListeners.delete(listener);
  }

  onCameraFollowToggle(listener: Listener<boolean>): () => void {
    this.cameraFollowListeners.add(listener);
    return () => this.cameraFollowListeners.delete(listener);
  }

  get cameraFollow(): boolean {
    return this.cameraFollowState;
  }

  destroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns.length = 0;
    this.moveListeners.clear();
    this.cameraFollowListeners.clear();
  }
}
