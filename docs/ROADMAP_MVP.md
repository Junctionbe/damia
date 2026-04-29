# ROADMAP MVP — Damia

> Jalons M0 → M8. On valide chaque jalon avant de passer au suivant.
> "Done" = tous les critères cochés ET démo fonctionnelle dans le navigateur.

---

## M0 — Setup projet

**Objectif :** projet vide qui démarre, lint passe, build passe.

**Tâches :**

- [x] Setup Vite + TS strict (créé manuellement à la racine, pas en sous-dossier)
- [x] Installer toutes les deps (cf. `PROJECT_BLUEPRINT.md` §1)
- [x] Config `tsconfig.json` strict + path aliases
- [x] Config ESLint v9 (flat config) + Prettier + husky pre-commit + lint-staged
- [x] Créer arborescence dossiers vide (cf. blueprint §2)
- [x] `index.html` minimal avec canvas Pixi
- [x] `main.ts` instancie une `Pixi.Application` v8 plein écran avec fond coloré (`#1a2820`, vert sombre)
- [x] README.md court avec commandes `dev` / `build` / `lint`

**Done quand :**

- `npm run dev` ouvre le navigateur, fond coloré visible
- `npm run build` produit un bundle sans warning
- `npm run lint` et `npm run typecheck` passent
- Pre-commit hook bloque un fichier mal formaté

**Estimé :** 1 session.

---

## M1 — Scène iso vide + caméra

**Objectif :** voir un sol isométrique avec une caméra qu'on peut zoomer/déplacer.

**Tâches :**

- [x] `core/math/iso.ts` + `Vec2.ts` (avec tests vitest)
- [x] `rendering/Renderer.ts` : init Pixi v8 (preferWebGPU, fallback WebGL2)
- [x] `rendering/Camera.ts` : wrapper `pixi-viewport`, drag (middle/left) + zoom molette clampé 0.5x→2x
- [x] `rendering/Layers.ts` : 4 containers (`ground`, `entities`, `fx`, `ui`)
- [x] `rendering/TileMap.ts` : grille 32×32 de tiles iso placeholder (damier vert sombre)
- [x] `scenes/BootScene.ts` → bascule sur `ForestScene`
- [x] `scenes/SceneManager.ts` (interface Scene + manager)
- [x] Debug overlay : FPS counter avec moyenne glissante + label renderer

**Done quand :**

- Au démarrage : grille iso 32×32 visible
- Drag souris pan la caméra
- Molette zoome (clamp 0.5x à 2x)
- FPS affiché en haut à gauche
- 60 FPS stable

**Estimé :** 1-2 sessions.

---

## M2 — Player + clic-to-move

**Objectif :** un personnage placeholder qui se déplace au clic via pathfinding.

**Tâches :**

- [x] ECS core (`Entity`, `World`, `System`) dans `core/ecs/` + 5 tests vitest
- [x] Components : `Position`, `Velocity`, `Sprite`, `Player`, `Pathfinder`, `Speed`
- [x] `gameplay/entities/player.ts` : factory Dart (capsule rouge 28×48)
- [x] `services/AssetManager.ts` : manifest procédural placeholder (`sprite.player.dart`)
- [x] `gameplay/controls/InputController.ts` : clic gauche/droit grille → MoveCommand, touche `C` toggle camera follow, contextmenu désactivé
- [x] `easystarjs` setup grille 32×32 (tout marchable en M2)
- [x] `PathfindingSystem` : calcule le chemin async, gère cas same-cell et no-path
- [x] `MovementSystem` : suit le chemin à vitesse constante (180 px/s), avec arrival epsilon
- [x] `RenderSystem` : crée/sync nodes Pixi depuis components, sortableChildren actif
- [x] Tri Z par `gridX + gridY` (via `isoZIndex`)
- [x] Camera drag déplacée sur clic molette uniquement (libère clic gauche/droit)

**Done quand :**

- Dart visible au centre de la map
- Clic droit sur une case libre → Dart pathfind et y va
- Mouvement fluide, pas de tremblement
- Caméra suit Dart en option (touche `C` pour toggle)

