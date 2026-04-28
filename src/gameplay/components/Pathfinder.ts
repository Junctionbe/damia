export interface GridCell {
  gx: number;
  gy: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface Pathfinder {
  /** Logical destination on the grid; null = no destination. */
  targetGrid: GridCell | null;
  /** Remaining waypoints in world coords (cell centers); null until path is computed. */
  waypoints: WorldPoint[] | null;
  /** True while easystarjs is computing a path for this entity. */
  computing: boolean;
}
