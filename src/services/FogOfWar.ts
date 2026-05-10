import { TILE_HALF_H, TILE_HALF_W } from '@core/math/iso';

/** Predicate the FogOfWar uses to decide whether a grid cell stops the LoS
 *  raycast. Returns true for cells with tall blockers (trees, boulders, walls);
 *  false for clear cells and low blockers (logs, stumps). */
export type SightBlocker = (gx: number, gy: number) => boolean;

/**
 * Per-zone fog-of-war state. Owns the `revealed[gx][gy]` grid that records
 * which cells the player has ever seen, and exposes the queries that the world
 * overlay (FogOfWarOverlay) and the MiniMap both rely on.
 *
 * Cells progress through three states from the renderer's perspective:
 *   1. Currently visible — `isCurrentlyVisible(gx, gy, px, py)` AND revealed.
 *   2. Memory — `isRevealed(gx, gy)` but NOT currently visible.
 *   3. Unknown — never revealed.
 *
 * Visibility check has two passes:
 *   - **Range** — Euclidean iso-screen distance ≤ `REVEAL_RADIUS_TILES ×
 *     tileDiagonal`. Chebyshev would give a diamond on screen (iso-projected
 *     square); Euclidean produces a true circle.
 *   - **Line of sight** — Bresenham raycast from the player to the candidate
 *     cell, stopping at the first sight-blocker (tree / rock / wall). Cells
 *     behind a blocker stay hidden. Skipped when no blocker predicate was
 *     supplied (peaceful zones, tests).
 *
 * Revealing happens cumulatively in `revealCellsAround(cx, cy)` using the
 * same combined check so the revealed set ALWAYS matches what the player has
 * actually seen. Persisted to the save under `fogByZone[zoneId]`.
 */
export class FogOfWar {
  /** Vision radius expressed in *grid cells along a cardinal axis* (e.g. 5 =
   *  the player can see 5 tiles to the north / south / east / west of their
   *  own cell). The on-screen radius is `tiles × √(W² + H²)` ≈ 358 px for
   *  TILE_HALF_W=64, TILE_HALF_H=32, tiles=5. Must stay in sync between the
   *  visibility query and the reveal pass — both rely on this constant. */
  static readonly REVEAL_RADIUS_TILES = 5;

  readonly width: number;
  readonly height: number;
  private revealed: boolean[][];
  /** Per-cell timestamp (ms, monotonic) of FIRST reveal. Null = never revealed.
   *  Cells seeded from the save start at timestamp 0 so they read as "fully
   *  faded long ago" — no replayed reveal animation on zone re-entry. */
  private revealedAtMs: (number | null)[][];
  /** Squared world-pixel radius cached at construction so the per-cell
   *  visibility check stays a few arithmetic ops. */
  private readonly maxR2: number;
  /** Optional sight-blocker callback. When set, cells behind a blocker (along
   *  the Bresenham line from the player) are NOT visible. */
  private readonly blocksSight: SightBlocker | null;

  constructor(
    width: number,
    height: number,
    blocksSight: SightBlocker | null = null,
    initial?: boolean[][],
  ) {
    this.width = width;
    this.height = height;
    this.blocksSight = blocksSight;
    const seedOk = !!initial && initial.length === width && initial[0]?.length === height;
    this.revealed = Array.from({ length: width }, (_, gx) =>
      Array.from({ length: height }, (_, gy) => (seedOk ? !!initial[gx]?.[gy] : false)),
    );
    this.revealedAtMs = Array.from({ length: width }, (_, gx) =>
      Array.from({ length: height }, (_, gy) => (seedOk && initial[gx]?.[gy] ? 0 : null)),
    );
    // Pre-compute (REVEAL_RADIUS_TILES × tileDiagonal)² in world px². One grid
    // step = (TILE_HALF_W, TILE_HALF_H) in world coords, so |step|² = W² + H².
    const r = FogOfWar.REVEAL_RADIUS_TILES;
    this.maxR2 = r * r * (TILE_HALF_W * TILE_HALF_W + TILE_HALF_H * TILE_HALF_H);
  }

