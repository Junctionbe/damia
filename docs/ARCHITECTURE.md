# ARCHITECTURE — Damia

> État fonctionnel et organisation du code à un instant T.
> **À mettre à jour à la fin de chaque jalon.** Dernière mise à jour : fin M7.

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

**Jalon courant :** M7 ✅ done — prêt pour M8.

**Ce qui marche aujourd'hui :**

- **TitleScene** au lancement : "DAMIA" + "TLoD secret project" + boutons New Game / Continue (greyed si pas de save)
- **i18n EN/FR** complet via i18next, switchable depuis Settings (reload)
- **Audio synthétisé** (zéro fichier) :
  - Web Audio + OscillatorNode pour combat.swing/hit/death, items.pickup, ui.click
  - Volumes master/music/sfx persistés dans localStorage, ducking par GainNode
  - Auto-suspend sur tab caché, unlock au premier pointerdown (browser policy)
- **SettingsPanel (touche `Esc`)** : 3 sliders volume +/-, lang toggle EN ↔ FR, Resume / Quit-to-Title. Pause world updates pendant qu'il est ouvert.
- **Save/Continue** :
  - localStorage `damia.save` schemaVersion=1
  - Auto-save : visibilitychange hidden, sortie south (DemoEnd), Quit-to-Title
  - Save skip + clear quand le joueur meurt (évite respawn doomed)
  - Continue charge HP + position, fresh map (mobs respawnent)
- **Forêt + 6 mobs + IA + HUD + loot** : tous les acquis M0-M6 préservés
- 17 tests passent (inchangé depuis M5 — services sont testés manuellement)

**Ce qui n'existe pas encore :**

- Aucun fichier audio (musique forêt) — l'API est prête, manque l'OST file
- Items pickés ne font rien sur Dart (pas d'inventaire/soin) — backlog post-MVP
- Pas d'asset graphique réel (M8 — phase IA + screenshots TLoD)

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

**18 components** dans [src/gameplay/components/](../src/gameplay/components/) :

| Component          | Forme                                                                                  | Usage                                 |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------- |
| Position           | `{ x, y }`                                                                             | World coords.                         |
| Velocity           | `{ vx, vy }`                                                                           | Réservé.                              |
| Sprite             | `{ shape, color, w, h, layer, scale? }`                                                | Visual config.                        |
| Player             | marker                                                                                 | Identifie Dart.                       |
| Pathfinder         | `{ targetGrid, waypoints, computing }`                                                 | État pathfind.                        |
| Speed              | `{ value }` px/ms                                                                      | Vitesse de move.                      |
| Collider           | `{ gx, gy, blocks }`                                                                   | Bloque la grille easystar.            |
| Exit               | `{ kind: transition, gx, gy, targetScene }` ou `{ kind: blocked, gx, gy, messageKey }` | Triggers de zone.                     |
| **Health**         | `{ current, max, invulnUntilMs }`                                                      | M4 : PV.                              |
| **Stats**          | `{ atk, def, atkSpeed, range, aggroRange }`                                            | M4 : combat.                          |
| **Faction**        | `{ side: 'player' \| 'enemy' \| 'neutral' }`                                           | M4 : ciblage.                         |
| **CombatIntent**   | `{ targetId }`                                                                         | M4 : entité veut attaquer une cible.  |
| **AttackCooldown** | `{ remainingMs }`                                                                      | M4 : décrémenté par CooldownSystem.   |
| **Defending**      | marker                                                                                 | M4 : actif tant que `S` est tenu.     |
| **FloatingText**   | `{ text, color, elapsedMs, durationMs }`                                               | M4 : nombre flottant éphémère.        |
| **AI**             | `{ behavior: 'mouse' \| 'goblin' \| 'cock' \| 'trent' }`                               | M5 : route vers handler AISystem.     |
| **Item**           | `{ kind: ItemKind }`                                                                   | M5 : entité picable au sol.           |
| **Interactable**   | `{ gx, gy, messageKey }`                                                               | M6 : trigger de proximité (Merchant). |

**Entity factories** [src/gameplay/entities/](../src/gameplay/entities/) :

| Fichier                                                       | Rôle                                                                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [player.ts](../src/gameplay/entities/player.ts)               | Dart : Player + Position + Velocity + Speed + Pathfinder + Sprite + **Health + Stats + Faction + AttackCooldown**                                                                   |
| [props/index.ts](../src/gameplay/entities/props/index.ts)     | `spawnProp` générique (tree/rock/log/roots).                                                                                                                                        |
| [props/exit.ts](../src/gameplay/entities/props/exit.ts)       | `spawnExit` (Position + Exit).                                                                                                                                                      |
| [mobs/index.ts](../src/gameplay/entities/mobs/index.ts)       | **M5.** `spawnMob(world, kind, gx, gy)` — assemble n'importe quel mob via KIND_TO_BEHAVIOR + MOBS de balance.ts.                                                                    |
| [floatingText.ts](../src/gameplay/entities/floatingText.ts)   | **M4.** `spawnFloatingText({ x, y, text, color?, durationMs? })`.                                                                                                                   |
| [items.ts](../src/gameplay/entities/items.ts)                 | **M5.** `spawnItem(world, kind, x, y)` — Position + Sprite (layer fx) + Item.                                                                                                       |
| [interactables.ts](../src/gameplay/entities/interactables.ts) | **M6.** `spawnInteractable(world, { kind, gx, gy, messageKey? })` — Position + Sprite + Interactable. Définit `merchant` (capsule brun, défaut `interactables.merchantComingSoon`). |

**Systems** [src/gameplay/systems/](../src/gameplay/systems/) :

| System                 | Rôle                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PathfindingSystem      | easystarjs sur la grille de collision.                                                                                                                                         |
| MovementSystem         | Suit waypoints à vitesse constante.                                                                                                                                            |
| ExitSystem             | Trigger sur cellule d'Exit, anti-spam.                                                                                                                                         |
| **CooldownSystem**     | M4. Décrémente `AttackCooldown.remainingMs`.                                                                                                                                   |
| **AISystem**           | **M5 (replaces MobAggroSystem).** Per-behavior dispatcher. mouse=aggro 256px+flee<30%HP. goblin/trent=standard melee. cock=aggro 320px, retreat 200px tant que cooldown > 50%. |
| **CombatSystem**       | M4. Pour chaque entité avec CombatIntent : si target hors range, refresh path (rate-limited 100ms) ; sinon stop + attack on cooldown ; clear intent si target morte.           |
| **DefenseSystem**      | M4. Sync `sprite.scale` selon Defending, freeze movement quand defending.                                                                                                      |
| **DeathSystem**        | M4 + **M5**. Scan entités HP≤0. Player → fire `onPlayerDeath` (single-fire). Mob → spawn `+XP` text + `rollLoot()` → spawn item entity au sol + `destroyEntity`.               |
| **ItemPickupSystem**   | **M5.** Player à ≤36px d'un Item entity → fire `onPickup({ kind })`, destroy item.                                                                                             |
| **InteractableSystem** | **M6.** Détecte player sur cellule d'Interactable, fire `onTrigger({ interactable })`, anti-spam re-entry (même pattern qu'ExitSystem).                                        |

