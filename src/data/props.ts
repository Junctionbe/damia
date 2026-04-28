import type { Sprite } from '@gameplay/components';

export type PropKind = 'tree' | 'rock' | 'log' | 'roots';

export interface PropDefinition {
  blocks: boolean;
  sprite: Omit<Sprite, 'layer'>;
}

export const PROPS: Record<PropKind, PropDefinition> = {
  tree: {
    blocks: true,
    sprite: { shape: 'tree', color: 0x2f6b3a, width: 64, height: 96 },
  },
  rock: {
    blocks: true,
    sprite: { shape: 'rock', color: 0x707a78, width: 56, height: 38 },
  },
  log: {
    blocks: true,
    sprite: { shape: 'log', color: 0x6e4a2c, width: 96, height: 26 },
  },
  roots: {
    blocks: true,
    sprite: { shape: 'roots', color: 0x4a3320, width: 70, height: 38 },
  },
};

export function propBlocks(kind: PropKind): boolean {
  return PROPS[kind].blocks;
}
