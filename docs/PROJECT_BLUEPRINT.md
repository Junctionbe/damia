# PROJECT BLUEPRINT — Damia

> Architecture, conventions, structure, libs. À lire avant tout code.

---

## 1. Stack — versions exactes

```jsonc
// package.json (extrait, à créer en M0)
{
  "name": "damia",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "test": "vitest",
    "typecheck": "tsc --noEmit",
  },
  "dependencies": {
    "pixi.js": "^8.6.0",
    "@pixi/tilemap": "^5.0.0",
    "pixi-viewport": "^6.0.0",
    "zustand": "^5.0.0",
    "howler": "^2.2.4",
    "easystarjs": "^0.4.4",
    "i18next": "^24.0.0",
    "i18next-browser-languagedetector": "^8.0.0",
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vite-tsconfig-paths": "^5.1.0",
    "vitest": "^2.1.0",
    "@types/howler": "^2.2.12",
    "@types/easystarjs": "^0.4.5",
    "eslint": "^9.16.0",
    "@typescript-eslint/parser": "^8.18.0",
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.4.0",
    "husky": "^9.1.0",
    "lint-staged": "^15.2.0",
  },
}
```

**TypeScript strict obligatoire** (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`).

## 2. Structure des dossiers

```
damia/
├─ docs/                      # Cette doc
│  ├─ PROMPT_V2.md
│  ├─ PROJECT_BLUEPRINT.md
│  └─ ROADMAP_MVP.md
├─ public/                    # Servi tel quel par Vite
│  └─ favicon.ico
├─ assets/                    # Sources brutes (non bundlées directement)
│  ├─ tiles/
│  ├─ sprites/
│  ├─ ui/
│  └─ audio/
│     ├─ music/
│     └─ sfx/
├─ locales/
│  ├─ en.json
│  └─ fr.json
├─ src/
│  ├─ main.ts                 # Bootstrap Pixi App + Game
│  ├─ Game.ts                 # Orchestrateur racine (boucle, scene manager)
│  │
│  ├─ core/                   # Fondations réutilisables (zéro dépendance gameplay)
│  │  ├─ ecs/
│  │  │  ├─ Entity.ts
│  │  │  ├─ Component.ts
│  │  │  ├─ System.ts
│  │  │  └─ World.ts
│  │  ├─ events/
│  │  │  └─ EventBus.ts       # Pub/sub typé
│  │  ├─ math/
│  │  │  ├─ Vec2.ts
│  │  │  ├─ iso.ts            # screen<->grid conversion
│  │  │  └─ aabb.ts
│  │  └─ time/
│  │     └─ Clock.ts          # delta, fixed-step accumulator
│  │
│  ├─ rendering/              # Couche Pixi pure
│  │  ├─ Renderer.ts          # init Pixi App
│  │  ├─ Camera.ts            # wrapper pixi-viewport
│  │  ├─ Layers.ts            # ground / entities / fx / ui
│  │  ├─ TileMap.ts           # @pixi/tilemap iso
│  │  ├─ SpriteFactory.ts     # création sprites depuis AssetManager
│  │  └─ debug/
│  │     └─ DebugOverlay.ts   # FPS, grille iso, AABB
│  │
│  ├─ gameplay/               # Logique de jeu
│  │  ├─ components/          # ECS components (data only)
│  │  │  ├─ Position.ts
│  │  │  ├─ Velocity.ts
│  │  │  ├─ Sprite.ts
│  │  │  ├─ Health.ts
│  │  │  ├─ Stats.ts
│  │  │  ├─ Pathfinder.ts
│  │  │  ├─ Collider.ts
│  │  │  ├─ AI.ts
│  │  │  ├─ Player.ts
│  │  │  └─ Loot.ts
│  │  ├─ systems/             # ECS systems (logic)
│  │  │  ├─ MovementSystem.ts
│  │  │  ├─ PathfindingSystem.ts
│  │  │  ├─ CollisionSystem.ts
│  │  │  ├─ CombatSystem.ts
│  │  │  ├─ AISystem.ts
│  │  │  ├─ RenderSystem.ts
│  │  │  ├─ AnimationSystem.ts
│  │  │  └─ LootSystem.ts
│  │  ├─ entities/            # Factories pour créer des entités assemblées
│  │  │  ├─ player.ts
│  │  │  ├─ mobs/
│  │  │  │  ├─ berserkMouse.ts
│  │  │  │  ├─ goblin.ts
│  │  │  │  ├─ assassinCock.ts
│  │  │  │  └─ trent.ts
│  │  │  └─ props/
│  │  │     ├─ chest.ts
│  │  │     └─ merchant.ts
│  │  └─ controls/
│  │     └─ InputController.ts # mapping souris/clavier → intentions
│  │
│  ├─ scenes/                 # Niveaux / écrans
│  │  ├─ Scene.ts             # interface base
│  │  ├─ SceneManager.ts
│  │  ├─ BootScene.ts         # chargement initial
│  │  ├─ MenuScene.ts
│  │  └─ ForestOfSeles/
│  │     ├─ ForestScene.ts
│  │     ├─ map.json          # données zone (spawns, exits, props)
│  │     └─ README.md
│  │
│  ├─ data/                   # Données statiques (pas de logique)
│  │  ├─ mobs.ts              # stats par mob type
│  │  ├─ items.ts             # définitions items
│  │  ├─ zones.ts             # métadonnées zones
│  │  └─ balance.ts           # constantes équilibrage
│  │
│  ├─ ui/                     # HUD, menus, dialogues (Pixi-based)
│  │  ├─ Hud.ts
│  │  ├─ HealthBar.ts
│  │  ├─ MiniMap.ts
│  │  ├─ ActionLog.ts
│  │  ├─ ZoneTitle.ts
│  │  ├─ Hotbar.ts
│  │  └─ DialogBox.ts
│  │
│  ├─ services/               # Singletons applicatifs
│  │  ├─ AssetManager.ts      # chargement, cache, alias logique→fichier
│  │  ├─ AudioManager.ts      # howler wrapper, ducking, volume
│  │  ├─ SaveManager.ts       # localStorage, schema versioning
│  │  ├─ I18nService.ts       # i18next wrapper, t() global
│  │  └─ Settings.ts          # prefs user (volume, lang, fullscreen)
│  │
│  ├─ store/                  # zustand stores
│  │  ├─ playerStore.ts       # HP, SP, inventaire, position courante
│  │  ├─ worldStore.ts        # zone courante, flags story
│  │  └─ uiStore.ts           # état HUD, menus ouverts
│  │
│  └─ types/
│     └─ index.ts             # types partagés
│
├─ tests/                     # vitest
│  └─ core/
│     └─ ecs.test.ts
├─ .eslintrc.cjs
├─ .prettierrc
├─ tsconfig.json
├─ vite.config.ts
└─ index.html
```

## 3. Architecture en couches

```
┌──────────────────────────────────────────┐
│  scenes/  (orchestration des niveaux)    │
└──────────────────────────────────────────┘
            ↓ utilise ↓
┌──────────────────────────────────────────┐
│  gameplay/  (ECS: components + systems)  │
└──────────────────────────────────────────┘
            ↓ utilise ↓
┌──────────────────────────────────────────┐
│  rendering/  (Pixi pur)  +  services/    │
└──────────────────────────────────────────┘
            ↓ utilise ↓
┌──────────────────────────────────────────┐
│  core/  (ECS engine, math, events)       │
└──────────────────────────────────────────┘
```

**Règles strictes :**

- **`core/` ne dépend de RIEN** (pas même Pixi)
- **`rendering/` ne connaît pas `gameplay/`** (RenderSystem fait le pont)
- **`gameplay/` ne touche pas Pixi directement** (passe par `Sprite` component)
- **`scenes/` orchestre, ne contient pas de logique métier**
- **Imports circulaires interdits** (ESLint le détecte)

## 4. ECS — règles d'or

- **Components = data uniquement** (pas de méthode, juste des champs)
- **Systems = logique pure** sur les entités qui matchent un set de components
- **Entities = juste un ID** + bag de components
- Update loop ordonné : Input → AI → Pathfinding → Movement → Collision → Combat → Animation → Render

```ts
// Exemple : Health component
export interface Health {
  current: number;
  max: number;
  invulnUntil: number; // timestamp ms
}

// Exemple : CombatSystem (squelette)
export class CombatSystem extends System {
  query = ['Health', 'Position', 'Combat'];
  update(dt: number, world: World) {
    for (const entity of world.queryEntities(this.query)) {
      // logique combat
    }
  }
}
```

## 5. Conventions de code

### Nommage

- **Fichiers** : `PascalCase.ts` pour classes, `camelCase.ts` pour modules de fonctions, `kebab-case` pour assets
- **Classes / Types / Interfaces** : `PascalCase`
- **Variables / fonctions** : `camelCase`
- **Constantes globales** : `UPPER_SNAKE_CASE`
- **Components ECS** : nom = nom du fichier (pas de suffixe `Component`)
- **Systems ECS** : suffixe `System` obligatoire

### Style

- **Pas de classes 500 lignes** : si > 200, split.
- **Pas de `any`** sauf justification commentée.
- **Pas de `// TODO`** sans ticket associé dans `BACKLOG.md`.
- **Imports** : path aliases via `vite-tsconfig-paths` (`@core/*`, `@gameplay/*`, etc.).
- **Pas de logique dans le constructeur** au-delà de l'init des champs.
- **Préférer composition à héritage**.

### Commentaires

- **Par défaut, pas de commentaire**.
- Commentaire = WHY non évident uniquement (workaround, hidden constraint, magic number sourcé).
- Pas de docstring multi-paragraphe.

### Formatage

- **Prettier** verrouille tout : 2 espaces, single quotes, semi, trailing comma `all`, line width 100.
- **ESLint** bloque les anti-patterns (`no-floating-promises`, `no-unused-vars`, `consistent-return`, etc.).
- **Pre-commit hook (husky + lint-staged)** : lint + format auto sur les fichiers stagés.

## 6. AssetManager — le contrat clé

Chaque asset référencé par **alias logique**, jamais par chemin direct. Permet swap placeholder → vrai asset sans changement code.

```ts
// src/services/AssetManager.ts
const MANIFEST = {
  // Tiles
  'tile.forest.grass': '/assets/tiles/forest/grass.png',
  'tile.forest.path': '/assets/tiles/forest/path.png',

  // Sprites mobs
  'sprite.mob.berserkMouse': '/assets/sprites/mobs/berserk-mouse.json',
  'sprite.mob.goblin': '/assets/sprites/mobs/goblin.json',

  // Player
  'sprite.player.dart': '/assets/sprites/player/dart.json',

  // UI
  'ui.hud.frame': '/assets/ui/hud-frame.png',
  'ui.portrait.dart': '/assets/ui/portraits/dart.png',
} as const;

export type AssetAlias = keyof typeof MANIFEST;

class AssetManagerImpl {
  async load(aliases: AssetAlias[]): Promise<void> {
    /* ... */
  }
  get<T = Texture>(alias: AssetAlias): T {
    /* ... */
  }
}
```

**Phase placeholder** : le manifest pointe vers des PNG générés (capsules colorées). On ne touche que ce fichier pour passer aux vrais assets.

## 7. AudioManager

```ts
class AudioManagerImpl {
  playMusic(alias: AssetAlias, opts?: { loop?: boolean; fadeIn?: number }): void;
  stopMusic(fadeOut?: number): void;
  playSfx(alias: AssetAlias, opts?: { volume?: number; pitch?: number }): void;
  setMasterVolume(v: number): void; // 0..1
  setMusicVolume(v: number): void;
  setSfxVolume(v: number): void;
  duckMusic(factor: number, duration: number): void; // pour cinématiques
}
```

Auto-pause music sur `visibilitychange` (onglet caché).

## 8. SaveManager

```ts
interface SaveDataV1 {
  saveSchemaVersion: 1;
  player: { hp: number; sp: number; level: number; xp: number; gold: number };
  inventory: Array<{ itemId: string; qty: number }>;
  worldFlags: Record<string, boolean | number | string>;
  currentZone: string;
  spawnPoint: string;
  savedAt: number; // unix ms
  playtimeSeconds: number;
}

class SaveManagerImpl {
  save(data: SaveDataV1): void; // writes to localStorage
  load(): SaveDataV1 | null;
  delete(): void;
  migrate(raw: unknown): SaveDataV1 | null; // future-proof
}
```

Auto-save trigger : transition de zone, mort, `visibilitychange` hidden.

## 9. I18n

```ts
// usage
import { t } from '@services/I18nService';
zoneTitle.text = t('zones.forestOfSeles.name');
actionLog.push(t('actions.itemPicked', { item: t(`items.${itemId}.name`) }));
```

Structure JSON :

```json
{
  "zones": { "forestOfSeles": { "name": "Forest of Seles", "objective": "Find Hellena Prison" } },
  "items": { "healingPotion": { "name": "Healing Potion", "desc": "Restores 50 HP" } },
  "ui": { "demoEnd": "Demo End — Hellena Prison ahead" }
}
```

## 10. Coordonnées iso — convention

```ts
// Une grille logique (gridX, gridY) en cellules
// Une position monde (worldX, worldY) en pixels iso projetés

const TILE_W = 128; // largeur tile iso (px)
const TILE_H = 64; // hauteur tile iso (px)

export function gridToWorld(gx: number, gy: number): Vec2 {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

export function worldToGrid(wx: number, wy: number): Vec2 {
  return {
    x: (wx / (TILE_W / 2) + wy / (TILE_H / 2)) / 2,
    y: (wy / (TILE_H / 2) - wx / (TILE_W / 2)) / 2,
  };
}
```

Z-ordering : tri par `gridX + gridY` (plus loin = plus en arrière).

## 11. Boucle de jeu

```ts
// Game.ts (squelette)
class Game {
  private clock = new Clock();
  private world = new World();
  private systems: System[] = [
    /* dans l'ordre */
  ];

  start(): void {
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS));
  }

  private tick(deltaMs: number): void {
    const dt = this.clock.update(deltaMs);
    for (const system of this.systems) system.update(dt, this.world);
  }
}
```

**Fixed timestep** pour la physique/combat (60Hz), **variable** pour le rendering.

## 12. Performance — règles

- **Sprites batched** via Pixi v8 (auto)
- **InstancedTilemap** pour le terrain (`@pixi/tilemap`)
- **Object pooling** pour projectiles, FX, dégâts flottants
- **Culling** : entités hors caméra → pas update visuel (mais update logique reste)
- **Texture atlases** obligatoires (pas de PNG individuels au runtime)
- **Cible : 60 FPS sur laptop intégré, 144 FPS sur desktop GPU**

## 13. Tests

- **Tests unitaires** (vitest) sur `core/` et `gameplay/systems/` (logique pure)
- **Pas de test sur rendering/** (visuel = manuel)
- **Pas de coverage obligatoire** au MVP, mais les fonctions critiques (combat math, pathfinding queries, save migration) **doivent** avoir des tests

## 14. Accessibilité minimale

- Contrast HUD lisible
- Toutes actions au clavier accessibles (au moins en backup de la souris)
- Pas de flash épileptique > 3Hz

## 15. Git & versionning

- Branche principale : `main`
- Branches feature : `feat/<short-name>`
- Commits : style **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`)
- Tag de version sémantique à chaque jalon validé (`v0.1.0` = M1 done, etc.)

## 16. Anti-patterns interdits

- ❌ Logique gameplay dans un constructeur Pixi.Sprite
- ❌ Singleton mutable hors `services/`
- ❌ Texte hardcodé visible par le joueur (toujours `t()`)
- ❌ Magic numbers sans constante nommée dans `data/balance.ts`
- ❌ `setTimeout` pour la logique de jeu (utiliser le tick + accumulators)
- ❌ Import direct d'asset par chemin (toujours via AssetManager)
- ❌ Mutation de state hors zustand setters / ECS systems

---

Ce blueprint évolue. Chaque modif structurelle = PR avec discussion.