**Controls** [src/gameplay/controls/](../src/gameplay/controls/) :

| Fichier                                                           | Rôle                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [InputController.ts](../src/gameplay/controls/InputController.ts) | Émet `ClickCommand { button: 'left' \| 'right', gx, gy }`. Touches `C` (camera follow toggle) et `S` (defend on/off via keydown/keyup). |

### `src/services/` — singletons applicatifs

| Fichier                                                         | Rôle                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/services/AssetManager.ts](../src/services/AssetManager.ts) | M2 manifest procédural placeholder. M8 ajoutera `kind: 'texture'`.                                                                                                                                                                                      |
| [src/services/I18nService.ts](../src/services/I18nService.ts)   | **M7 i18next.** `initI18n()` async bootstrap, `t(key, params?)` API préservée, `getLanguage()`, `setLanguage()` (reload). LanguageDetector persiste dans localStorage `damia.lang`.                                                                     |
| [src/services/AudioManager.ts](../src/services/AudioManager.ts) | **M7.** Web Audio synth SFX (combat.swing/hit/death, items.pickup, ui.click). Volumes master/music/sfx via GainNodes, persistés dans localStorage `damia.audio`. `unlockAudio()` au premier user gesture. Music API présente, no-op tant que pas d'OST. |
| [src/services/SaveManager.ts](../src/services/SaveManager.ts)   | **M7.** localStorage `damia.save` schemaVersion=1. `save({zone, player})`, `load()`, `has()`, `clear()`. Validation schema, fallback null si version inconnue.                                                                                          |

### `src/ui/` — UI Pixi (overlay)

