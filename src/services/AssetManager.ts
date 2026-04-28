import type { Sprite as SpriteComp, SpriteShape } from '@gameplay/components';

/**
 * Asset manifest entry. M2 only supports procedural placeholders. M6 will add
 * a `texture` kind backed by Pixi Texture loaded via assets bundles.
 */
export interface PlaceholderAsset {
  kind: 'placeholder';
  shape: SpriteShape;
  color: number;
  width: number;
  height: number;
}

const MANIFEST = {
  'sprite.player.dart': {
    kind: 'placeholder',
    shape: 'capsule',
    color: 0xc8201f,
    width: 28,
    height: 48,
  },
} as const satisfies Record<string, PlaceholderAsset>;

export type AssetAlias = keyof typeof MANIFEST;

/**
 * Singleton-style accessor. Stays trivial in M2; gains lazy load + cache + Pixi
 * Texture support starting M6 when real assets land.
 */
export const AssetManager = {
  get(alias: AssetAlias): PlaceholderAsset {
    const asset = MANIFEST[alias];
    if (!asset) throw new Error(`Unknown asset alias: ${alias}`);
    return asset;
  },

  /** Helper to derive a `Sprite` component directly from an alias. */
  toSpriteComponent(alias: AssetAlias, layer: SpriteComp['layer']): SpriteComp {
    const a = MANIFEST[alias];
    return {
      shape: a.shape,
      color: a.color,
      width: a.width,
      height: a.height,
      layer,
    };
  },
} as const;