**Estimé :** 2-3 sessions.

---

## M3 — Décor forêt + collisions

**Objectif :** la map ressemble à la Forêt de Seles, Dart ne traverse pas les arbres.

**Tâches :**

- [x] Layout Forêt de Seles dans `scenes/ForestOfSeles/map.json` (52 props, 2 path zones, spawn nord, 2 exits)
- [x] `gameplay/entities/props/` : factory générique `spawnProp`, kinds tree/rock/log/roots
- [x] `data/props.ts` : définitions par kind (sprite + blocks)
- [x] Component `Collider` + Component `Exit` (transition | blocked)
- [x] CollisionSystem implicite : `MapLoader.buildCollisionGrid` produit la grille easystarjs depuis les props bloquants
- [x] Pathfinder utilise la grille de collision (Dart contourne les arbres)
- [x] Sortie sud (16, 31) → `DemoEndScene` (écran noir avec texte)
- [x] Sortie ouest (0, 16) → toast "Path overgrown" via `t('exits.westPathOvergrown')`
- [x] Auto-tile : path zones rendues en dirt brun, ailleurs damier vert
- [x] `services/I18nService.ts` : stub minimal `t(key, params?)` (M7 swappera pour i18next)
- [x] `ui/Toast.ts` : toast bottom-center avec fade in/out, multi-stack
- [x] `ExitSystem` : detect player on exit cell, fire trigger, anti-spam re-entry
- [x] RenderSystem étendu : 4 nouvelles formes (tree/rock/log/roots) base-anchored sur le tile

**Done quand :**

- Map a une identité de "forêt" même en placeholder
- Dart contourne les obstacles
- Sortie sud → écran "Demo End"
- Sortie ouest → texte "Path overgrown"

**Estimé :** 2 sessions.

---

## M4 — Combat MVP

**Objectif :** taper, recevoir des dégâts, mourir, défendre.

**Tâches :**

- [x] Components : `Health`, `Stats`, `Faction`, `CombatIntent`, `AttackCooldown`, `Defending`, `FloatingText` (+ `Sprite.scale` optionnel)
- [x] `data/balance.ts` : `PLAYER_BASE` + `MOBS` (4 mobs définis), `COMBAT` constants, fonction pure `computeDamage` testée (4 tests)
- [x] Click gauche sur entité ennemie → CombatIntent ; sinon → MoveCommand. CombatSystem chase puis attaque
- [x] `CombatSystem` : refresh path rate-limité (100ms), in-range stop + attack on cooldown, dégâts via `computeDamage`, defending halve
- [x] `CooldownSystem` : décrément `AttackCooldown.remainingMs`
- [x] `MobAggroSystem` (M4 minimal) : enemy sans intent picks closest player in `aggroRange`
- [x] `DefenseSystem` : sync `Sprite.scale` (0.85 ↔ 1) selon Defending, freeze movement
- [x] Floating damage numbers via entité éphémère (FloatingText component) + `FloatingTextSystem` rendu dans layers.fx
- [x] Touche `S` (down/up) → ajoute/retire `Defending` ; clics ignorés pendant la défense
- [x] `Health` à 0 → DeathSystem destroy entity + spawn `+N XP` floating text (mob), trigger Player Death listener (player)
- [x] `GameOverScene` : écran rouge sombre "You died" / "Press R to restart" → reload `ForestScene` propre
- [x] Test mob : 1 Berserk Mouse à (16, 10) sur le chemin principal

**Done quand :**

- Spawn 1 mob test (Berserk Mouse)
- Clic dessus → Dart attaque → mob meurt après N coups
- Dart prend des dégâts si proche d'un mob hostile
- Défense active visible et réduit les dégâts
- Game Over fonctionnel

**Estimé :** 3 sessions.

---

## M5 — Mobs et IA

**Objectif :** les 4 mobs spawnent, ont des comportements distincts.

**Tâches :**

