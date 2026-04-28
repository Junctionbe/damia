# PROMPT V2 — Damia (TLoD Action-RPG Web)

> Prompt de référence pour démarrer / reprendre le développement du projet.
> À copier-coller en début de session si le contexte se perd.

---

## 1. Vision du projet

Recréer **The Legend of Dragoon (TLoD)** sous forme d'**action-RPG isométrique web**, dans l'esprit visuel et narratif fidèle à l'original PS1, mais avec un **gameplay action temps réel** (clic-to-move type Diablo 2 / AoE2 DE) au lieu du tour-par-tour d'origine.

- Trame scénaristique : **identique à TLoD** (Endiness, Dart, Shana, Lavitz, Dragoons, Moon Child, etc.)
- Gameplay : **action temps réel**, vue isométrique (~30°, dimétrique, fixe, zoom molette)
- Fidélité visuelle : **maximale à TLoD** — chaque zone reproduite doit évoquer immédiatement l'original
- Plateforme : **navigateur web**, 60+ FPS, responsive
- Long terme : monde ouvert reliant toutes les zones d'Endiness, toutes cutscenes, toutes les classes Dragoon, additions, magies

## 2. État actuel

- **Phase** : pré-développement, blueprint validé
- **MVP cible** : zone "**Forêt de Seles**" jouable de bout en bout
- **Aucun code écrit** — on attend validation finale du blueprint avant M0

## 3. Stack technique (verrouillée)

| Catégorie   | Choix                 | Raison                                                   |
| ----------- | --------------------- | -------------------------------------------------------- |
| Renderer    | **PixiJS v8**         | WebGPU + fallback WebGL2, perfs top, contrôle bas niveau |
| Langage     | **TypeScript strict** | Refactor safe, code propre obligatoire                   |
| Build       | **Vite**              | HMR instantané, build optimisé                           |
| State       | **zustand**           | Léger, hors-React                                        |
| Audio       | **howler.js**         | Standard web, formats multi                              |
| Pathfinding | **easystarjs**        | Grille iso                                               |
| i18n        | **i18next**           | Standard, plurals, namespaces                            |
| Tilemap     | **@pixi/tilemap**     | Optimisé chunks iso                                      |
| Caméra      | **pixi-viewport**     | Zoom/drag/clamp                                          |
| Tests       | **vitest**            | Rapide, intégré Vite                                     |
| Lint        | **ESLint + Prettier** | Strict, pre-commit                                       |

Architecture : **couches (rendering / gameplay / data)** + **ECS léger** (Entity-Component-System) pour les entités de jeu. Détail dans `PROJECT_BLUEPRINT.md`.

## 4. Décisions de gameplay (verrouillées)

### Combat MVP

- **Clic gauche sur ennemi** → Dart s'approche en pathfinding et attaque en auto (style militia AoE2)
- **Clic droit / clic au sol** → déplacement
- **Touche `S` ou clic droit maintenu** → **Défense** (réduit dégâts reçus de 50%, immobilise)
- Pas d'Additions QTE, pas de magie, pas de transformation Dragoon **au MVP** (mais SP affichée, prête à brancher)
- **Game Over** → reload dernière auto-save (transition de zone)

### Stats Dart démarrage MVP

- HP 100 / SP 0 (max 100, inutilisé)
- ATK / DEF basiques, équilibrés contre les mobs forêt

### Mobs Forêt de Seles (4 types, HP ×10 vs PS1)

| Mob           | HP  | Rôle                |
| ------------- | --- | ------------------- |
| Berserk Mouse | 20  | Faible, harcèlement |
| Goblin        | 40  | Moyen, équilibré    |
| Assassin Cock | 30  | Volant, hit-and-run |
| Trent         | 50  | Tank lent           |

### Loot MVP

Healing Potion, Body Purifier, Burn Out, Charm Potion, Gold (drop +20G ponctuel comme PS1)

### Layout MVP

