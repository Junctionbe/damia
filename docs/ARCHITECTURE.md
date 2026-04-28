# ARCHITECTURE — Damia

> État fonctionnel et organisation du code à un instant T.
> **À mettre à jour à la fin de chaque jalon.** Dernière mise à jour : fin M3.

---

## Sommaire

- [État fonctionnel actuel](#état-fonctionnel-actuel)
- [Vue en couches](#vue-en-couches)
- [Détail par dossier](#détail-par-dossier)
- [Flux runtime](#flux-runtime)
- [Historique des jalons](#historique-des-jalons)

---

## État fonctionnel actuel

**Jalon courant :** M3 ✅ done — prêt pour M4.

**Ce qui marche aujourd'hui :**

- **Forêt de Seles 32×32** avec layout TLoD-fidèle :
  - Chemin principal nord-sud (4 tiles de large) en terre brune
  - Branche est-ouest (4 tiles de haut) connectant au chemin principal
  - Reste : herbe verte (damier 2 tons)
- **52 props** placés autour du chemin : trees, rocks, logs, roots — tous bloquants
- **Dart spawn** au nord (case 16, 2)
- **Pathfinding** : Dart contourne tous les obstacles (props bloquent la grille easystarjs)
- **Sortie sud (16, 31)** : trigger → bascule sur `DemoEndScene` (écran noir + texte "Demo End / Hellena Prison ahead")
- **Sortie ouest (0, 16)** : trigger → toast "Path overgrown" (fade 2.7s) — Dart peut s'y rendre mais rien ne se passe (cohérent avec PS1)
- **Toast system** : multi-stack bottom-center avec fade in/out
- **i18n stub** : `t('key')` retourne traduction ou la clé brute, params interpolation `{name}`. M7 swappera l'implémentation pour i18next sans toucher aux call sites.
- Tous les acquis M0/M1/M2 (FPS overlay, drag/zoom caméra, camera follow `C`, click-to-move, ECS)

**Ce qui n'existe pas encore :**

- Aucun ennemi, aucun combat
- Aucune statistique RPG (HP/MP/ATK/DEF)
- Aucune sauvegarde, aucun audio
- Aucun asset graphique réel (formes Pixi.Graphics uniquement)
- Pas encore de HUD (HP bar, mini-map)

---

## Vue en couches

5 couches strictes, dépendance descendante uniquement.

```
┌─────────────────────────────────────────────┐
│  scenes/         ← orchestre les niveaux     │
├─────────────────────────────────────────────┤
│  gameplay/       ← logique de jeu (ECS)      │
│  ui/             ← Toast (M3), HUD (M6+)     │
├─────────────────────────────────────────────┤
│  rendering/      ← Pixi pur                  │
│  services/       ← AssetManager, I18n stub   │
│  data/           ← définitions props (M3)    │
├─────────────────────────────────────────────┤
│  core/           ← maths, ECS engine, events │
└─────────────────────────────────────────────┘
```

**Règles strictes :**

- `core/` ne dépend de RIEN (pas même Pixi)
- `rendering/` ne touche pas la logique de jeu, mais peut connaître les **types** des components (RenderSystem est l'exception assumée qui bridge)
- `gameplay/` ne touche pas Pixi directement (passe par le component `Sprite` consommé par RenderSystem)
- `scenes/` orchestre, ne contient pas de logique métier
- `data/` contient uniquement des structures de données statiques (pas de logique métier ni de Pixi)
- `ui/` peut utiliser Pixi (HUD = visuel) et `services/I18nService.t()` mais pas le gameplay
- Imports circulaires interdits

---

## Détail par dossier

### `src/core/` — fondations sans dépendance

| Fichier                                             | Rôle                                                                                                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/core/math/Vec2.ts](../src/core/math/Vec2.ts)   | Vecteur 2D + helpers.                                                                                                                                                                                     |
| [src/core/math/iso.ts](../src/core/math/iso.ts)     | `TILE_W=128`, `TILE_H=64` (ratio 2:1). `gridToWorld`, `worldToGrid`, `isoZIndex`.                                                                                                                         |
| [src/core/ecs/Entity.ts](../src/core/ecs/Entity.ts) | `Entity = number`.                                                                                                                                                                                        |
| [src/core/ecs/World.ts](../src/core/ecs/World.ts)   | Map-of-Maps storage. `createEntity`, `destroyEntity`, `addComponent`, `getComponent`, `hasComponent`, `removeComponent`, `query(names[])` (itère sur le store le plus petit). Generic `R extends object`. |
| [src/core/ecs/System.ts](../src/core/ecs/System.ts) | `interface System<R> { update(dt, world); destroy?() }`.                                                                                                                                                  |

### `src/data/` — données statiques

| Fichier                                   | Rôle                                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/data/props.ts](../src/data/props.ts) | `PropKind = 'tree' \| 'rock' \| 'log' \| 'roots'`. `PROPS` map kind → `{ blocks, sprite }`. `propBlocks(kind)` exporté pour MapLoader. M4-M5 ajouteront `mobs.ts`, `items.ts`, `balance.ts`. |

### `src/rendering/` — couche Pixi pure

| Fichier                                                                           | Rôle                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/rendering/Renderer.ts](../src/rendering/Renderer.ts)                         | `createRenderer()` initialise Pixi v8 (resizeTo window, devicePixelRatio, antialias, preferWebGPU). `describeRenderer()`.                                                                       |
| [src/rendering/Camera.ts](../src/rendering/Camera.ts)                             | Wrapper `pixi-viewport`. Drag clic molette uniquement, zoom molette clampé, resize.                                                                                                             |
| [src/rendering/Layers.ts](../src/rendering/Layers.ts)                             | 4 conteneurs : ground, entities (`sortableChildren`), fx, ui.                                                                                                                                   |
| [src/rendering/TileMap.ts](../src/rendering/TileMap.ts)                           | **M3 placeholder.** Dessine la grille iso avec damier 2-tons + path zones rectangulaires en dirt brun. Sera remplacé par `@pixi/tilemap` + textures réelles en M6.                              |
| [src/rendering/debug/DebugOverlay.ts](../src/rendering/debug/DebugOverlay.ts)     | FPS + renderer, zIndex 1000.                                                                                                                                                                    |
| [src/rendering/systems/RenderSystem.ts](../src/rendering/systems/RenderSystem.ts) | Bridge ECS → Pixi. Gère 7 shapes : capsule/circle/diamond (centered) + tree/rock/log/roots (base-anchored sur tile bottom point via `+TILE_HALF_H`). Cleanup auto. Sync zIndex iso (`gx + gy`). |

### `src/gameplay/` — logique de jeu (ECS)

| Fichier                                                                                   | Rôle                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/gameplay/components/Position.ts](../src/gameplay/components/Position.ts)             | `{ x, y }` world.                                                                                                                               |
| [src/gameplay/components/Velocity.ts](../src/gameplay/components/Velocity.ts)             | `{ vx, vy }` (inutilisé encore).                                                                                                                |
| [src/gameplay/components/Sprite.ts](../src/gameplay/components/Sprite.ts)                 | Visual config Pixi-agnostic. Shapes étendues à 7 formes en M3.                                                                                  |
| [src/gameplay/components/Player.ts](../src/gameplay/components/Player.ts)                 | Marker.                                                                                                                                         |
| [src/gameplay/components/Pathfinder.ts](../src/gameplay/components/Pathfinder.ts)         | `{ targetGrid, waypoints, computing }`.                                                                                                         |
| [src/gameplay/components/Speed.ts](../src/gameplay/components/Speed.ts)                   | `{ value }` px/ms.                                                                                                                              |
| [src/gameplay/components/Collider.ts](../src/gameplay/components/Collider.ts)             | **M3.** `{ gx, gy, blocks }` — marque l'occupation d'une cellule. Lu par MapLoader pour construire la grille easystar.                          |
| [src/gameplay/components/Exit.ts](../src/gameplay/components/Exit.ts)                     | **M3.** Discriminated union `transition` (avec `targetScene`) ou `blocked` (avec `messageKey`). Lu par ExitSystem.                              |
| [src/gameplay/components/index.ts](../src/gameplay/components/index.ts)                   | Registre `Components` (8 components).                                                                                                           |
| [src/gameplay/entities/player.ts](../src/gameplay/entities/player.ts)                     | `spawnPlayer(world, { gx, gy, speed? })` Dart factory.                                                                                          |
| [src/gameplay/entities/props/index.ts](../src/gameplay/entities/props/index.ts)           | **M3.** `spawnProp(world, { kind, gx, gy })` — assemble Position + Sprite + Collider depuis `PROPS[kind]`.                                      |
| [src/gameplay/entities/props/exit.ts](../src/gameplay/entities/props/exit.ts)             | **M3.** `spawnExit(world, exit)` — entité invisible avec Position + Exit.                                                                       |
| [src/gameplay/controls/InputController.ts](../src/gameplay/controls/InputController.ts)   | Clic gauche/droit grille → MoveCommand, key `C` toggle camera follow.                                                                           |
| [src/gameplay/systems/PathfindingSystem.ts](../src/gameplay/systems/PathfindingSystem.ts) | easystarjs avec diagonals on, corner-cutting off.                                                                                               |
| [src/gameplay/systems/MovementSystem.ts](../src/gameplay/systems/MovementSystem.ts)       | Suit waypoints à vitesse constante.                                                                                                             |
| [src/gameplay/systems/ExitSystem.ts](../src/gameplay/systems/ExitSystem.ts)               | **M3.** Détecte player sur cellule d'Exit, fire `onTrigger` callback. Anti-spam : ne re-trigger qu'après être sorti puis revenu sur la cellule. |

### `src/services/` — singletons applicatifs

| Fichier                                                         | Rôle                                                                                                                             |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [src/services/AssetManager.ts](../src/services/AssetManager.ts) | M2 manifest procédural placeholder. M6 ajoutera `kind: 'texture'`.                                                               |
| [src/services/I18nService.ts](../src/services/I18nService.ts)   | **M3 stub.** `t(key, params?)`. Map de traductions inline. Fallback : retourne la clé. M7 remplace l'implémentation par i18next. |

### `src/ui/` — UI Pixi (hors HUD pour l'instant)

| Fichier                               | Rôle                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [src/ui/Toast.ts](../src/ui/Toast.ts) | **M3.** Toast bottom-center fade in/out (150 / 2200 / 400ms), multi-stack. Sera supplanté par `ActionLog` en M6. |

### `src/scenes/` — orchestration

| Fichier                                                                               | Rôle                                                                                                                                                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/scenes/Scene.ts](../src/scenes/Scene.ts)                                         | Interface.                                                                                                                                                                         |
| [src/scenes/SceneManager.ts](../src/scenes/SceneManager.ts)                           | Switch entre scènes.                                                                                                                                                               |
| [src/scenes/BootScene.ts](../src/scenes/BootScene.ts)                                 | Bascule sur ForestScene.                                                                                                                                                           |
| [src/scenes/DemoEndScene.ts](../src/scenes/DemoEndScene.ts)                           | **M3.** Écran noir avec titre `t('exits.demoEndTitle')` + sous-titre. Pas d'interaction.                                                                                           |
| [src/scenes/ForestOfSeles/map.json](../src/scenes/ForestOfSeles/map.json)             | **M3.** Données du niveau : size, spawn, pathZones (2 rectangles), 52 props, 2 exits.                                                                                              |
| [src/scenes/ForestOfSeles/MapLoader.ts](../src/scenes/ForestOfSeles/MapLoader.ts)     | **M3.** Types `MapData`, `MapPathZone`, `MapProp`, `MapExit`. Helpers `isInPathZone`, `buildCollisionGrid`. Importe `map.json` directement.                                        |
| [src/scenes/ForestOfSeles/ForestScene.ts](../src/scenes/ForestOfSeles/ForestScene.ts) | Lit `ForestMap`, build TileMap (avec pathZones), spawn player + props + exits, ExitSystem wired pour transition vers DemoEndScene OU toast pour blocked. Cleanup complet à exit(). |

### `src/Game.ts` & `src/main.ts`

Inchangés depuis M2.

### Dossiers vides (préparés pour la suite)

| Dossier                                                       | Quand il se remplira                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| [src/gameplay/entities/mobs/](../src/gameplay/entities/mobs/) | M5 : Berserk Mouse, Goblin, Assassin Cock, Trent factories. |
| [src/data/](../src/data/)                                     | M4-M5 : `mobs.ts`, `items.ts`, `balance.ts`.                |
| [src/services/](../src/services/)                             | M7 : AudioManager, SaveManager.                             |
| [src/store/](../src/store/)                                   | M2+ : zustand stores (player, world, ui).                   |

### Tests

| Fichier                                             | Couverture              |
| --------------------------------------------------- | ----------------------- |
| [tests/core/iso.test.ts](../tests/core/iso.test.ts) | 4 tests projection iso. |
| [tests/core/ecs.test.ts](../tests/core/ecs.test.ts) | 5 tests World ECS.      |

---

## Flux runtime

```
1. main.ts → Game.start()
2. Game crée renderer + DebugOverlay + scenes.switchTo(BootScene)
3. BootScene → ForestScene
4. ForestScene.enter():
   ├─ Charge ForestMap (depuis map.json importé)
   ├─ Crée TileMap avec pathZones (rendu damier vert + dirt brun)
   ├─ Crée Camera, monte Layers
   ├─ Crée World ECS
   ├─ spawnPlayer au point spawn (16, 2)
   ├─ Pour chaque prop du map: spawnProp (Position + Sprite + Collider)
   ├─ Pour chaque exit du map: spawnExit (Position + Exit)
   ├─ Build collision grid via MapLoader.buildCollisionGrid (lit propBlocks)
   ├─ Instancie Systems: Pathfinding(grid), Movement, Exit, Render(layers)
   ├─ Crée Toast attaché à layers.ui
   ├─ Wire ExitSystem.onTrigger:
   │     - kind=transition → switch DemoEndScene
   │     - kind=blocked → toast.show(t(messageKey))
   ├─ Centre caméra sur spawn
   └─ Crée InputController + wires
5. Tick:
   ├─ DebugOverlay update FPS
   ├─ ForestScene.update(dt):
   │  ├─ Pathfinding.update : findPath quand nouveau target, calculate() chaque frame
   │  ├─ Movement.update : avance le long des waypoints
   │  ├─ Exit.update : check si player sur cellule d'exit
   │  ├─ Render.update : sync Pixi nodes + zIndex
   │  └─ camera follow si activé
```

**Pipeline d'un déplacement vers un exit :**

```
clic sur (16, 31)
  → MoveCommand
  → Pathfinder.targetGrid set
  → PathfindingSystem calcule path autour des arbres
  → MovementSystem suit waypoints
  → ExitSystem: player atteint (16, 31)
  → onTrigger {kind: transition, targetScene: 'demo-end'}
  → SceneManager.switchTo(new DemoEndScene())
  → ForestScene.exit() : cleanup complet (input, systems, layers, viewport, world)
  → DemoEndScene.enter() : écran noir + texte
```

---

## Historique des jalons

### M0 — Setup ✅

Setup Vite + TS strict + PixiJS v8 + ESLint + Prettier + husky + arborescence.

### M1 — Scène iso + caméra ✅

Grille iso 32×32, drag/zoom caméra, FPS overlay.
Bug fixé : zIndex 1000 sur DebugOverlay.

### M2 — Player + clic-to-move ✅

ECS engine, 6 components (Position, Velocity, Sprite, Player, Pathfinder, Speed), AssetManager procédural, Dart factory, InputController, 3 systems (Pathfinding, Movement, Render). Camera drag déplacé sur clic molette.

### M3 — Décor forêt + collisions ✅

**Fonctionnel :** Forêt de Seles avec layout TLoD-fidèle, 52 props bloquants, Dart contourne les obstacles, 2 sorties (demo end + path overgrown).
**Créé :**

- `data/props.ts` (4 prop kinds + blocks flag)
- 2 nouveaux components : `Collider`, `Exit`
- 4 nouveaux SpriteShape : `tree`, `rock`, `log`, `roots` (base-anchored au pied du tile via `TILE_HALF_H` offset)
- `gameplay/entities/props/` : `spawnProp`, `spawnExit`
- `gameplay/systems/ExitSystem.ts`
- `services/I18nService.ts` (stub `t()`)
- `ui/Toast.ts` (multi-stack fade)
- `scenes/DemoEndScene.ts`
- `scenes/ForestOfSeles/map.json` (52 props + 2 path zones + 2 exits)
- `scenes/ForestOfSeles/MapLoader.ts` (types + helpers + buildCollisionGrid)
- TileMap accepte `pathZones` (rendu dirt brun)
- ForestScene complètement réécrite pour charger depuis map.json

### M4 — Combat MVP ⏳

À faire : Health, Stats components, balance.ts, click-on-entity intent, CombatSystem (cooldown, damage formula), floating damage numbers, défense `S`, Game Over → respawn.
