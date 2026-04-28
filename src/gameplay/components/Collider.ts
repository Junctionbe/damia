/**
 * Marks an entity as occupying a single grid cell and blocking movement through it.
 * The pathfinding grid is built from these in MapLoader.buildCollisionGrid.
 * Future: AABB collision for moving entities (M4 combat range checks).
 */
export interface Collider {
  /** Logical grid cell occupied. */
  gx: number;
  gy: number;
  /** Whether this collider blocks movement; if false, it's a trigger zone (e.g. exits). */
  blocks: boolean;
}
