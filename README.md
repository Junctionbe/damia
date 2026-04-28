# Damia

> TLOD secret project — Action-RPG web isométrique inspiré de _The Legend of Dragoon_.

## Stack

PixiJS v8 (WebGPU + WebGL2 fallback) + TypeScript strict + Vite. Architecture en couches + ECS léger.

## Commandes

```bash
npm install        # première installation
npm run dev        # dev server avec HMR (port 5173)
npm run build      # build production
npm run preview    # preview du build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier --write
npm run test       # vitest
```

## Documentation projet

- [docs/PROMPT_V2.md](docs/PROMPT_V2.md) — vision, décisions verrouillées
- [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md) — architecture, conventions
- [docs/ROADMAP_MVP.md](docs/ROADMAP_MVP.md) — jalons M0→M8

## Structure

```
src/
├─ core/        # ECS, math, events (zéro dépendance gameplay)
├─ rendering/   # Pixi pur (Renderer, Camera, Layers, TileMap)
├─ gameplay/    # ECS components + systems + entity factories
├─ scenes/      # Niveaux / écrans
├─ data/        # Données statiques (mobs, items, balance)
├─ ui/          # HUD, menus
├─ services/    # AssetManager, AudioManager, SaveManager, I18n
└─ store/       # zustand stores
```

## État du projet

**Phase actuelle :** M0 — Setup. Voir `docs/ROADMAP_MVP.md` pour le suivi.
