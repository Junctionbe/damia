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

- [ ] Components : `Health`, `Stats` (atk, def, atkSpeed, range)
- [ ] `data/balance.ts` : valeurs Dart + 4 mobs
- [ ] Click gauche sur entité avec `Health` → cible ennemi, Dart pathfind à portée puis attaque auto
- [ ] `CombatSystem` : tick d'attaque (cooldown), calcul dégâts (`dmg = max(1, atk - def + variance)`)
- [ ] Floating damage numbers (object pool)
- [ ] Touche `S` ou clic droit maintenu : Défense (réduit dégâts -50%, immobilise, anim placeholder = sprite plus petit)
- [ ] `Health` à 0 → entité disparaît + drop XP
- [ ] Dart à 0 HP → écran Game Over → reload save (ou respawn entrée zone si pas de save)

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

- [ ] 4 entity factories : `berserkMouse`, `goblin`, `assassinCock`, `trent`
- [ ] Component `AI` (state, target, aggroRange, etc.)
- [ ] `AISystem` : machine à états simple
  - **Berserk Mouse** : aggro très court, charge, fuit en dessous de 30% HP
  - **Goblin** : aggro moyen, attaque mêlée standard
  - **Assassin Cock** : aggro longue distance, hit-and-run (frappe puis recule)
  - **Trent** : aggro court, lent, gros dégâts
- [ ] Spawn manager : positionne les mobs selon `map.json`
- [ ] Loot table simple : XP toujours + 30% chance Healing Potion / Burn Out / Gold

**Done quand :**

- 5-8 mobs sur la map (mix des 4 types)
- Chaque type a un comportement perceptiblement différent
- Drops fonctionnent (item pické → log "Item picked: Healing Potion")

**Estimé :** 3 sessions.

---

## M6 — HUD + assets phase 2

**Objectif :** interface complète + remplacement placeholders géométriques par assets gratuits.

**Tâches :**

- [ ] `ui/Hud.ts` : portrait Dart + barre HP/SP bas-gauche
- [ ] `ui/Hotbar.ts` : 8 slots vides, raccourcis 1-8 (inactifs MVP)
- [ ] `ui/MiniMap.ts` : toggle `M`, affiche Dart + ennemis visibles + exits
- [ ] `ui/ZoneTitle.ts` : fade in/out à l'entrée de zone
- [ ] `ui/ActionLog.ts` : 3 lignes max, fade out 5s
- [ ] Placeholder Merchant visible avec interaction "Coming soon"
- [ ] **Swap assets** : remplacer placeholders par packs gratuits iso fantasy (recherche : OpenGameArt "isometric forest", itch.io "isometric RPG asset")
  - Tiles : herbe, terre, racines, eau (si présente)
  - Sprites : Dart human placeholder, mobs génériques
  - Mise à jour `AssetManager` manifest UNIQUEMENT, zéro changement code gameplay

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

- [ ] `services/AudioManager.ts` complet (howler wrapper)
- [ ] Charger 1 musique d'ambiance forêt (OST TLoD si dispo, fade in/out)
- [ ] SFX : pas, swing épée, hit, mob death, item pickup, ui_click
- [ ] Master/music/sfx volume sliders dans menu options minimal (touche `Esc`)
- [ ] `services/I18nService.ts` : i18next bootstrap
- [ ] Tous textes via `t()`, fichiers `locales/en.json` + `locales/fr.json` (FR vide ou auto-traduit pour test)
- [ ] Toggle langue dans menu options
- [ ] `services/SaveManager.ts` : auto-save à transition zone, mort, `visibilitychange`
- [ ] Bouton "Continue" sur menu si save existe

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
| M4    | ⏳ pending | Prêt à démarrer                                         |
| M5    | —          |                                                         |
| M6    | —          |                                                         |
| M7    | —          |                                                         |
| M8    | —          |                                                         |
