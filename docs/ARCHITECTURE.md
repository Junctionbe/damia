# ARCHITECTURE — Damia

> État fonctionnel et organisation du code à un instant T.
> **À mettre à jour à la fin de chaque jalon.** Dernière mise à jour : fin M2.

---

## Sommaire

- [État fonctionnel actuel](#état-fonctionnel-actuel)
- [Vue en couches](#vue-en-couches)
- [Détail par dossier](#détail-par-dossier)
- [Flux runtime](#flux-runtime)
- [Historique des jalons](#historique-des-jalons)

---

## État fonctionnel actuel

**Jalon courant :** M2 ✅ done — prêt pour M3.

**Ce qui marche aujourd'hui :**

- Canvas plein écran avec fond vert sombre
- **Grille isométrique 32×32** de losanges en damier vert (deux nuances)
- **Dart** (capsule rouge bordée de noir) visible au centre de la grille (case 16,16)
- **Clic-to-move** : clic gauche **ou** clic droit sur n'importe quelle case → Dart pathfind via easystarjs et marche jusqu'à la cible à vitesse constante (≈180 px/s), mouvement linéaire entre waypoints
- **Camera drag** sur clic molette uniquement (clic gauche/droit réservés au gameplay)
- **Zoom molette** clampé entre 0.5x et 2x
- **Touche `C`** : toggle camera follow (la caméra suit Dart automatiquement)
- **Tri Z iso** : le sprite Dart est trié par profondeur (`gx + gy`) — important quand on aura plusieurs entités
- **Overlay FPS** en haut-gauche, toujours au-dessus de la scène
- Pipeline complet : dev/build/lint/typecheck/9 tests passent sans warning

**Ce qui n'existe pas encore :**

- Aucune collision (la grille est entièrement marchable)
- Aucun ennemi, aucun combat
- Aucun arbre / décor de forêt
- Aucun asset graphique (formes géométriques placeholders uniquement)
- Aucune sauvegarde, aucun audio, aucune i18n active

---

## Vue en couches

5 couches strictes, dépendance descendante uniquement.

```
┌─────────────────────────────────────────────┐
│  scenes/         ← orchestre les niveaux     │
├─────────────────────────────────────────────┤
│  gameplay/       ← logique de jeu (ECS)      │
├─────────────────────────────────────────────┤
│  rendering/      ← Pixi pur                  │
│  services/       ← AssetManager, etc.        │
├─────────────────────────────────────────────┤
│  core/           ← maths, ECS engine, events │
└─────────────────────────────────────────────┘
```

**Règles strictes :**

- `core/` ne dépend de RIEN (pas même Pixi)
- `rendering/` ne touche pas la logique de jeu, mais peut connaître les **types** des components (RenderSystem est l'exception assumée qui bridge)
- `gameplay/` ne touche pas Pixi directement (passe par le component `Sprite` consommé par RenderSystem)
- `scenes/` orchestre, ne contient pas de logique métier
- Imports circulaires interdits

---

## Détail par dossier

### `src/core/` — fondations sans dépendance

Code utilitaire qui ne connaît rien du reste, pas même Pixi. Réutilisable partout.

| Fichier                                             | Rôle                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/core/math/Vec2.ts](../src/core/math/Vec2.ts)   | Type vecteur 2D + helpers (add, sub, scale, distance, length).                                                                                                                                                                                                                                                      |
| [src/core/math/iso.ts](../src/core/math/iso.ts)     | **Cœur mathématique du jeu.** `TILE_W=128`, `TILE_H=64` (ratio 2:1 dimétrique). Conversions `gridToWorld(gx,gy)` ↔ `worldToGrid(wx,wy)`. `isoZIndex(gx,gy) = gx + gy` pour le tri par profondeur.                                                                                                                   |
| [src/core/ecs/Entity.ts](../src/core/ecs/Entity.ts) | `Entity = number`. Constante `NULL_ENTITY`.                                                                                                                                                                                                                                                                         |
| [src/core/ecs/World.ts](../src/core/ecs/World.ts)   | Stockage Map-of-Maps. API : `createEntity`, `destroyEntity`, `addComponent`, `getComponent`, `hasComponent`, `removeComponent`, `query(names[])`. Generic `R extends object` = registre projet (le projet définit `Components` dans `gameplay/components/`). `query` itère sur le store le plus petit pour la perf. |
| [src/core/ecs/System.ts](../src/core/ecs/System.ts) | Interface `System<R> { update(dt, world); destroy?() }`. Tous les systems l'implémentent.                                                                                                                                                                                                                           |
| [src/core/ecs/index.ts](../src/core/ecs/index.ts)   | Barrel export.                                                                                                                                                                                                                                                                                                      |

**Sous-dossiers prévus, vides aujourd'hui :** `core/events/` (EventBus), `core/time/` (Clock, fixed-step accumulator).

### `src/rendering/` — couche Pixi pure

Tout ce qui touche au rendu. Le `RenderSystem` est l'exception qui connaît les types de components (rôle de pont).

| Fichier                                                                           | Rôle                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [src/rendering/Renderer.ts](../src/rendering/Renderer.ts)                         | `createRenderer()` initialise Pixi v8 (resizeTo window, devicePixelRatio, antialias, preferWebGPU). `describeRenderer()` retourne "WebGPU" / "WebGL".                                                                          |
| [src/rendering/Camera.ts](../src/rendering/Camera.ts)                             | Wrapper `pixi-viewport`. **Drag clic molette uniquement** (left/right libres pour gameplay), zoom molette clampé, gestion du resize.                                                                                           |
| [src/rendering/Layers.ts](../src/rendering/Layers.ts)                             | 4 conteneurs nommés : `ground`, `entities` (avec `sortableChildren=true` pour tri Z iso), `fx`, `ui`.                                                                                                                          |
| [src/rendering/TileMap.ts](../src/rendering/TileMap.ts)                           | **M1 placeholder.** 32×32 losanges colorés via `Pixi.Graphics`. Sera remplacé par `@pixi/tilemap` + textures réelles en M3+.                                                                                                   |
| [src/rendering/debug/DebugOverlay.ts](../src/rendering/debug/DebugOverlay.ts)     | FPS instantané + moyenne 60 frames + nom du renderer. Reste au-dessus via `stage.sortableChildren + zIndex=1000`.                                                                                                              |
| [src/rendering/systems/RenderSystem.ts](../src/rendering/systems/RenderSystem.ts) | **Bridge ECS → Pixi.** Pour chaque entité avec `Position+Sprite` : crée un node `Graphics` (capsule/circle/diamond) si absent, sync sa position, calcule `zIndex` depuis la grille. Cleanup automatique des entités détruites. |

### `src/gameplay/` — logique de jeu (ECS)

| Fichier                                                                                   | Rôle                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [src/gameplay/components/](../src/gameplay/components/)                                   | Un fichier par component (data-only). `index.ts` définit le registre `Components` (les types) et exporte tout.                                                                       |
| [src/gameplay/components/Position.ts](../src/gameplay/components/Position.ts)             | `{ x, y }` en pixels world.                                                                                                                                                          |
| [src/gameplay/components/Velocity.ts](../src/gameplay/components/Velocity.ts)             | `{ vx, vy }` en pixels/ms (non utilisé encore en M2).                                                                                                                                |
| [src/gameplay/components/Sprite.ts](../src/gameplay/components/Sprite.ts)                 | Visual config Pixi-agnostic : `{ shape, color, width, height, layer }`. Ajoutera `textureAlias` en M6.                                                                               |
| [src/gameplay/components/Player.ts](../src/gameplay/components/Player.ts)                 | Marker (`Record<string, never>`).                                                                                                                                                    |
| [src/gameplay/components/Pathfinder.ts](../src/gameplay/components/Pathfinder.ts)         | `{ targetGrid, waypoints, computing }` — état du pathfind d'une entité.                                                                                                              |
| [src/gameplay/components/Speed.ts](../src/gameplay/components/Speed.ts)                   | `{ value }` en pixels/ms.                                                                                                                                                            |
| [src/gameplay/entities/player.ts](../src/gameplay/entities/player.ts)                     | `spawnPlayer(world, { gx, gy })` : assemble Dart (Player + Position + Velocity + Speed + Pathfinder + Sprite via AssetManager). Retourne l'`Entity`.                                 |
| [src/gameplay/controls/InputController.ts](../src/gameplay/controls/InputController.ts)   | Listen Pixi pointerup sur viewport + keydown global. Émet `MoveCommand` au clic gauche/droit grille, toggle `C` pour camera follow. Désactive le contextmenu navigateur.             |
| [src/gameplay/systems/PathfindingSystem.ts](../src/gameplay/systems/PathfindingSystem.ts) | Pour chaque entité avec `Pathfinder.targetGrid`, lance `easystar.findPath` async. Stocke le path en world coords. `easystar.calculate()` chaque frame. Diagonals on, corner-cut off. |
| [src/gameplay/systems/MovementSystem.ts](../src/gameplay/systems/MovementSystem.ts)       | Avance chaque entité le long de ses waypoints à `Speed.value * dt`. Boucle while pour consommer plusieurs waypoints courts dans une frame. Snap à `ARRIVAL_EPSILON`.                 |

### `src/services/` — singletons applicatifs

| Fichier                                                         | Rôle                                                                                                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/services/AssetManager.ts](../src/services/AssetManager.ts) | M2 : manifest procédural placeholder. `AssetManager.get('sprite.player.dart')` → config visuelle. Helper `toSpriteComponent` simplifie l'usage. M6 ajoute `kind: 'texture'` pour les vrais assets. |

### `src/scenes/` — orchestration

| Fichier                                                                               | Rôle                                                                                                                                                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/scenes/Scene.ts](../src/scenes/Scene.ts)                                         | Interface `{ name, enter, exit, update }`.                                                                                                                                          |
| [src/scenes/SceneManager.ts](../src/scenes/SceneManager.ts)                           | Switch entre scènes (exit puis enter). Tick la scène courante.                                                                                                                      |
| [src/scenes/BootScene.ts](../src/scenes/BootScene.ts)                                 | Bascule immédiate vers `ForestScene` en M1-M2. Préchargera les assets en M6.                                                                                                        |
| [src/scenes/ForestOfSeles/ForestScene.ts](../src/scenes/ForestOfSeles/ForestScene.ts) | Crée tilemap, viewport, layers, world ECS, spawn Dart, monte les 3 systems (Pathfinding, Movement, Render), wire l'InputController, gère camera follow. Cleanup complet à `exit()`. |

### `src/Game.ts` & `src/main.ts`

| Fichier                       | Rôle                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/Game.ts](../src/Game.ts) | Crée renderer, monte canvas, active `stage.sortableChildren`, instancie SceneManager + DebugOverlay (zIndex=1000), attache le ticker principal, lance BootScene. Définit `GameContext = { app, scenes }`. |
| [src/main.ts](../src/main.ts) | Récupère `<div id="app">`, instancie Game, attache.                                                                                                                                                       |

### Dossiers vides (préparés pour la suite)

| Dossier                                                         | Quand il se remplira                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| [src/gameplay/entities/mobs/](../src/gameplay/entities/mobs/)   | M5 : Berserk Mouse, Goblin, Assassin Cock, Trent factories. |
| [src/gameplay/entities/props/](../src/gameplay/entities/props/) | M3 : tree, rock, logFallen, rootCluster.                    |
| [src/data/](../src/data/)                                       | M4-M5 : stats mobs, items, équilibrage.                     |
| [src/ui/](../src/ui/)                                           | M6 : HUD, mini-map, hotbar.                                 |
| [src/services/](../src/services/)                               | M7 : AudioManager, SaveManager, I18nService.                |
| [src/store/](../src/store/)                                     | M2+ : zustand stores (player, world, ui).                   |

### Tests

| Fichier                                             | Couverture                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [tests/core/iso.test.ts](../tests/core/iso.test.ts) | 4 tests : projection iso (origine, round-trip, +1 gx, +1 gy).                               |
| [tests/core/ecs.test.ts](../tests/core/ecs.test.ts) | 5 tests : World (ids uniques, add/get, query intersection, destroyEntity, removeComponent). |

Politique : tests sur `core/` et `gameplay/systems/` (logique pure). Pas de test sur `rendering/`. Les fonctions critiques (combat math, pathfinding queries, save migration) **doivent** avoir des tests.

---

## Flux runtime

```
1. index.html charge /src/main.ts
2. main.ts récupère #app, crée un Game, appelle game.start(container)
3. Game.start():
   ├─ createRenderer() → instancie Pixi App
   ├─ mount canvas dans le DOM
   ├─ active stage.sortableChildren
   ├─ crée DebugOverlay (zIndex=1000) attaché au ticker
   ├─ ajoute le tick principal (appelle scenes.update à chaque frame)
   └─ switchTo(BootScene)
4. BootScene.enter() switch immédiatement vers ForestScene
5. ForestScene.enter():
   ├─ crée TileMap 32×32
   ├─ crée Camera (drag middle, zoom molette)
   ├─ ajoute viewport au stage
   ├─ monte layers (ground/entities/fx dans viewport, ui dans stage)
   ├─ ajoute tilemap dans layers.ground
   ├─ crée World ECS
   ├─ spawn Dart à (16, 16) → entité avec Player + Position + Velocity + Speed + Pathfinder + Sprite
   ├─ build collision grid 32×32 (tout zéros = marchable)
   ├─ instancie systems: PathfindingSystem(grid), MovementSystem, RenderSystem(layers)
   ├─ centre la caméra sur Dart
   └─ crée InputController, wire onMove → set Pathfinder.targetGrid sur Dart, onCameraFollowToggle
6. À chaque frame:
   ├─ DebugOverlay met à jour le texte FPS
   ├─ ForestScene.update(dt):
   │  ├─ PathfindingSystem.update : pour entités avec target sans path → easystar.findPath
   │  │   easystar.calculate() pour avancer les requêtes en file
   │  ├─ MovementSystem.update : avance le long des waypoints à vitesse constante
   │  ├─ RenderSystem.update : crée/sync nodes Pixi, met à jour zIndex iso
   │  └─ si cameraFollow: viewport.moveCenter(dart.x, dart.y)
```

**Pipeline d'un clic :**

```
clic gauche/droit sur grille
  → InputController.onPointerUp
  → viewport.toWorld(global) → world coords
  → worldToGrid(wx, wy) → grid coords arrondies
  → MoveCommand { gx, gy } émis
  → ForestScene listener: world.getComponent(player, 'Pathfinder').targetGrid = { gx, gy }
  → frame suivante: PathfindingSystem voit le target sans waypoints, lance easystar.findPath
  → 1+ frame plus tard: callback easystar peuple Pathfinder.waypoints (world coords)
  → MovementSystem consomme waypoints chaque frame
  → RenderSystem sync sprite.position à chaque frame
```

---

## Historique des jalons

### M0 — Setup ✅

**Fonctionnel :** projet vide qui démarre, lint/typecheck/build/tests passent, husky armé.
**Stack figée :** PixiJS v8 + TypeScript strict + Vite + zustand + howler + easystarjs + i18next + @pixi/tilemap + pixi-viewport + vitest.

### M1 — Scène iso + caméra ✅

**Fonctionnel :** grille iso 32×32 visible, drag/zoom caméra, FPS overlay au top.
**Créé :** core/math (Vec2, iso) + tests, rendering (Renderer, Camera, Layers, TileMap, DebugOverlay), scenes (Scene, SceneManager, BootScene, ForestScene), Game.
**Bug résolu :** FPS overlay passait sous le tilemap → corrigé via `stage.sortableChildren + zIndex=1000`.

### M2 — Player + clic-to-move ✅

**Fonctionnel :** Dart visible au centre, clic-to-move avec pathfinding, mouvement fluide, camera follow toggle (touche `C`).
**Créé :**

- `core/ecs/` (Entity, World, System) + 5 tests
- `gameplay/components/` (6 components : Position, Velocity, Sprite, Player, Pathfinder, Speed)
- `services/AssetManager.ts` (manifest procédural placeholder)
- `gameplay/entities/player.ts` (factory Dart)
- `gameplay/controls/InputController.ts` (clic + key C)
- `gameplay/systems/PathfindingSystem.ts` (easystarjs setup)
- `gameplay/systems/MovementSystem.ts` (suivi waypoints à vitesse constante)
- `rendering/systems/RenderSystem.ts` (bridge ECS → Pixi avec tri Z iso)
- ForestScene réécrite : intègre ECS, systems, input, camera follow

**Ajustements :**

- Camera drag déplacé sur clic molette uniquement (libère left/right pour gameplay)
- Layers.entities : `sortableChildren=true` pour le tri Z iso
- TileMap n'a plus d'offset (world coords ↔ grid coords mappent 1:1)
- World generic constraint : `extends object` au lieu de `Record<string, unknown>` (les interfaces TS ne satisfont pas Record)

### M3 — Décor forêt + collisions ⏳

À faire : layout `map.json`, props (tree/rock/logFallen/rootCluster), Collider component, CollisionSystem, sortie sud "Demo End", sortie ouest "Path overgrown".
