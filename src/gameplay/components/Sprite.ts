export type SpriteShape = 'capsule' | 'circle' | 'diamond' | 'tree' | 'rock' | 'log' | 'roots';
export type SpriteLayer = 'ground' | 'entities' | 'fx';

/**
 * Pixi-agnostic visual config. The RenderSystem reads this and creates the actual Pixi node.
 * In M6 a `textureAlias` field will be added so AssetManager can swap to real textures.
 */
export interface Sprite {
  shape: SpriteShape;
  color: number;
  width: number;
  height: number;
  layer: SpriteLayer;
}
