import type { Application, FederatedPointerEvent } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { worldToGrid } from '@core/math/iso';

export type ClickButton = 'left' | 'right';

export interface ClickCommand {
  button: ClickButton;
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
 * - Left/right click on a grid cell → ClickCommand
 * - Key `C` → toggle camera follow
 * - Key `S` (down/up) → defend on/off
 *
 * Resolution from a click cell to "attack target vs move" lives in the scene.
 */
export class InputController {
  private clickListeners = new Set<Listener<ClickCommand>>();
  private cameraFollowListeners = new Set<Listener<boolean>>();
  private defendListeners = new Set<Listener<boolean>>();
  private slotListeners = new Set<Listener<number>>();
  private cameraFollowState = false;
  private defendState = false;
  private readonly cleanupFns: Array<() => void> = [];

  /**
   * Physical-key → hotbar slot index (0-based). We match `KeyboardEvent.code`
   * (layout-independent) so AZERTY users don't need Shift to trigger slot 1,
   * and so the numpad works the same as the top row.
   */
  private static readonly SLOT_CODES: Record<string, number> = {
    Digit1: 0,
    Numpad1: 0,
    Digit2: 1,
    Numpad2: 1,
    Digit3: 2,
    Numpad3: 2,
    Digit4: 3,
    Numpad4: 3,
    Digit5: 4,
    Numpad5: 4,
    Digit6: 5,
    Numpad6: 5,
    Digit7: 6,
    Numpad7: 6,
    Digit8: 7,
    Numpad8: 7,
  };

  constructor(opts: InputControllerOptions) {
    const { app, viewport, gridWidth, gridHeight } = opts;
    viewport.eventMode = 'static';
    viewport.cursor = 'pointer';

    const onPointerUp = (e: FederatedPointerEvent): void => {
      let button: ClickButton;
      if (e.button === 0) button = 'left';
      else if (e.button === 2) button = 'right';
      else return;

      const local = viewport.toWorld(e.global);
      const grid = worldToGrid(local.x, local.y);
      const gx = Math.round(grid.x);
      const gy = Math.round(grid.y);
      if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) return;
      const cmd: ClickCommand = { button, gx, gy };
      this.clickListeners.forEach((l) => l(cmd));
    };

    viewport.on('pointerup', onPointerUp);
    this.cleanupFns.push(() => viewport.off('pointerup', onPointerUp));

    const onContextMenu = (e: MouseEvent): void => e.preventDefault();
    app.canvas.addEventListener('contextmenu', onContextMenu);
    this.cleanupFns.push(() => app.canvas.removeEventListener('contextmenu', onContextMenu));

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'c' || e.key === 'C') {
        this.cameraFollowState = !this.cameraFollowState;
        this.cameraFollowListeners.forEach((l) => l(this.cameraFollowState));
      } else if ((e.key === 's' || e.key === 'S') && !this.defendState) {
        this.defendState = true;
        this.defendListeners.forEach((l) => l(true));
      } else if (!e.repeat) {
        const slot = InputController.SLOT_CODES[e.code];
        if (slot !== undefined) this.slotListeners.forEach((l) => l(slot));
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if ((e.key === 's' || e.key === 'S') && this.defendState) {
        this.defendState = false;
        this.defendListeners.forEach((l) => l(false));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.cleanupFns.push(() => window.removeEventListener('keydown', onKeyDown));
    this.cleanupFns.push(() => window.removeEventListener('keyup', onKeyUp));
  }

  onClick(listener: Listener<ClickCommand>): () => void {
    this.clickListeners.add(listener);
    return () => this.clickListeners.delete(listener);
  }

  onCameraFollowToggle(listener: Listener<boolean>): () => void {
    this.cameraFollowListeners.add(listener);
    return () => this.cameraFollowListeners.delete(listener);
  }

  onDefendChange(listener: Listener<boolean>): () => void {
    this.defendListeners.add(listener);
    return () => this.defendListeners.delete(listener);
  }

  onSlot(listener: Listener<number>): () => void {
    this.slotListeners.add(listener);
    return () => this.slotListeners.delete(listener);
  }

  /**
   * External dispatch points — the touch overlay (joystick + on-screen
   * buttons) drives the same event pipeline as keyboard / mouse by calling
   * these instead of synthesising fake DOM events. The scene's listeners
   * don't know or care which input source emitted them.
   */
  emitClick(cmd: ClickCommand): void {
    this.clickListeners.forEach((l) => l(cmd));
  }

  /** External dispatch for the defend toggle. Mirrors the `S` key behaviour
   *  (keydown → on, keyup → off) but lets the touch UI drive it as a tap-to-
   *  toggle (caller flips the state on each tap). */
  emitDefend(active: boolean): void {
    if (this.defendState === active) return;
    this.defendState = active;
    this.defendListeners.forEach((l) => l(active));
  }

  /** External dispatch for hotbar slot activation (0..7). Mirrors the
   *  number-key path so the touch hotbar can re-use the slot-resolve logic. */
  emitSlot(slotIdx: number): void {
    this.slotListeners.forEach((l) => l(slotIdx));
  }

  /** Current defend state — used by the touch UI's defend button to draw the
   *  ON/OFF visual from a single source of truth. */
  isDefending(): boolean {
    return this.defendState;
  }

  destroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns.length = 0;
    this.clickListeners.clear();
    this.cameraFollowListeners.clear();
    this.defendListeners.clear();
    this.slotListeners.clear();
  }
}
