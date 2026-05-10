import type { PropKind } from '@data/props';
import type { MobKind } from '@data/balance';
import type { InteractableKind } from '@gameplay/entities/interactables';
import rawMap from './map.json';

export interface MapPathZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapProp {
  kind: PropKind;
  gx: number;
  gy: number;
}

import type { Exit } from '@gameplay/components';

export type MapExit = Exit;

export interface MapMob {
  kind: MobKind;
  gx: number;
  gy: number;
}

export interface MapInteractable {
  kind: InteractableKind;
  gx: number;
  gy: number;
  messageKey?: string;
}

export interface MapData {
  name: string;
  size: { w: number; h: number };
  spawn: { gx: number; gy: number };
  pathZones: MapPathZone[];
  props: MapProp[];
  exits: MapExit[];
  mobs: MapMob[];
  interactables: MapInteractable[];
  /** Wild zones (forests, dungeons) set this to true to enable D2-style FoV +
   *  forced camera-follow. Peaceful zones (towns, hubs) leave it false/unset
   *  so the player can pan/zoom freely and see the whole layout. */
  fov?: boolean;
}

const WALKABLE = 0;
const BLOCKED = 1;

export const ForestMap: MapData = rawMap as MapData;

/** Returns true if (gx, gy) lies inside any of the supplied path rectangles. */
export function isInPathZone(zones: readonly MapPathZone[], gx: number, gy: number): boolean {
  for (const z of zones) {
    if (gx >= z.x && gx < z.x + z.w && gy >= z.y && gy < z.y + z.h) return true;
  }
  return false;
}

/**
 * Builds the easystarjs collision grid: cells with a blocking prop are marked
 * as BLOCKED, everything else WALKABLE. Exits are walkable; their effect is
 * triggered by the ExitSystem when the player steps on them.
 */
export function buildCollisionGrid(
  map: MapData,
  propBlocks: (kind: PropKind) => boolean,
): number[][] {
  const grid: number[][] = Array.from({ length: map.size.h }, () =>
    new Array<number>(map.size.w).fill(WALKABLE),
  );
  for (const p of map.props) {
    if (propBlocks(p.kind)) {
      const row = grid[p.gy];
      if (row) row[p.gx] = BLOCKED;
    }
  }
  return grid;
}

/**
 * Builds the sight-blocking grid for the FogOfWar's line-of-sight check.
 * Cells with a sight-blocker (tall props: trees, boulders) prevent the LoS
 * raycast from reaching cells beyond them. Distinct from collision because
 * low props (logs, stumps) block movement but not vision — you can see
 * across them.
 *
 * Returns a `boolean[gy][gx]` matrix; consumers can wrap it with
 * `(gx, gy) => grid[gy]?.[gx] ?? false` to feed FogOfWar's predicate.
 */
export function buildSightBlockingGrid(
  map: MapData,
  propBlocksSight: (kind: PropKind) => boolean,
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: map.size.h }, () =>
    new Array<boolean>(map.size.w).fill(false),
  );
  for (const p of map.props) {
    if (propBlocksSight(p.kind)) {
      const row = grid[p.gy];
      if (row) row[p.gx] = true;
    }
  }
  return grid;
}
