# ARCHITECTURE — Damia

> État fonctionnel et organisation du code à un instant T.
> **À mettre à jour à la fin de chaque jalon.** Dernière mise à jour : fin M5.

---

## Sommaire

- [État fonctionnel actuel](#état-fonctionnel-actuel)
- [Vue en couches](#vue-en-couches)
- [Détail par dossier](#détail-par-dossier)
- [Flux runtime](#flux-runtime)
- [Pipeline de combat](#pipeline-de-combat)
- [Historique des jalons](#historique-des-jalons)

---

## État fonctionnel actuel

**Jalon courant :** M5 ✅ done — prêt pour M6.

**Ce qui marche aujourd'hui :**

- **Forêt de Seles 32×32** : layout TLoD-fidèle, 52 props bloquants, deux sorties (DemoEnd + Path overgrown)
- **6 mobs** spawnés selon `map.json` :
  - 2 Berserk Mice (16, 9) et (4, 16) — fuient sous 30% HP
  - 2 Goblins (14, 16) et (17, 28) — aggro standard mêlée
  - 1 Assassin Cock (19, 17) — hit-and-run, retire après chaque coup
  - 1 Trent (16, 24) — slow tank, gros dégâts (12), defense 6
- **IA per-kind** différenciée perceptiblement :
  - Mouse : charge → fuite à HP bas
  - Goblin/Trent : engage et tape jusqu'à mort
  - Cock : tape puis recule à 200px tant que cooldown > 50%
- **Combat** : clic gauche sur mob → engage, S maintenu → defend, mort Dart → GameOver
- **Loot** : 30% drop chance par mob mort, item visible (cercle coloré) au sol → marche dessus → toast "Picked up: Healing Potion / Burn Out / Gold"
- **+N XP** floating text à chaque mob tué
- Tous les acquis M0-M4 (FPS overlay, drag/zoom, camera follow `C`, exits, combat)
- 17 tests passent (4 iso + 5 ECS + 4 combat + 4 loot)

**Ce qui n'existe pas encore :**

- Aucun HUD (HP bar, mini-map, hotbar) — M6
- Items pickés ne font rien sur Dart (juste log) — pas d'inventaire ni soin
- Aucun audio (M7)
- Aucune sauvegarde (M7)
- Pas d'asset graphique réel (M6/M8)

---

## Vue en couches

5 couches strictes, dépendance descendante uniquement.

```
┌─────────────────────────────────────────────┐
│  scenes/         ← orchestre les niveaux     │
├─────────────────────────────────────────────┤
│  gameplay/       ← logique de jeu (ECS)      │
│  ui/             ← Toast, HUD (M6+)          │
├─────────────────────────────────────────────┤
│  rendering/      ← Pixi pur                  │
│  services/       ← AssetManager, I18n stub   │
│  data/           ← définitions props, mobs   │
├─────────────────────────────────────────────┤
│  core/           ← maths, ECS engine, events │
└─────────────────────────────────────────────┘
```

**Règles strictes :**

- `core/` ne dépend de RIEN (pas même Pixi)
- `rendering/` ne touche pas la logique de jeu, mais peut connaître les **types** des components (RenderSystem + FloatingTextSystem sont les ponts assumés)
- `gameplay/` ne touche pas Pixi directement (passe par les components Sprite / FloatingText)
- `scenes/` orchestre, ne contient pas de logique métier
- `data/` contient uniquement des structures + fonctions pures (computeDamage)
- `ui/` peut utiliser Pixi et `services/I18nService.t()` mais pas le gameplay
- Imports circulaires interdits

---

## Détail par dossier

### `src/core/` — fondations sans dépendance

| Fichier                                           | Rôle                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| [src/core/math/Vec2.ts](../src/core/math/Vec2.ts) | Vecteur 2D + helpers.                                                 |
| [src/core/math/iso.ts](../src/core/math/iso.ts)   | `TILE_W=128`, `TILE_H=64`. `gridToWorld`, `worldToGrid`, `isoZIndex`. |
| [src/core/ecs/](../src/core/ecs/)                 | Entity, World (Map-of-Maps), System interface.                        |

### `src/data/` — données statiques + maths pures

| Fichier                                       | Rôle                                                                                                                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/data/props.ts](../src/data/props.ts)     | 4 prop kinds (tree/rock/log/roots) avec sprite + blocks.                                                                                                                                                               |
| [src/data/balance.ts](../src/data/balance.ts) | **M4.** `COMBAT` (variance, defendingDamageMul, minDamage). `PLAYER_BASE` (HP 100, ATK 12, DEF 3, atkSpeed 1.5, range 80). `MOBS` (4 types). Fonction pure `computeDamage(atk, def, roll, defending)` testée.          |
| [src/data/items.ts](../src/data/items.ts)     | **M5.** 3 items (Healing Potion / Burn Out / Gold) avec sprite + weight + nameKey i18n. `DROP_CHANCE = 0.3`. Fonction pure `rollLoot(rollDrop, rollKind)` testée (4 tests). `itemSpriteComponent(kind, layer)` helper. |

### `src/rendering/` — couche Pixi pure

| Fichier                                                                                       | Rôle                                                                                                                          |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [src/rendering/Renderer.ts](../src/rendering/Renderer.ts)                                     | Init Pixi v8.                                                                                                                 |
| [src/rendering/Camera.ts](../src/rendering/Camera.ts)                                         | Wrapper pixi-viewport (drag molette, zoom).                                                                                   |
| [src/rendering/Layers.ts](../src/rendering/Layers.ts)                                         | 4 conteneurs (ground/entities/fx/ui).                                                                                         |
| [src/rendering/TileMap.ts](../src/rendering/TileMap.ts)                                       | Damier vert + path zones dirt brun.                                                                                           |
| [src/rendering/debug/DebugOverlay.ts](../src/rendering/debug/DebugOverlay.ts)                 | FPS overlay.                                                                                                                  |
| [src/rendering/systems/RenderSystem.ts](../src/rendering/systems/RenderSystem.ts)             | Bridge ECS→Pixi. 7 shapes (capsule/circle/diamond/tree/rock/log/roots). Applique `sprite.scale ?? 1`. Sort iso via zIndex.    |
| [src/rendering/systems/FloatingTextSystem.ts](../src/rendering/systems/FloatingTextSystem.ts) | **M4.** Bridge entités `FloatingText` → `Pixi.Text`. Animation rise + fade, destroy entity à la fin. Mounté dans `layers.fx`. |

### `src/gameplay/` — logique de jeu (ECS)

**17 components** dans [src/gameplay/components/](../src/gameplay/components/) :

| Component          | Forme                                                                                  | Usage                                |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------ |
| Position           | `{ x, y }`                                                                             | World coords.                        |
| Velocity           | `{ vx, vy }`                                                                           | Réservé.                             |
| Sprite             | `{ shape, color, w, h, layer, scale? }`                                                | Visual config.                       |
| Player             | marker                                                                                 | Identifie Dart.                      |
| Pathfinder         | `{ targetGrid, waypoints, computing }`                                                 | État pathfind.                       |
| Speed              | `{ value }` px/ms                                                                      | Vitesse de move.                     |
| Collider           | `{ gx, gy, blocks }`                                                                   | Bloque la grille easystar.           |
| Exit               | `{ kind: transition, gx, gy, targetScene }` ou `{ kind: blocked, gx, gy, messageKey }` | Triggers de zone.                    |
| **Health**         | `{ current, max, invulnUntilMs }`                                                      | M4 : PV.                             |
| **Stats**          | `{ atk, def, atkSpeed, range, aggroRange }`                                            | M4 : combat.                         |
| **Faction**        | `{ side: 'player' \| 'enemy' \| 'neutral' }`                                           | M4 : ciblage.                        |
| **CombatIntent**   | `{ targetId }`                                                                         | M4 : entité veut attaquer une cible. |
| **AttackCooldown** | `{ remainingMs }`                                                                      | M4 : décrémenté par CooldownSystem.  |
| **Defending**      | marker                                                                                 | M4 : actif tant que `S` est tenu.    |
| **FloatingText**   | `{ text, color, elapsedMs, durationMs }`                                               | M4 : nombre flottant éphémère.       |
| **AI**             | `{ behavior: 'mouse' \| 'goblin' \| 'cock' \| 'trent' }`                               | M5 : route vers handler AISystem.    |
| **Item**           | `{ kind: ItemKind }`                                                                   | M5 : entité picable au sol.          |

**Entity factories** [src/gameplay/entities/](../src/gameplay/entities/) :

| Fichier                                                     | Rôle                                                                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [player.ts](../src/gameplay/entities/player.ts)             | Dart : Player + Position + Velocity + Speed + Pathfinder + Sprite + **Health + Stats + Faction + AttackCooldown** |
| [props/index.ts](../src/gameplay/entities/props/index.ts)   | `spawnProp` générique (tree/rock/log/roots).                                                                      |
| [props/exit.ts](../src/gameplay/entities/props/exit.ts)     | `spawnExit` (Position + Exit).                                                                                    |
| [mobs/index.ts](../src/gameplay/entities/mobs/index.ts)     | **M5.** `spawnMob(world, kind, gx, gy)` — assemble n'importe quel mob via KIND_TO_BEHAVIOR + MOBS de balance.ts.  |
| [floatingText.ts](../src/gameplay/entities/floatingText.ts) | **M4.** `spawnFloatingText({ x, y, text, color?, durationMs? })`.                                                 |
| [items.ts](../src/gameplay/entities/items.ts)               | **M5.** `spawnItem(world, kind, x, y)` — Position + Sprite (layer fx) + Item.                                     |

**Systems** [src/gameplay/systems/](../src/gameplay/systems/) :

| System               | Rôle                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PathfindingSystem    | easystarjs sur la grille de collision.                                                                                                                                         |
| MovementSystem       | Suit waypoints à vitesse constante.                                                                                                                                            |
| ExitSystem           | Trigger sur cellule d'Exit, anti-spam.                                                                                                                                         |
| **CooldownSystem**   | M4. Décrémente `AttackCooldown.remainingMs`.                                                                                                                                   |
| **AISystem**         | **M5 (replaces MobAggroSystem).** Per-behavior dispatcher. mouse=aggro 256px+flee<30%HP. goblin/trent=standard melee. cock=aggro 320px, retreat 200px tant que cooldown > 50%. |
| **CombatSystem**     | M4. Pour chaque entité avec CombatIntent : si target hors range, refresh path (rate-limited 100ms) ; sinon stop + attack on cooldown ; clear intent si target morte.           |
| **DefenseSystem**    | M4. Sync `sprite.scale` selon Defending, freeze movement quand defending.                                                                                                      |
| **DeathSystem**      | M4 + **M5**. Scan entités HP≤0. Player → fire `onPlayerDeath` (single-fire). Mob → spawn `+XP` text + `rollLoot()` → spawn item entity au sol + `destroyEntity`.               |
| **ItemPickupSystem** | **M5.** Player à ≤36px d'un Item entity → fire `onPickup({ kind })`, destroy item.                                                                                             |

**Controls** [src/gameplay/controls/](../src/gameplay/controls/) :

| Fichier                                                           | Rôle                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [InputController.ts](../src/gameplay/controls/InputController.ts) | Émet `ClickCommand { button: 'left' \| 'right', gx, gy }`. Touches `C` (camera follow toggle) et `S` (defend on/off via keydown/keyup). |

### `src/services/` — singletons applicatifs

| Fichier                                                         | Rôle                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [src/services/AssetManager.ts](../src/services/AssetManager.ts) | M2 manifest procédural placeholder.                                      |
| [src/services/I18nService.ts](../src/services/I18nService.ts)   | Stub `t(key, params?)`. M4 ajoute `gameOver.title`, `gameOver.subtitle`. |

### `src/ui/` — UI Pixi (overlay)

| Fichier                               | Rôle                                  |
| ------------------------------------- | ------------------------------------- |
| [src/ui/Toast.ts](../src/ui/Toast.ts) | Toast bottom-center (Path overgrown). |

### `src/scenes/` — orchestration

| Fichier                                                                    | Rôle                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Scene.ts / SceneManager.ts / BootScene.ts](../src/scenes/)                | Inchangés.                                                                                                                                                                                                                                                                                      |
| [DemoEndScene.ts](../src/scenes/DemoEndScene.ts)                           | Écran noir + texte i18n.                                                                                                                                                                                                                                                                        |
| [GameOverScene.ts](../src/scenes/GameOverScene.ts)                         | **M4.** Écran rouge sombre, "You died / Press R to restart". Listener key R → switch vers une nouvelle ForestScene.                                                                                                                                                                             |
| [ForestOfSeles/map.json](../src/scenes/ForestOfSeles/map.json)             | 52 props + 2 path zones + 2 exits.                                                                                                                                                                                                                                                              |
| [ForestOfSeles/MapLoader.ts](../src/scenes/ForestOfSeles/MapLoader.ts)     | Types + `buildCollisionGrid`.                                                                                                                                                                                                                                                                   |
| [ForestOfSeles/ForestScene.ts](../src/scenes/ForestOfSeles/ForestScene.ts) | **M4 update :** spawn Berserk Mouse à (16, 10), ajoute systems combat (cooldown, aggro, combat, defense, death, floatingText), wire onClick → resolve attack vs move, wire onDefendChange → add/remove Defending, wire onPlayerDeath → switch GameOverScene. `mobKinds` Map pour XP resolution. |

### Tests

| Fichier                                                           | Couverture                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [tests/core/iso.test.ts](../tests/core/iso.test.ts)               | 4 tests projection iso.                                                    |
| [tests/core/ecs.test.ts](../tests/core/ecs.test.ts)               | 5 tests World ECS.                                                         |
| [tests/gameplay/combat.test.ts](../tests/gameplay/combat.test.ts) | **M4.** 4 tests `computeDamage` (base, floor, defending, variance bounds). |

---

## Flux runtime

```
1. main.ts → Game.start() → BootScene → ForestScene
2. ForestScene.enter():
   ├─ TileMap, Camera, Layers
   ├─ World ECS
   ├─ spawnPlayer (16, 2) avec full combat components
   ├─ spawnProp ×52
   ├─ spawnExit ×2
   ├─ spawnBerserkMouse (16, 10) → mobKinds.set(id, 'berserkMouse')
   ├─ Systems instanciés dans cet ordre :
   │     cooldown → aggro → combat → pathfinding → movement → exits
   │     → defense → death → render → floatingText
   ├─ Toast monté
   ├─ exits.onTrigger : transition→DemoEndScene OU blocked→toast
   ├─ death.onPlayerDeath → queueMicrotask switch GameOverScene
   └─ InputController wired
3. Tick: ForestScene.update(dt) itère les 10 systems
```

---

## Pipeline de combat

**Engagement par le joueur :**

```
clic gauche sur (gx, gy)
  → InputController émet ClickCommand
  → ForestScene listener: findEnemyAtCell(gx, gy)
  → si trouvé: world.addComponent(player, 'CombatIntent', { targetId })
  → CombatSystem (frame suivante):
      ├─ target alive ? oui
      ├─ in range (dist ≤ stats.range) ?
      │   non → set Pathfinder.targetGrid (rate-limit 100ms)
      │           PathfindingSystem calcule path
      │           MovementSystem suit
      │   oui → clear waypoints, vérifier cooldown
      │           si cd ≤ 0:
      │             dmg = computeDamage(atk, def, random, defending)
      │             target.Health.current -= dmg
      │             cd.remainingMs = 1000 / atkSpeed
      │             spawnFloatingText "<dmg>" rouge sur target
  → DeathSystem (frame suivante):
      ├─ target.Health.current <= 0 ? oui
      ├─ destroy entity
      └─ spawn "+5 XP" floating text jaune
  → CombatSystem (frame suivante):
      target gone → remove CombatIntent
```

**Mob aggro (Berserk Mouse) :**

```
MobAggroSystem chaque frame:
  pour chaque enemy sans CombatIntent:
    pour chaque player:
      si dist ≤ aggroRange:
        addComponent CombatIntent { targetId: player }
→ même pipeline CombatSystem que ci-dessus côté mob
```

**Défense :**

```
keydown 'S' → InputController.defendListeners(true)
  → ForestScene: addComponent(player, 'Defending', {})
  → DefenseSystem chaque frame:
       si player has Defending:
         sprite.scale = 0.85 (RenderSystem applique au node)
         pf.waypoints = null (frozen)
  → CombatSystem côté ennemi:
       si target has Defending: dmg = max(1, dmg * 0.5)
keyup 'S' → removeComponent(player, 'Defending') → scale revient à 1
```

**Mort du joueur :**

```
DeathSystem détecte player.HP ≤ 0
  → fire onPlayerDeath (one-shot via playerDeathFired flag)
  → ForestScene listener: queueMicrotask(switchTo(GameOverScene))
  → GameOverScene.enter() : écran rouge sombre + listener keydown R
  → R pressé : queueMicrotask(switchTo(new ForestScene())) → reload propre, Dart full HP
```

---

## Historique des jalons

### M0 — Setup ✅

Vite + TS strict + PixiJS v8 + ESLint + Prettier + husky.

### M1 — Scène iso + caméra ✅

Grille iso 32×32, drag/zoom, FPS overlay.

### M2 — Player + clic-to-move ✅

ECS + 6 components + Dart + clic-to-move + camera follow.

### M3 — Décor forêt + collisions ✅

Layout TLoD-fidèle, 52 props, 2 exits (DemoEnd + Path overgrown blocked), Toast UI, I18nService stub, GameOverScene-pattern (queueMicrotask defer).

### M4 — Combat MVP ✅

**Fonctionnel :** clic-to-attack temps réel, mob aggro, défense, dégâts/XP flottants, Game Over→restart.
**Créé :**

- 7 nouveaux components : Health, Stats, Faction, CombatIntent, AttackCooldown, Defending, FloatingText (+ Sprite.scale optionnel)
- `data/balance.ts` : PLAYER_BASE + MOBS (4 définis) + COMBAT consts + `computeDamage` testée
- 5 nouveaux systems : CooldownSystem, MobAggroSystem, CombatSystem, DefenseSystem, DeathSystem
- 1 system rendering : FloatingTextSystem (mounté dans layers.fx)
- Berserk Mouse factory + structure mobs/index.ts
- spawnFloatingText helper
- GameOverScene (R = restart)
- InputController étendu : ClickCommand générique button: left|right, touches C/S
- ForestScene : intégration combat complète, mobKinds Map, listeners
- 4 tests sur `computeDamage`

### M5 — Mobs et IA ✅

**Fonctionnel :** 6 mobs sur la map (mix de 4 types), IA per-kind, loot drops + pickup.
**Créé :**

- 2 nouveaux components : AI (`{ behavior }`), Item (`{ kind }`)
- `data/items.ts` : 3 items + DROP_CHANCE 0.3 + `rollLoot` testée (4 tests)
- `gameplay/entities/items.ts` : `spawnItem`
- `gameplay/entities/mobs/index.ts` : `spawnMob` dispatcher générique (KIND_TO_BEHAVIOR + MOBS) — remplace l'ancien berserkMouse.ts isolé
- `gameplay/systems/AISystem.ts` : per-behavior dispatcher avec helpers `setFleeTarget`, `clamp`. Remplace `MobAggroSystem.ts` (supprimé).
- `gameplay/systems/ItemPickupSystem.ts` : pickup auto à 36px
- `DeathSystem` mis à jour : roll loot + spawn item entity
- `map.json` : nouveau champ `mobs[]` (6 entrées). `MapLoader` expose `MapMob`.
- `ForestScene` : spawn mobs depuis map.json, swap MobAggroSystem→AISystem, ajoute ItemPickupSystem (wire onPickup→toast)
- i18n keys : items.\* + pickups.picked (avec interpolation `{item}`)

### M6 — HUD + assets phase 2 ⏳

À faire : HUD (HP/SP bar, hotbar, mini-map, ZoneTitle, ActionLog), placeholder Merchant, swap placeholders géométriques par packs gratuits iso fantasy.
