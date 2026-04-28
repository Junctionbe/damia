import type { Collider } from './Collider';
import type { Exit } from './Exit';
import type { Pathfinder } from './Pathfinder';
import type { Player } from './Player';
import type { Position } from './Position';
import type { Speed } from './Speed';
import type { Sprite } from './Sprite';
import type { Velocity } from './Velocity';

/** Project-wide component registry. Add new components here when introducing them. */
export interface Components {
  Position: Position;
  Velocity: Velocity;
  Sprite: Sprite;
  Player: Player;
  Pathfinder: Pathfinder;
  Speed: Speed;
  Collider: Collider;
  Exit: Exit;
}

export type ComponentName = keyof Components;

export type { Collider, Exit, Pathfinder, Player, Position, Speed, Sprite, Velocity };
export type { GridCell, WorldPoint } from './Pathfinder';
export type { SpriteLayer, SpriteShape } from './Sprite';