- Spawn nord (côté Seles)
- Sortie sud → "**Demo End — Hellena Prison ahead**"
- Sortie ouest (Prairie) → **bloquée** ("Path overgrown" — fidélité PS1)
- 1 Merchant **placeholder désactivé** ("Coming soon")
- 1-2 coffres avec loot

## 5. Décisions visuelles (verrouillées)

- **Résolution interne** : 1920×1080, scaling responsive, lettrebox si ratio ≠ 16:9
- **Pixel ratio Retina/4K** géré
- **Caméra** : iso ~30° dimétrique, fixe, **pas de rotation**, zoom molette clampé
- **Ambiance Forêt de Seles** : sous-bois diurne ombragé, palette brun-vert, lumière dorée filtrée canopée, terre battue, racines, arbres morts couchés (cf. screenshots `shareAI/assetsTLOD/all/02 Forest.png`)
- **Style global** : **fidélité maximale à TLoD**. Chaque zone future doit reproduire l'ambiance de la zone originale.

## 6. HUD MVP

- **Bas-gauche** : portrait Dart + barre HP rouge + barre SP bleue
- **Bas-centre** : barre raccourcis 8 slots (vide MVP, prête)
- **Haut-droite** : mini-map toggle (touche `M`)
- **Haut-gauche** : nom de zone (fade in 3s) + objectif ("Find Hellena Prison")
- **Bas-droite** : log d'actions (3 lignes, fade out)

## 7. Audio

- **OST TLoD** : utilisateur fournit, placés dans `assets/audio/music/`
- **SFX** : freesound.org + packs CC0, listés dans `PROJECT_BLUEPRINT.md`
- **AudioManager central** avec ducking musique/SFX, master volume, mute

## 8. Sauvegarde

- **LocalStorage**, 1 slot auto-save
- Trigger : transition de zone, mort, quitter onglet
- Format JSON versionné (`saveSchemaVersion: 1`) pour migrations futures

## 9. i18n

- Tous textes via `t('namespace.key')` — **aucun texte hardcodé**
- Langue par défaut : **anglais** (`en`)
- Structure `locales/en.json`, `locales/fr.json` (à compléter)
- Détection langue navigateur, override possible dans settings

## 10. Pipeline assets

**Phase 1 (M0-M5)** : capsules colorées + tiles plats avec direction (placeholder géométriques)
**Phase 2 (M6+)** : packs gratuits itch.io / OpenGameArt iso fantasy compatibles
**Phase 3 (post-MVP)** : sprites IA générés (Dart, mobs uniques) + screenshots TLoD comme tiles d'ambiance

Tout passe par **AssetManager** central → mapping logique → fichier. Swap placeholder → vrai asset = 1 ligne de config, **0 changement code gameplay**.

## 11. Règles de collaboration (méta)

- **Code** : Claude écrit, user valide. User n'intervient pas dans le code mais doit pouvoir débugger (= code propre, typé, commenté quand WHY non évident).
- **Lore** : **toujours consulter user**. Claude n'invente jamais de fait scénaristique.
- **Itération** : on valide chaque jalon (M0, M1, …) avant de passer au suivant.
- **Scope creep** : refusé. Toute idée hors MVP → backlog `docs/BACKLOG.md` (à créer plus tard).

## 12. Références utilisateur

- Carte d'Endiness (reconstituée Reddit) : `shareAI/map.png`
- Pack assets/screenshots TLoD complet : `shareAI/assetsTLOD/all/`
  - `00 World Map.png` à `41 Moon that Never Sets.png` — toutes zones
  - `Bestiary.png` — sprites de tous les monstres du jeu
  - `Murals.png` — fresques narratives

## 13. Documents projet

- [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) — architecture détaillée, structure dossiers, conventions
- [ROADMAP_MVP.md](ROADMAP_MVP.md) — jalons M0→M8 avec critères de "done"
- (à venir) `BACKLOG.md` — tout ce qui est hors MVP

---

**Quand tu reprends ce projet** : relis ce fichier + `PROJECT_BLUEPRINT.md` + l'état actuel de `ROADMAP_MVP.md` pour savoir où on en est.