- [x] Generic `spawnMob(world, kind, gx, gy)` dispatcher dans `gameplay/entities/mobs/index.ts` (utilise MOBS de balance.ts)
- [x] Component `AI` (`{ behavior }` — state dérivé des autres components)
- [x] `AISystem` : dispatcher per-behavior
  - **Berserk Mouse** : aggro 256px, fuit vers cellule opposée à 320px sous 30% HP
  - **Goblin/Trent** : standard melee aggro (Trent lent + tank via stats)
  - **Assassin Cock** : aggro 320px, hit-and-run — retire à 200px tant que cooldown > 50%
- [x] Spawn manager : `map.json` a `mobs[]` (6 entrées : 2 mice, 2 goblins, 1 cock, 1 trent), MapLoader expose `MapMob`
- [x] `data/items.ts` : 3 kinds (Healing Potion / Burn Out / Gold) + `rollLoot(rollDrop, rollKind)` testé (4 tests)
- [x] DeathSystem mis à jour : roll `Math.random()` au death, spawn Item entity si drop
- [x] `ItemPickupSystem` : pickup auto à 36px, fire onPickup
- [x] ForestScene wire onPickup → toast `t('pickups.picked', { item: t(items.X) })`
- [x] i18n keys : items.\* + pickups.picked (interpolation `{item}`)

**Done quand :**

- 5-8 mobs sur la map (mix des 4 types)
- Chaque type a un comportement perceptiblement différent
- Drops fonctionnent (item pické → log "Item picked: Healing Potion")

**Estimé :** 3 sessions.

---

## M6 — HUD + assets phase 2

**Objectif :** interface complète + remplacement placeholders géométriques par assets gratuits.

**Tâches :**

- [x] `ui/Hud.ts` : portrait DART + HP bar (rouge) + SP bar (bleue), bas-gauche, responsive resize
- [x] `ui/Hotbar.ts` : 8 slots placeholder centrés en bas, labels 1-8 (inactifs)
- [x] `ui/MiniMap.ts` : 200×200 top-right, dots player/enemies/exits + path zones, toggle `M`
- [x] `ui/ZoneTitle.ts` : titre + objectif top-center avec fade in (500ms) → hold (2.5s) → fade out (1s)
- [x] `ui/ActionLog.ts` : 3 lignes max bottom-right, fade out 4s+1s
- [x] Placeholder Merchant visible (capsule brun) à (1, 17) avec toast "Merchant — Coming soon" via `Interactable` component + `InteractableSystem`
- [⏭️] **Swap assets** différé vers M8 (phase 3 IA générée + screenshots TLoD) — éviter le double travail puisque l'utilisateur a déjà les assets TLoD dans `shareAI/`

**Done quand :**

- HUD visible et lisible
- MiniMap fonctionne
- Zone title s'affiche à l'entrée
- Visuel "habillé" même si pas encore TLoD-fidèle

**Estimé :** 3-4 sessions.

---

## M7 — Audio + i18n + Save

**Objectif :** son, traductions prêtes, sauvegarde fonctionnelle.

**Tâches :**

- [x] `services/AudioManager.ts` : Web Audio synthétisé (zéro fichier externe), volumes persistés dans localStorage. API music présente mais no-op tant qu'aucun OST n'est wireé.
- [x] SFX : combat.swing, combat.hit, combat.death, items.pickup, ui.click — synthétisés via OscillatorNode + noise burst
- [x] Master/music/sfx : 3 sliders +/- (10% step) dans `SettingsPanel` (touche `Esc`)
- [x] `services/I18nService.ts` : **i18next + LanguageDetector** (localStorage `damia.lang`), async `initI18n()` au bootstrap, API `t(key, params?)` préservée, `setLanguage()` reload la page
- [x] `locales/en.json` + `locales/fr.json` complets (toutes les clés des jalons précédents migrées + 5 nouvelles pour title/settings)
- [x] Toggle langue dans SettingsPanel (boutons `<` / `>` cyclent EN ↔ FR)
- [x] `services/SaveManager.ts` : localStorage `damia.save` schemaVersion=1, auto-save sur visibilitychange hidden + sortie south + Quit-to-Title. Skip + clear sur mort.
- [x] `TitleScene` (nouvelle) : titre + sous-titre + boutons New Game / Continue (greyed si pas de save).
- [x] AudioContext unlock au premier pointerdown (browser policy)
- [x] BootScene → TitleScene (au lieu de ForestScene direct)
- [x] Pause world updates quand SettingsPanel ouvert

