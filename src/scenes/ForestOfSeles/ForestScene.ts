import type { Viewport } from 'pixi-viewport';
import type { GameContext } from '@/Game';
import type { Scene } from '../Scene';
import { TileMap } from '@rendering/TileMap';
import { createCamera } from '@rendering/Camera';
import { Layers } from '@rendering/Layers';
import { RenderSystem } from '@rendering/systems/RenderSystem';
import { FloatingTextSystem } from '@rendering/systems/FloatingTextSystem';
import { World } from '@core/ecs';
import type { Entity, System } from '@core/ecs';
import { gridToWorld, worldToGrid } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import { spawnPlayer } from '@gameplay/entities/player';
import { spawnProp } from '@gameplay/entities/props';
import { spawnExit } from '@gameplay/entities/props/exit';
import { spawnMob } from '@gameplay/entities/mobs';
import { spawnInteractable } from '@gameplay/entities/interactables';
import { InputController } from '@gameplay/controls/InputController';
import { PathfindingSystem } from '@gameplay/systems/PathfindingSystem';
import { MovementSystem } from '@gameplay/systems/MovementSystem';
import { ExitSystem } from '@gameplay/systems/ExitSystem';
import { CooldownSystem } from '@gameplay/systems/CooldownSystem';
import { CombatSystem } from '@gameplay/systems/CombatSystem';
import { AISystem } from '@gameplay/systems/AISystem';
import { DefenseSystem } from '@gameplay/systems/DefenseSystem';
import { DeathSystem } from '@gameplay/systems/DeathSystem';
import { ItemPickupSystem } from '@gameplay/systems/ItemPickupSystem';
import { InteractableSystem } from '@gameplay/systems/InteractableSystem';
import { ForestMap, buildCollisionGrid } from './MapLoader';
import { propBlocks } from '@data/props';
import type { MobKind } from '@data/balance';
import { ITEMS } from '@data/items';
import { Toast } from '@ui/Toast';
import { Hud } from '@ui/Hud';
import { Hotbar } from '@ui/Hotbar';
import { MiniMap } from '@ui/MiniMap';
import { ZoneTitle } from '@ui/ZoneTitle';
import { ActionLog } from '@ui/ActionLog';
import { SettingsPanel } from '@ui/SettingsPanel';
import { t } from '@services/I18nService';
import { playSfx } from '@services/AudioManager';
import { SaveManager, type SaveDataV1 } from '@services/SaveManager';
import { DemoEndScene } from '@scenes/DemoEndScene';
import { GameOverScene } from '@scenes/GameOverScene';
import { TitleScene } from '@scenes/TitleScene';

const PLAYER_SP_MAX = 100;

export class ForestScene implements Scene {
  readonly name = 'forest';

  private layers: Layers | null = null;
  private viewport: Viewport | null = null;
  private tilemap: TileMap | null = null;
  private world: World<Components> | null = null;
  private systems: System<Components>[] = [];
  private input: InputController | null = null;
  private toast: Toast | null = null;
  private hud: Hud | null = null;
  private hotbar: Hotbar | null = null;
  private minimap: MiniMap | null = null;
  private zoneTitle: ZoneTitle | null = null;
  private actionLog: ActionLog | null = null;
  private settings: SettingsPanel | null = null;
  private playerId: Entity | null = null;
  private cameraFollow = false;
  private mobKinds = new Map<Entity, MobKind>();
  private playerDied = false;
  private cleanups: Array<() => void> = [];

  constructor(private readonly saveData: SaveDataV1 | null = null) {}