| Fichier                                               | Rôle                                                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/ui/Toast.ts](../src/ui/Toast.ts)                 | Toast bottom-center (Path overgrown / Merchant).                                                                                                     |
| [src/ui/Hud.ts](../src/ui/Hud.ts)                     | **M6.** Bas-gauche : portrait DART + HP bar rouge + SP bar bleue. `setHealth/setSp` appelés par la scène chaque frame.                               |
| [src/ui/Hotbar.ts](../src/ui/Hotbar.ts)               | **M6.** Bas-centre : 8 slots placeholder (1-8), inactifs.                                                                                            |
| [src/ui/MiniMap.ts](../src/ui/MiniMap.ts)             | **M6.** Top-right 200×200 toggleable (touche `M`). Background path zones, dots player (cyan)/enemies (rouge)/exits. Lit le world chaque frame.       |
| [src/ui/ZoneTitle.ts](../src/ui/ZoneTitle.ts)         | **M6.** Top-center titre + objectif. `show()` déclenche fade in 500 / hold 2500 / fade out 1000ms.                                                   |
| [src/ui/ActionLog.ts](../src/ui/ActionLog.ts)         | **M6.** Bottom-right 3 lignes max. `push(msg)` ajoute en bas, fade après 4s.                                                                         |
| [src/ui/SettingsPanel.ts](../src/ui/SettingsPanel.ts) | **M7.** Esc-toggleable overlay. 3 sliders volume +/- (10% step), lang toggle EN ↔ FR, Resume / Quit-to-Title. `onAction(listener)` notifie la scène. |

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

### M6 — HUD + Merchant ✅

**Fonctionnel :** HUD complet bas-gauche/centre/droite + minimap + zone title + action log + Merchant placeholder. Asset swap "phase 2" différé vers M8 (phase IA).
**Créé :**

- 1 nouveau component : `Interactable { gx, gy, messageKey }`
- `gameplay/entities/interactables.ts` : `spawnInteractable` (Merchant kind avec capsule brun)
- `gameplay/systems/InteractableSystem.ts` : trigger de proximité, anti-spam (même pattern qu'ExitSystem)
- 5 fichiers UI : `Hud`, `Hotbar`, `MiniMap`, `ZoneTitle`, `ActionLog` — tous responsives au resize via `app.renderer.on('resize')`
- Map `interactables[]` dans map.json (1 merchant à (1, 17))
- ForestScene : monte les 5 UI sur layers.ui, tick HUD/MiniMap chaque frame, `zoneTitle.show()` à l'entrée, route pickups vers ActionLog (au lieu de Toast), wire merchant trigger vers Toast
- i18n keys ajoutées : hud.dart, zones.forestOfSeles.name/objective, interactables.merchantComingSoon, log.itemPicked, log.xpGained

### M7 — Audio + i18n + Save ✅

**Fonctionnel :** Title → New Game / Continue, audio SFX synthétisé, Esc-Settings (volumes + lang), save sur visibilitychange / transition / Quit-to-Title.
**Créé :**

- `services/AudioManager.ts` (Web Audio synth, volumes localStorage)
- `services/SaveManager.ts` (localStorage v1)
- `services/I18nService.ts` réécrit (i18next + LanguageDetector, async init)
- `locales/en.json` + `locales/fr.json` (toutes les clés migrées + 5 nouvelles)
- `scenes/TitleScene.ts` (entrée du jeu, gère AudioContext unlock)
- `ui/SettingsPanel.ts` (Esc overlay, sliders +/-, lang toggle, Resume/Quit-to-Title)
- ForestScene : accept saveData en constructor, persist sur visibilitychange/transition/quit, pause world updates si Settings ouvert, clear save sur mort
- BootScene → TitleScene
- Game.start() devient async (initI18n + initAudioManager)
- SFX hooks : CombatSystem (swing+hit), DeathSystem (death), pickup listener (items.pickup), TitleScene/SettingsPanel (ui.click)
- Player factory : optional `hp` override pour Continue

**Notes :**

- Music API ready mais no-op : drop un fichier dans `assets/audio/music/` et wire MUSIC_MANIFEST quand l'OST sera là
- i18n live re-render non implémenté (lang change = full reload, choix persisté via localStorage)
- ESLint : `no-undef` désactivé (TS valide déjà, ESLint ne connaît pas DOM types comme `OscillatorType`)

### M8 — Polish + assets phase 3 ⏳

À faire : génération sprites IA pour Dart + 4 mobs + tiles forêt depuis screenshots TLoD, particules (feuilles, brume), lumière dynamique, curseur custom, écran titre styled, cinématique placeholder, déploiement.