**Done quand :**

- Musique d'ambiance joue au lancement
- SFX réagissent aux actions clés
- Switch EN/FR change l'UI
- Refresh navigateur → "Continue" charge la dernière save

**Estimé :** 3 sessions.

---

## M8 — Polish + assets phase 3

**Objectif :** rendu visuel proche de TLoD, démo livrable.

**Tâches :**

- [ ] Génération sprites Dart custom (4-8 directions, idle/walk/attack/hit/death) via outil IA + post-process pour cohérence iso
- [ ] Génération sprites mobs spécifiques (Berserk Mouse, Goblin, Assassin Cock, Trent) inspirés du Bestiary TLoD
- [ ] Tiles d'ambiance forêt inspirés screenshots `02 Forest.png` (palette, racines, arbres morts)
- [ ] Particules : feuilles qui tombent, brume légère
- [ ] Lumière dynamique : lumière dorée filtrée canopée (PixiJS lighting filters)
- [ ] Curseur custom (épée pour attaque, main pour interaction)
- [ ] Écran titre minimal avec logo "Damia"
- [ ] Cinématique placeholder à l'entrée Forest : fade noir + texte "Seles burned. Shana was taken. Find her."
- [ ] Build production déployé sur Vercel/Netlify pour démo URL

**Done quand :**

- Visuellement on reconnaît "TLoD vue du dessus"
- 60 FPS stable sur laptop moyen
- Démo accessible via URL
- Quelqu'un de neuf peut lancer + jouer 5 min sans bug bloquant

**Estimé :** 5+ sessions (le polish est sans fin, on capera).

---

## Critères globaux MVP "livrable"

- ✅ 60+ FPS stable en navigateur
- ✅ Aucun crash, aucun freeze sur 10 min de jeu
- ✅ Save/load fonctionne
- ✅ EN + structure i18n prête
- ✅ Code passe lint + typecheck + tests sans warning
- ✅ Lighthouse Performance > 80 sur la build
- ✅ Bundle initial < 5 MB (assets compressés)
- ✅ README clair pour qu'un dev tiers reprenne le projet

---

## Backlog post-MVP (= hors scope MVP, à ne PAS faire avant)

- Additions QTE (système signature TLoD)
- Magie / Items utilisables
- Transformation Dragoon (Dart Rouge-Œil)
- Système de classes Dragoon (8 personnages)
- Cinématiques scénarisées
- Inventaire + équipement
- Shop Merchant fonctionnel
- Donjons (Hellena Prison)
- World Map navigable
- Multiplayer (jamais ?)
- Mobile/touch controls

---

## Suivi avancement

À mettre à jour à chaque session : indique le jalon courant + dernière action.

| Jalon | Statut     | Notes                                                   |
| ----- | ---------- | ------------------------------------------------------- |
| M0    | ✅ done    | Setup OK : dev/build/lint/typecheck passent, husky armé |
| M1    | ✅ done    | Scène iso 32×32 + caméra drag/zoom + FPS overlay        |
| M2    | ✅ done    | ECS + Dart + clic-to-move + pathfinding + camera follow |
| M3    | ✅ done    | Forêt + collisions + exits (DemoEnd/Path overgrown)     |
| M4    | ✅ done    | Combat MVP : HP/ATK/DEF, attaque, défense, Game Over    |
| M5    | ✅ done    | 6 mobs sur la map, IA per-kind, loot tables             |
| M6    | ✅ done    | HUD complet (HP/SP, hotbar, minimap, zone title, log)   |
| M7    | ✅ done    | Audio synth + i18next EN/FR + Save/Continue + Settings  |
| M8    | ⏳ pending | Prêt à démarrer                                         |
