import type { AI } from './AI';
import type { AttackCooldown } from './AttackCooldown';
import type { Collider } from './Collider';
import type { CombatIntent } from './CombatIntent';
import type { Defending } from './Defending';
import type { Exit } from './Exit';
import type { Faction } from './Faction';
import type { FloatingText } from './FloatingText';
import type { Health } from './Health';
import type { Interactable } from './Interactable';
import type { Item } from './Item';
import type { Pathfinder } from './Pathfinder';
import type { Player } from './Player';
import type { Position } from './Position';
import type { Speed } from './Speed';
import type { Sprite } from './Sprite';
import type { Stats } from './Stats';
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
  Health: Health;
  Stats: Stats;
  Faction: Faction;
  CombatIntent: CombatIntent;
  AttackCooldown: AttackCooldown;
  Defending: Defending;
  FloatingText: FloatingText;
  AI: AI;
  Item: Item;
  Interactable: Interactable;
}

export type ComponentName = keyof Components;

export type {
  AI,
  AttackCooldown,
  Collider,
  CombatIntent,
  Defending,
  Exit,
  Faction,
  FloatingText,
  Health,
  Interactable,
  Item,
  Pathfinder,
  Player,
  Position,
  Speed,
  Sprite,
  Stats,
  Velocity,
};
export type { AIBehavior } from './AI';
export type { GridCell, WorldPoint } from './Pathfinder';
export type { SpriteLayer, SpriteShape } from './Sprite';
export type { FactionSide } from './Faction';
