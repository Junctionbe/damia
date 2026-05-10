import type { Addition } from './Addition';
import type { AI } from './AI';
import type { AttackCooldown } from './AttackCooldown';
import type { AttackSwing } from './AttackSwing';
import type { Collider } from './Collider';
import type { CombatIntent } from './CombatIntent';
import type { Defending } from './Defending';
import type { Dying } from './Dying';
import type { Exit } from './Exit';
import type { Faction } from './Faction';
import type { FloatingText } from './FloatingText';
import type { Health } from './Health';
import type { Hidden } from './Hidden';
import type { Interactable } from './Interactable';
import type { Inventory } from './Inventory';
import type { Item } from './Item';
import type { Pathfinder } from './Pathfinder';
import type { Player } from './Player';
import type { Position } from './Position';
import type { Progression } from './Progression';
import type { RandomEncounter } from './RandomEncounter';
import type { SkillCooldown } from './SkillCooldown';
import type { Speed } from './Speed';
import type { Spell } from './Spell';
import type { Sprite } from './Sprite';
import type { Vfx } from './Vfx';
import type { Stats } from './Stats';

/** Project-wide component registry. Add new components here when introducing them. */
export interface Components {
  Position: Position;
  Sprite: Sprite;
  Player: Player;
  Pathfinder: Pathfinder;
  Speed: Speed;
  Collider: Collider;
  Exit: Exit;
  Health: Health;
  Hidden: Hidden;
  Stats: Stats;
  Faction: Faction;
  CombatIntent: CombatIntent;
  AttackCooldown: AttackCooldown;
  Defending: Defending;
  Dying: Dying;
  FloatingText: FloatingText;
  AI: AI;
  Item: Item;
  Inventory: Inventory;
  Interactable: Interactable;
  AttackSwing: AttackSwing;
  Addition: Addition;
  SkillCooldown: SkillCooldown;
  RandomEncounter: RandomEncounter;
  Spell: Spell;
  Vfx: Vfx;
  Progression: Progression;
}

export type ComponentName = keyof Components;

export type {
  Addition,
  AI,
  AttackCooldown,
  AttackSwing,
  Collider,
  CombatIntent,
  Defending,
  Dying,
  Exit,
  Faction,
  FloatingText,
  Health,
  Hidden,
  Interactable,
  Inventory,
  Item,
  Pathfinder,
  Player,
  Position,
  Progression,
  RandomEncounter,
  SkillCooldown,
  Spell,
  Speed,
  Sprite,
  Stats,
  Vfx,
};
export type { AIBehavior } from './AI';
export type { GridCell, WorldPoint } from './Pathfinder';
export type { SpriteLayer, SpriteShape } from './Sprite';
export type { FactionSide } from './Faction';
