import type { Sprite } from '@gameplay/components';
import type { AssetAlias } from '@services/AssetManager';

export type PropKind = 'tree' | 'rock' | 'log' | 'roots';

export interface PropDefinition {
  /** Pathfinding-blocker: the player and mobs cannot enter this cell. */
  blocks: boolean;
  /** Sight-blocker: the FogOfWar's line-of-sight check stops at this cell.
   *  Tall props (trees, boulders) block sight; low ones (logs, stumps,
   *  vines) don't — you can see over them. */
  blocksSight: boolean;
  /** Base sprite config (shape + color used as fallback if textures fail to load). */
  sprite: Omit<Sprite, 'layer'>;
  /** Texture aliases — one is picked per spawn for visual variety. */
  textureVariants: AssetAlias[];
}

export const PROPS: Record<PropKind, PropDefinition> = {
  tree: {
    blocks: true,
    blocksSight: true,
    sprite: { shape: 'tree', color: 0x2f6b3a, width: 110, height: 130 },
    // M8 in-progress: only the new TLoD-style tree variant for now. Re-add the
    // 15 others once the user delivers them.
    textureVariants: ['sprite.prop.tree.1'],
  },
  rock: {
    blocks: true,
    blocksSight: true,
    sprite: { shape: 'rock', color: 0x707a78, width: 110, height: 100 },
    textureVariants: [
      'sprite.prop.rock.1',
      'sprite.prop.rock.2',
      'sprite.prop.rock.3',
      'sprite.prop.rock.4',
    ],
  },
  log: {
    blocks: true,
    blocksSight: false,
    sprite: { shape: 'log', color: 0x6e4a2c, width: 120, height: 70 },
    textureVariants: ['sprite.prop.log.1', 'sprite.prop.branch.1'],
  },
  // 'roots' uses Stump + Vine variants.
  roots: {
    blocks: true,
    blocksSight: false,
    sprite: { shape: 'roots', color: 0x4a3320, width: 110, height: 100 },
    textureVariants: ['sprite.prop.stump.1', 'sprite.prop.vine.1'],
  },
};

export function propBlocks(kind: PropKind): boolean {
  return PROPS[kind].blocks;
}

export function propBlocksSight(kind: PropKind): boolean {
  return PROPS[kind].blocksSight;
}

/** Stable variant pick: same (kind, gx, gy) always returns the same alias. */
export function pickPropVariant(kind: PropKind, gx: number, gy: number): AssetAlias | undefined {
  const variants = PROPS[kind].textureVariants;
  if (variants.length === 0) return undefined;
  const idx = Math.abs(gx * 31 + gy * 17 + kind.length) % variants.length;
  return variants[idx];
}
