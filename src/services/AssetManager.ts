import type { Texture } from 'pixi.js';
import { Assets } from 'pixi.js';

/**
 * Asset manifest entry. All assets are textures since M8; placeholder support
 * is gone (entities that don't have an alias just rely on their Sprite
 * component's `shape`/`color` fallback in RenderSystem).
 */
export interface TextureAsset {
  kind: 'texture';
  url: string;
}

const MANIFEST = {
  // Dart sprite (M8) — central hero shot extracted from `jau5sf...png` via rembg.
  'sprite.player.dart': { kind: 'texture', url: '/assets/sprites/player/dart.png' },
  // Attack pose used during AttackSwing — central hero shot from `htn4pr...png`.
  'sprite.player.dart.attack': { kind: 'texture', url: '/assets/sprites/player/dart-attack.png' },
  // Defend pose held while the Defending component is present.
  'sprite.player.dart.defend': { kind: 'texture', url: '/assets/sprites/player/dart-defend.png' },
  // Double Slash 2nd-hit pose. The 1st hit reuses sprite.player.dart.attack.
  'sprite.player.dart.doubleSlash.2': {
    kind: 'texture',
    url: '/assets/sprites/player/dart-doubleSlash-2.png',
  },
  // Dart portrait used in the HUD (top-left of the screen, in the portrait slot).
  'ui.portrait.dart': { kind: 'texture', url: '/assets/ui/dart-portrait.png' },
  // Main menu background (TLoD title screen).
  'ui.mainscreen': { kind: 'texture', url: '/assets/ui/mainscreen.png' },
  // Animated attack cursor frames — cycled by CursorOverlay when hovering an enemy.
  'cursor.sword.1': { kind: 'texture', url: '/assets/ui/cursor/sword-1.png' },
  'cursor.sword.2': { kind: 'texture', url: '/assets/ui/cursor/sword-2.png' },
  'cursor.sword.3': { kind: 'texture', url: '/assets/ui/cursor/sword-3.png' },

  // Item icons (used both in the world-drop sprite and the Hotbar slot badge).
  'sprite.item.healingPotion': { kind: 'texture', url: '/assets/items/healing-potion.png' },
  'sprite.item.burnOut': { kind: 'texture', url: '/assets/items/burn-out.png' },

  // Spell impact VFX textures — drawn by VfxSystem (sprite-based kinds).
  'vfx.fireImpact': { kind: 'texture', url: '/assets/vfx/burn-out.png' },

  // NPC sprites.
  'sprite.npc.merchant': { kind: 'texture', url: '/assets/sprites/npc/merchant.png' },

  // M8 mob textures extracted from `02 Forest.png` showcase via rembg.
  'sprite.mob.berserkMouse': { kind: 'texture', url: '/assets/sprites/mobs/berserkMouse.png' },
  'sprite.mob.berserkMouse.attack': {
    kind: 'texture',
    url: '/assets/sprites/mobs/berserkMouse-attack.png',
  },
  'sprite.mob.berserkMouse.death': {
    kind: 'texture',
    url: '/assets/sprites/mobs/berserkMouse-death.png',
  },
  'sprite.mob.goblin': { kind: 'texture', url: '/assets/sprites/mobs/goblin.png' },
  'sprite.mob.goblin.attack': { kind: 'texture', url: '/assets/sprites/mobs/goblin-attack.png' },
  'sprite.mob.goblin.death': { kind: 'texture', url: '/assets/sprites/mobs/goblin-death.png' },
  'sprite.mob.assassinCock': { kind: 'texture', url: '/assets/sprites/mobs/assassinCock.png' },
  'sprite.mob.assassinCock.attack': {
    kind: 'texture',
    url: '/assets/sprites/mobs/assassinCock-attack.png',
  },
  'sprite.mob.assassinCock.death': {
    kind: 'texture',
    url: '/assets/sprites/mobs/assassinCock-death.png',
  },
  'sprite.mob.trent': { kind: 'texture', url: '/assets/sprites/mobs/trent.png' },
  'sprite.mob.trent.attack': { kind: 'texture', url: '/assets/sprites/mobs/trent-attack.png' },
  'sprite.mob.trent.death': { kind: 'texture', url: '/assets/sprites/mobs/trent-death.png' },

  // M8 forest tiles.
  // Ground = first Gemini grass variant (sampled into iso-diamond Graphics fills,
  // so its white bg is naturally clipped by the polygon shape).
  // Path = procedurally generated dirt texture (256x128, edge-to-edge, no border)
  // matching the TLoD `01.png` forest reference palette.
  'tile.forest.ground': { kind: 'texture', url: '/assets/tiles/forest/grass-procedural.png' },
  'tile.forest.path.1': { kind: 'texture', url: '/assets/tiles/forest/dirt-procedural.png' },

  // 16 tree variants (rows 1+2 of Gemini sheet B).
  'sprite.prop.tree.1': { kind: 'texture', url: '/assets/sprites/props/tree-01.png' },
  'sprite.prop.tree.2': { kind: 'texture', url: '/assets/sprites/props/tree-02.png' },
  'sprite.prop.tree.3': { kind: 'texture', url: '/assets/sprites/props/tree-03.png' },
  'sprite.prop.tree.4': { kind: 'texture', url: '/assets/sprites/props/tree-04.png' },
  'sprite.prop.tree.5': { kind: 'texture', url: '/assets/sprites/props/tree-05.png' },
  'sprite.prop.tree.6': { kind: 'texture', url: '/assets/sprites/props/tree-06.png' },
  'sprite.prop.tree.7': { kind: 'texture', url: '/assets/sprites/props/tree-07.png' },
  'sprite.prop.tree.8': { kind: 'texture', url: '/assets/sprites/props/tree-08.png' },
  'sprite.prop.tree.9': { kind: 'texture', url: '/assets/sprites/props/tree-09.png' },
  'sprite.prop.tree.10': { kind: 'texture', url: '/assets/sprites/props/tree-10.png' },
  'sprite.prop.tree.11': { kind: 'texture', url: '/assets/sprites/props/tree-11.png' },
  'sprite.prop.tree.12': { kind: 'texture', url: '/assets/sprites/props/tree-12.png' },
  'sprite.prop.tree.13': { kind: 'texture', url: '/assets/sprites/props/tree-13.png' },
  'sprite.prop.tree.14': { kind: 'texture', url: '/assets/sprites/props/tree-14.png' },
  'sprite.prop.tree.15': { kind: 'texture', url: '/assets/sprites/props/tree-15.png' },
  'sprite.prop.tree.16': { kind: 'texture', url: '/assets/sprites/props/tree-16.png' },
  // Cliff blocks (used as 'rock' props).
  'sprite.prop.rock.1': { kind: 'texture', url: '/assets/sprites/props/rock-01.png' },
  'sprite.prop.rock.2': { kind: 'texture', url: '/assets/sprites/props/rock-02.png' },
  'sprite.prop.rock.3': { kind: 'texture', url: '/assets/sprites/props/rock-03.png' },
  'sprite.prop.rock.4': { kind: 'texture', url: '/assets/sprites/props/rock-04.png' },
  // Gnarled props.
  'sprite.prop.log.1': { kind: 'texture', url: '/assets/sprites/props/log-01.png' },
  'sprite.prop.stump.1': { kind: 'texture', url: '/assets/sprites/props/stump-01.png' },
  'sprite.prop.branch.1': { kind: 'texture', url: '/assets/sprites/props/branch-01.png' },
  'sprite.prop.vine.1': { kind: 'texture', url: '/assets/sprites/props/vine-01.png' },
} as const satisfies Record<string, TextureAsset>;

export type AssetAlias = keyof typeof MANIFEST;

const TEXTURES = new Map<AssetAlias, Texture>();

export const AssetManager = {
  /** Preload every texture-kind asset so getTexture() can be called synchronously by RenderSystem. */
  async preload(): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    for (const alias of Object.keys(MANIFEST) as AssetAlias[]) {
      const asset = MANIFEST[alias];
      if (asset.kind === 'texture') {
        tasks.push(
          Assets.load(asset.url).then((tex) => {
            const texture = tex as Texture;
            // Tile textures need REPEAT wrap so polygon-fill samples wrap across
            // the texture boundary (otherwise Pixi clamps to edge and we see seams
            // between adjacent iso diamonds). Sprite textures keep the default.
            if (alias.startsWith('tile.')) {
              texture.source.style.addressMode = 'repeat';
            }
            TEXTURES.set(alias, texture);
          }),
        );
      }
    }
    await Promise.all(tasks);
  },

  get(alias: AssetAlias): TextureAsset {
    const a = MANIFEST[alias];
    if (!a) throw new Error(`Unknown asset alias: ${alias}`);
    return a;
  },

  getTexture(alias: AssetAlias): Texture | null {
    return TEXTURES.get(alias) ?? null;
  },
} as const;