  enter(ctx: GameContext): void {
    const map = ForestMap;

    this.tilemap = new TileMap({
      width: map.size.w,
      height: map.size.h,
      pathZones: map.pathZones,
    });
    const bounds = this.tilemap.worldBounds();

    this.viewport = createCamera(ctx.app, {
      worldWidth: bounds.width * 2,
      worldHeight: bounds.height * 2,
    });
    ctx.app.stage.addChild(this.viewport);

    this.layers = new Layers();
    this.layers.mountWorld(this.viewport);
    this.layers.mountUi(ctx.app.stage);
    this.layers.ground.addChild(this.tilemap.container);

    this.world = new World<Components>();
    const spawn = this.saveData
      ? { gx: this.saveData.player.gx, gy: this.saveData.player.gy }
      : map.spawn;
    const startHp = this.saveData?.player.hp;
    this.playerId = spawnPlayer(this.world, {
      gx: spawn.gx,
      gy: spawn.gy,
      ...(startHp !== undefined ? { hp: startHp } : {}),
    });

    for (const prop of map.props) spawnProp(this.world, prop);
    for (const exit of map.exits) spawnExit(this.world, exit);
    for (const mob of map.mobs) {
      const id = spawnMob(this.world, mob.kind, mob.gx, mob.gy);
      this.mobKinds.set(id, mob.kind);
    }
    for (const inter of map.interactables) {
      spawnInteractable(this.world, inter);
    }

    const collisionGrid = buildCollisionGrid(map, propBlocks);
    const pathfinding = new PathfindingSystem(collisionGrid);
    const movement = new MovementSystem();
    const cooldown = new CooldownSystem();
    const ai = new AISystem({ width: map.size.w, height: map.size.h });
    const combat = new CombatSystem();
    const defense = new DefenseSystem();
    const exits = new ExitSystem();
    const interactables = new InteractableSystem();
    const death = new DeathSystem((id) => this.mobKinds.get(id) ?? null);
    const pickup = new ItemPickupSystem();
    const render = new RenderSystem(this.layers);
    const floating = new FloatingTextSystem(this.layers.fx);
    this.systems = [
      cooldown,
      ai,
      combat,
      pathfinding,
      movement,
      exits,
      interactables,
      defense,
      death,
      pickup,
      render,
      floating,
    ];

    this.toast = new Toast(ctx.app, this.layers.ui);
    this.hud = new Hud(ctx.app);
    this.hotbar = new Hotbar(ctx.app);
    this.minimap = new MiniMap(ctx.app, {
      gridWidth: map.size.w,
      gridHeight: map.size.h,
      pathZones: map.pathZones,
    });
    this.zoneTitle = new ZoneTitle(ctx.app);
    this.actionLog = new ActionLog(ctx.app);
    this.settings = new SettingsPanel(ctx.app);
    this.layers.ui.addChild(
      this.hud.container,
      this.hotbar.container,
      this.minimap.container,
      this.zoneTitle.container,
      this.actionLog.container,
      this.settings.container,
    );

    this.zoneTitle.show(t('zones.forestOfSeles.name'), t('zones.forestOfSeles.objective'));

    this.settings.onAction((action) => {
      this.settings?.hide();
      if (action === 'quit-to-title') {
        this.persist();
        queueMicrotask(() => {
          void ctx.scenes.switchTo(new TitleScene(), ctx);
        });
      }
    });

    exits.onTrigger(({ exit }) => {
      if (exit.kind === 'transition' && exit.targetScene === 'demo-end') {
        this.persist();
        queueMicrotask(() => {
          void ctx.scenes.switchTo(new DemoEndScene(), ctx);
        });
      } else if (exit.kind === 'blocked') {
        this.toast?.show(t(exit.messageKey));
      }
    });

    interactables.onTrigger(({ interactable }) => {
      this.toast?.show(t(interactable.messageKey));
    });

    death.onPlayerDeath(() => {
      this.playerDied = true;
      // Wipe save so "Continue" doesn't restore a doomed state.
      SaveManager.clear();
      queueMicrotask(() => {
        void ctx.scenes.switchTo(new GameOverScene(), ctx);
      });
    });

    pickup.onPickup(({ kind }) => {
      playSfx('items.pickup');
      this.actionLog?.push(t('log.itemPicked', { item: t(ITEMS[kind].nameKey) }));
    });

    const playerWorld = gridToWorld(spawn.gx, spawn.gy);
    this.viewport.moveCenter(playerWorld.x, playerWorld.y);

    this.input = new InputController({
      app: ctx.app,
      viewport: this.viewport,
      gridWidth: map.size.w,
      gridHeight: map.size.h,
    });

    this.input.onClick((cmd) => {
      if (!this.world || this.playerId === null) return;
      if (this.settings?.isOpen) return;
      if (this.world.hasComponent(this.playerId, 'Defending')) return;

      if (cmd.button === 'left') {
        const target = this.findEnemyAtCell(cmd.gx, cmd.gy);
        if (target !== null) {
          this.world.addComponent(this.playerId, 'CombatIntent', { targetId: target });
          return;
        }
      }
      this.world.removeComponent(this.playerId, 'CombatIntent');
      const pf = this.world.getComponent(this.playerId, 'Pathfinder');
      if (pf) {
        pf.targetGrid = { gx: cmd.gx, gy: cmd.gy };
        pf.waypoints = null;
        pf.computing = false;
      }
    });

    this.input.onDefendChange((active) => {
      if (!this.world || this.playerId === null) return;
      if (active) this.world.addComponent(this.playerId, 'Defending', {});
      else this.world.removeComponent(this.playerId, 'Defending');
    });

    this.input.onCameraFollowToggle((on) => {
      this.cameraFollow = on;
    });

    // Auto-save when the user leaves the tab.
    const onVisibility = (): void => {
      if (document.hidden) this.persist();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
  }

  exit(ctx: GameContext): void {
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    this.toast?.destroy();
    this.toast = null;
    this.hud?.destroy();
    this.hud = null;
    this.hotbar?.destroy();
    this.hotbar = null;
    this.minimap?.destroy();
    this.minimap = null;
    this.zoneTitle?.destroy();
    this.zoneTitle = null;
    this.actionLog?.destroy();
    this.actionLog = null;
    this.settings?.destroy();
    this.settings = null;
    this.input?.destroy();
    this.input = null;
    for (const sys of this.systems) sys.destroy?.();
    this.systems = [];
    this.world = null;
    this.playerId = null;
    this.mobKinds.clear();

    if (this.viewport) {
      ctx.app.stage.removeChild(this.viewport);
      this.viewport.destroy({ children: true });
      this.viewport = null;
    }
    if (this.layers) {
      this.layers.destroy();
      this.layers = null;
    }
    this.tilemap = null;
  }

  update(dt: number): void {
    if (!this.world) return;
    if (this.settings?.isOpen) {
      // Pause world updates but still tick render so UI stays interactive.
      return;
    }
    for (const sys of this.systems) {
      if (!this.world) break;
      sys.update(dt, this.world);
    }
    if (!this.world) return;

    if (this.playerId !== null) {
      const hp = this.world.getComponent(this.playerId, 'Health');
      if (hp && this.hud) this.hud.setHealth(hp.current, hp.max);
      if (this.hud) this.hud.setSp(0, PLAYER_SP_MAX);
    }
    if (this.minimap) this.minimap.update(this.world);

    if (this.cameraFollow && this.viewport && this.playerId !== null) {
      const pos = this.world.getComponent(this.playerId, 'Position');
      if (pos) this.viewport.moveCenter(pos.x, pos.y);
    }
  }

  private persist(): void {
    if (this.playerDied || !this.world || this.playerId === null) return;
    const hp = this.world.getComponent(this.playerId, 'Health');
    const pos = this.world.getComponent(this.playerId, 'Position');
    if (!hp || !pos) return;
    const grid = worldToGrid(pos.x, pos.y);
    SaveManager.save({
      zone: 'forest',
      player: {
        hp: Math.round(hp.current),
        maxHp: hp.max,
        gx: Math.round(grid.x),
        gy: Math.round(grid.y),
      },
    });
  }

  private findEnemyAtCell(gx: number, gy: number): Entity | null {
    if (!this.world) return null;
    for (const id of this.world.query(['Health', 'Position', 'Faction'])) {
      if (id === this.playerId) continue;
      const fac = this.world.getComponent(id, 'Faction');
      if (!fac || fac.side === 'player') continue;
      const pos = this.world.getComponent(id, 'Position');
      if (!pos) continue;
      const grid = worldToGrid(pos.x, pos.y);
      if (Math.round(grid.x) === gx && Math.round(grid.y) === gy) return id;
    }
    return null;
  }
}
