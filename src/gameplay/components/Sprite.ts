import type { AssetAlias } from '@services/AssetManager';

export type SpriteShape = 'capsule' | 'circle' | 'diamond' | 'tree' | 'rock' | 'log' | 'roots';
export type SpriteLayer = 'ground' | 'entities' | 'fx';

/**
 * Pixi-agnostic visual config. The RenderSystem reads this and creates the actual Pixi node.
 *
 * If `textureAlias` is set, RenderSystem creates a `Pixi.Sprite` from the loaded
 * Texture (asset extracted from TLoD pack). Otherwise it falls back to a procedural
 * `Pixi.Graphics` using `shape` + `color` (used for Dart and any entity without a real asset).
 */
export interface Sprite {
  shape: SpriteShape;
  color: number;
  width: number;
  height: number;
  layer: SpriteLayer;
  /** Visual scale multiplier. Default 1. */
  scale?: number;
  /**
   * Texture-fit strategy (textured sprites only):
   *  - `'contain'` (default): fit to (width × height) box, preserving aspect (Math.min ratio).
   *  - `'height'`: fit by height only, width allowed to overflow. Use for characters
   *    so wider attack poses (sword out) keep the same on-screen height as the idle.
   */
  fitMode?: 'contain' | 'height';
  /** Asset alias (M8). If set, render as textured Pixi.Sprite instead of Graphics shape. */
  textureAlias?: AssetAlias;
  /** Optional alias used while the entity has an AttackSwing component (live texture swap). */
  attackTextureAlias?: AssetAlias;
  /** Optional alias used while the entity has a Defending component (held pose). */
  defendTextureAlias?: AssetAlias;
  /** Optional alias used while the entity has a Dying component. Triggers the death-animation pipeline. */
  deathTextureAlias?: AssetAlias;
  /**
   * Optional ordered alias frames played while the entity has an Addition component.
   * RenderSystem cycles through them by progress fraction, so a 2-frame array splits
   * the animation in halves, a 3-frame array in thirds, etc. (Currently shared across
   * additions on this sprite — fine while characters have one addition; revisit when
   * Dart unlocks Volcano / Burning Rush.)
   */
  additionTextureAliases?: readonly AssetAlias[];
}