  /** Mark all cells within Euclidean iso-screen distance of (cx, cy) as
   *  revealed. Idempotent. We scan the whole grid because the Euclidean disk
   *  in iso space doesn't fit cleanly in a chebyshev bounding box (cells in
   *  the diagonal screen direction can be in-radius at chebyshev ≈ R√(5/4)),
   *  and the grids are small enough (≤ 32×32 today) that the full sweep is
   *  cheap. Stamps the reveal timestamp for newly-revealed cells so the world
   *  overlay can animate them fading in. */
  revealCellsAround(cx: number, cy: number): void {
    const now = performance.now();
    for (let gx = 0; gx < this.width; gx++) {
      for (let gy = 0; gy < this.height; gy++) {
        if (!this.isCurrentlyVisible(gx, gy, cx, cy)) continue;
        const col = this.revealed[gx];
        const tCol = this.revealedAtMs[gx];
        if (col && tCol && !col[gy]) {
          col[gy] = true;
          tCol[gy] = now;
        }
      }
    }
  }

  isRevealed(gx: number, gy: number): boolean {
    return !!this.revealed[gx]?.[gy];
  }

  /** Milliseconds elapsed since this cell was first revealed, or null if it
   *  has never been revealed. Used by the world overlay to lerp the blackout
   *  alpha from 1 → 0 over the fade-in window. */
  revealAge(gx: number, gy: number, now: number): number | null {
    const t = this.revealedAtMs[gx]?.[gy];
    if (t === null || t === undefined) return null;
    return now - t;
  }

  /** Cell is in the player's line of sight RIGHT NOW. Two checks:
   *    1. Euclidean iso-screen distance ≤ max range (cheap, fails fast).
   *    2. Bresenham raycast from player → cell, stopping at sight-blockers.
   *  No-op LoS pass if the constructor wasn't given a blocker predicate
   *  (peaceful zones / tests with no obstacles to occlude). */
  isCurrentlyVisible(gx: number, gy: number, playerGx: number, playerGy: number): boolean {
    const dgx = gx - playerGx;
    const dgy = gy - playerGy;
    const dwx = (dgx - dgy) * TILE_HALF_W;
    const dwy = (dgx + dgy) * TILE_HALF_H;
    if (dwx * dwx + dwy * dwy > this.maxR2) return false;
    if (!this.blocksSight) return true;
    return this.hasLineOfSight(playerGx, playerGy, gx, gy);
  }

  /**
   * Bresenham-style raycast from (fromGx, fromGy) to (toGx, toGy). Returns
   * false as soon as we step into a sight-blocking cell BEFORE reaching the
   * destination. The source cell (player) is never tested — the player can't
   * occlude themselves — and the destination cell ISN'T tested either, so
   * looking AT a tree still reveals the tree's tile (you see its near face).
   *
   * Symmetric by construction: `hasLineOfSight(A, B)` and `hasLineOfSight(B,
   * A)` walk the same diagonal of cells, just in reverse order, so visibility
   * stays mutual.
   */
  private hasLineOfSight(fromGx: number, fromGy: number, toGx: number, toGy: number): boolean {
    const blocks = this.blocksSight;
    if (!blocks) return true;
    let x = fromGx;
    let y = fromGy;
    const dx = Math.abs(toGx - fromGx);
    const dy = -Math.abs(toGy - fromGy);
    const sx = fromGx < toGx ? 1 : -1;
    const sy = fromGy < toGy ? 1 : -1;
    let err = dx + dy;
    // Loop bounded by Manhattan distance; protects against any pathological
    // case where the line never reaches dest (shouldn't happen with valid
    // integer endpoints, but cheap insurance).
    const maxSteps = dx - dy + 1;
    for (let i = 0; i < maxSteps; i++) {
      if (x === toGx && y === toGy) return true;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      if (x === toGx && y === toGy) return true;
      if (blocks(x, y)) return false;
    }
    return true;
  }

  /** Snapshot of the revealed grid for the save file. Returns a deep copy so
   *  callers can serialise it without coupling to internal state. */
  exportRevealed(): boolean[][] {
    return this.revealed.map((col) => col.slice());
  }
}
