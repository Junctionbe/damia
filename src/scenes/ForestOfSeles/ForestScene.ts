import type { FederatedPointerEvent } from 'pixi.js';
import { Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { GameContext } from '@/Game';
import type { Scene } from '../Scene';
import { TileMap } from '@rendering/TileMap';
import { createCamera } from '@rendering/Camera';
import { Layers } from '@rendering/Layers';
import { RenderSystem } from '@rendering/systems/RenderSystem';
import { FloatingTextSystem } from '@rendering/systems/FloatingTextSystem';
import { EntityHudSystem } from '@rendering/systems/EntityHudSystem';
import { VfxSystem } from '@rendering/systems/VfxSystem';
import { World } from '@core/ecs';
import type { Entity, System } from '@core/ecs';
import { gridToWorld, worldToGrid } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import { spawnPlayer } from '@gameplay/entities/player';
import { spawnProp } from '@gameplay/entities/props';
import { spawnExit } from '@gameplay/entities/props/exit';
import { spawnMob } from '@gameplay/entities/mobs';
import { spawnInteractable } from '@gameplay/entities/interactables';
import { spawnItem } from '@gameplay/entities/items';
import { InputController } from '@gameplay/controls/InputController';
import { PathfindingSystem } from '@gameplay/systems/PathfindingSystem';
import { MovementSystem } from '@gameplay/systems/MovementSystem';
import { ExitSystem } from '@gameplay/systems/ExitSystem';
import { CooldownSystem } from '@gameplay/systems/CooldownSystem';
import { CombatSystem } from '@gameplay/systems/CombatSystem';
import { AttackSwingSystem } from '@gameplay/systems/AttackSwingSystem';
import { AdditionSystem } from '@gameplay/systems/AdditionSystem';
import { SpellSystem } from '@gameplay/systems/SpellSystem';
import { AISystem } from '@gameplay/systems/AISystem';
import { DefenseSystem } from '@gameplay/systems/DefenseSystem';
import { DeathSystem } from '@gameplay/systems/DeathSystem';
import { DyingSystem } from '@gameplay/systems/DyingSystem';
import { EncounterSystem } from '@gameplay/systems/EncounterSystem';
import { ItemPickupSystem } from '@gameplay/systems/ItemPickupSystem';
import { InteractableSystem } from '@gameplay/systems/InteractableSystem';
import { ForestMap, buildCollisionGrid, buildSightBlockingGrid } from './MapLoader';
import { propBlocks, propBlocksSight } from '@data/props';
import { ADDITIONS, type AdditionKind, type MobKind } from '@data/balance';
import { DART_ADDITION_UNLOCKS_BY_LEVEL, applyDartRow } from '@data/dart';
import { xpThresholdForLevel } from '@data/progression';
import { ITEMS, type ItemKind } from '@data/items';
import { SPELLS, type SpellKind } from '@data/spells';
import { spawnFloatingText } from '@gameplay/entities/floatingText';
import { spawnVfx } from '@gameplay/entities/vfx';
import { AssetManager } from '@services/AssetManager';
import { Toast } from '@ui/Toast';
import { Hud } from '@ui/Hud';
import { Hotbar, type HotbarSlot } from '@ui/Hotbar';
import { AdditionsBar } from '@ui/AdditionsBar';
import { MiniMap } from '@ui/MiniMap';
import { ZoneTitle } from '@ui/ZoneTitle';
import { ActionLog } from '@ui/ActionLog';
import { SettingsPanel } from '@ui/SettingsPanel';
import { EncounterIndicator } from '@ui/EncounterIndicator';
import { CursorOverlay } from '@ui/CursorOverlay';
import { InventoryPanel } from '@ui/InventoryPanel';
import { VisionHalo } from '@ui/VisionHalo';
import { VirtualJoystick } from '@ui/VirtualJoystick';
import { TouchActionButtons } from '@ui/TouchActionButtons';
import { TouchMenuButtons } from '@ui/TouchMenuButtons';
import { FogOfWar } from '@services/FogOfWar';
import { FogOfWarOverlay } from '@rendering/FogOfWarOverlay';
import { isTouchDevice } from '@services/Device';
import { t } from '@services/I18nService';
import { playMusic, playSfx, stopMusic } from '@services/AudioManager';
import { SaveManager, type SaveDataV5 } from '@services/SaveManager';
import { WorldMapScene } from '@scenes/WorldMapScene';
import { GameOverScene } from '@scenes/GameOverScene';
import { TitleScene } from '@scenes/TitleScene';

const PLAYER_SP_MAX = 100;
const PLAYER_MP_MAX = 60;
/** Click-to-target tolerance: enemies whose center is within this world-px
 *  radius of the click count as the picked target. ~ 3/4 of a tile width. */
const ENEMY_PICK_RADIUS_PX = 96;

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
  private encounterIndicator: EncounterIndicator | null = null;
  private encounterSystem: EncounterSystem | null = null;
  private cursorOverlay: CursorOverlay | null = null;
  private fog: FogOfWar | null = null;
  private fogOverlay: FogOfWarOverlay | null = null;
  private visionHalo: VisionHalo | null = null;
  private virtualJoystick: VirtualJoystick | null = null;
  private touchActionButtons: TouchActionButtons | null = null;
  private touchMenuButtons: TouchMenuButtons | null = null;
  /** Wall-clock timestamp of the last joystick-driven move emit. Throttled
   *  so we don't pound the pathfinder every frame while the joystick is held. */
  private joystickEmitMs = 0;
  private inventoryPanel: InventoryPanel | null = null;
  /** Latest pointer position in world coords — set by pointermove on the viewport,
   *  read each frame to detect enemy-hover for the cursor overlay. */
  private lastMouseWorld: { x: number; y: number } | null = null;
  /** Per-scene hotbar bindings. Hotbar is items-only now (additions live in
   *  their own AdditionsBar bound to right-click). Items auto-bind into the
   *  first empty slot when picked up. */
  private hotbarSlots: HotbarSlot[] = [null, null, null, null, null, null, null, null];
  /** Currently-active Addition fired by right-click. Switched by clicking a
   *  slot in the AdditionsBar. */
  private activeAddition: AdditionKind = 'doubleSlash';
  private additionsBar: AdditionsBar | null = null;

  /** Active ground-targeting state. While set, the click handler commits/cancels
   *  the spell instead of moving Dart, and the cursor circle in fxLayer follows
   *  the mouse (clamped to the spell's castRangePx). */
  private groundTargeting: {
    spell: SpellKind;
    itemKind: ItemKind;
    aoeRadiusPx: number;
    castRangePx: number;
    cursor: Graphics;
    cleanups: Array<() => void>;
  } | null = null;
  private playerId: Entity | null = null;
  private cameraFollow = false;
  private mobKinds = new Map<Entity, MobKind>();
  private playerDied = false;
  private cleanups: Array<() => void> = [];

  constructor(private readonly saveData: SaveDataV5 | null = null) {}

  enter(ctx: GameContext): void {
    const map = ForestMap;

    this.tilemap = new TileMap({
      width: map.size.w,
      height: map.size.h,
      pathZones: map.pathZones,
      groundTexture: AssetManager.getTexture('tile.forest.ground'),
      // M8: only Leonardo dirt tile has clean transparent bg right now;
      // Gemini path crops still carry visible white edges. Single variant for the test.
      pathTextures: [AssetManager.getTexture('tile.forest.path.1')],
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

    // Per-zone fog state — owns the revealed grid that drives both the world
    // overlay and the minimap. Seeded from the save when revisiting; new
    // games start fully unrevealed. The sight-blocking grid wires the
    // FogOfWar's LoS check to the zone's tall props (trees + boulders) so
    // tiles behind them stay hidden until the player steps around.
    const sightGrid = buildSightBlockingGrid(map, propBlocksSight);
    this.fog = new FogOfWar(
      map.size.w,
      map.size.h,
      (gx, gy) => sightGrid[gy]?.[gx] ?? false,
      this.saveData?.fogByZone?.forest,
    );

    // Wild zones use a two-layer fog system:
    //   1. FogOfWarOverlay (world-space, per-tile) — paints opaque blackouts
    //      over UNEXPLORED cells only. Provides the hard "wall of unknown".
    //   2. VisionHalo (screen-space, radial) — paints a soft Diablo-style
    //      torch halo around the player. Provides the smooth vision↔memory
    //      transition without per-tile staircase artefacts.
    // Camera-follow is forced ON because the halo is centred on the screen,
    // not the player's world coords — panning would orphan Dart in the dark.
    if (map.fov) {
      this.fogOverlay = new FogOfWarOverlay(this.fog);
      this.layers.fog.addChild(this.fogOverlay.container);
      this.visionHalo = new VisionHalo(ctx.app);
      this.visionHalo.mount(ctx.app.stage, this.viewport);
      // Strip viewport pan / wheel-zoom so the player can't drift the camera
      // off the lit area by accident.
      this.viewport.plugins.remove('drag');
      this.viewport.plugins.remove('wheel');
      this.viewport.plugins.remove('pinch');
      this.cameraFollow = true;
    }

    this.world = new World<Components>();
    // Saved player position only applies when the save was made IN this zone —
    // otherwise the gx/gy belong to a different map's grid. Cross-zone arrivals
    // (e.g. Hellena → WorldMap → Forest) always spawn at the map's entry point.
    const fromThisZone = this.saveData?.currentZoneId === 'forest';
    const spawn =
      fromThisZone && this.saveData
        ? { gx: this.saveData.player.gx, gy: this.saveData.player.gy }
        : map.spawn;
    const startHp = fromThisZone ? this.saveData?.player.hp : undefined;
    this.playerId = spawnPlayer(this.world, {
      gx: spawn.gx,
      gy: spawn.gy,
      ...(startHp !== undefined ? { hp: startHp } : {}),
    });

    // Restore inventory + hotbar + progression from the save (no-op for new games).
    if (this.saveData) {
      const inv = this.world.getComponent(this.playerId, 'Inventory');
      if (inv) {
        inv.items = { ...this.saveData.inventory.items };
        inv.gold = this.saveData.inventory.gold;
      }
      const prog = this.world.getComponent(this.playerId, 'Progression');
      if (prog) {
        prog.level = this.saveData.progression.level;
        prog.xp = this.saveData.progression.xp;
        prog.xpToNext = this.saveData.progression.xpToNext;
        // Apply Dart's TLoD-canonical row for the loaded level so stats match.
        // Same-zone resume: keep the saved HP (player might have been damaged).
        // Cross-zone arrival: top up to max so travelling refreshes the player.
        const stats = this.world.getComponent(this.playerId, 'Stats');
        const hp = this.world.getComponent(this.playerId, 'Health');
        applyDartRow(stats, hp, prog.level, fromThisZone);
        if (!fromThisZone && hp) hp.current = hp.max;
      }
      // Slice into a mutable array — saveData.hotbar is readonly.
      this.hotbarSlots = this.saveData.hotbar.slice();
      this.activeAddition = this.saveData.activeAddition;
    } else {
      // DEV: prefill some items + bind to hotbar slots so spell/heal flows can
      // be tested without farming. TODO: remove before ship.
      const inv = this.world.getComponent(this.playerId, 'Inventory');
      if (inv) {
        inv.items.healingPotion = 5;
        inv.items.burnOut = 3;
      }
      this.hotbarSlots[1] = { kind: 'item', item: 'healingPotion' };
      this.hotbarSlots[2] = { kind: 'item', item: 'burnOut' };
      // DEV: force-start at level 5 (HP 150 / atk 11 / def 12 / mat 11 / mdf 11)
      // so the Forest is playable while we're still on TLoD-canonical Dart stats
      // and action-RPG-tuned mobs. TODO: remove before ship.
      const prog = this.world.getComponent(this.playerId, 'Progression');
      const stats = this.world.getComponent(this.playerId, 'Stats');
      const hp = this.world.getComponent(this.playerId, 'Health');
      if (prog) {
        prog.level = 5;
        // Cumulative XP at LV5 = 200 (TLoD); next threshold = LV6 (= 345).
        prog.xp = xpThresholdForLevel(5);
        prog.xpToNext = xpThresholdForLevel(6);
      }
      applyDartRow(stats, hp, 5, false);
      if (hp) hp.current = hp.max;
    }

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
    const swing = new AttackSwingSystem();
    const defense = new DefenseSystem();
    const exits = new ExitSystem();
    const interactables = new InteractableSystem();
    const death = new DeathSystem((id) => this.mobKinds.get(id) ?? null);
    const dying = new DyingSystem();
    const addition = new AdditionSystem();
    const spell = new SpellSystem();
    const pickup = new ItemPickupSystem();
    const render = new RenderSystem(this.layers);
    const floating = new FloatingTextSystem(this.layers.fx);
    const entityHud = new EntityHudSystem(this.layers.fx);
    const vfx = new VfxSystem(this.layers.fx);
    // Random encounters: walking accumulates px → spawn mobs in a ring around
    // the player at full meter. Player-relative (not camera-relative) so it
    // works regardless of camera-follow state.
    this.encounterSystem = new EncounterSystem(
      'forest',
      { width: map.size.w, height: map.size.h },
      (gx, gy) => collisionGrid[gy]?.[gx] === 0,
      (entity, kind) => {
        this.mobKinds.set(entity, kind);
      },
    );
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
      dying,
      addition,
      spell,
      this.encounterSystem,
      pickup,
      // `swing` must run AFTER combat (which spawns the AttackSwing) and BEFORE
      // render, but its `dt` advance must not happen on the same frame the swing
      // is created — otherwise the player sees totalMs - dt of motion. Placing it
      // here means: frame N spawns swing at elapsedMs=0 → frame N's render draws
      // it at t=0 → frame N+1 the swing system advances by dt and render redraws.
      swing,
      render,
      // EntityHudSystem must run AFTER render so it reads the same Position
      // values that just placed the sprites for this frame.
      entityHud,
      vfx,
      floating,
    ];

    this.toast = new Toast(ctx.app, this.layers.ui);
    this.hud = new Hud(ctx.app);
    this.hotbar = new Hotbar(ctx.app);
    this.minimap = new MiniMap(ctx.app, {
      fog: this.fog,
      pathZones: map.pathZones,
    });
    this.zoneTitle = new ZoneTitle(ctx.app);
    this.actionLog = new ActionLog(ctx.app);
    this.settings = new SettingsPanel(ctx.app);
    this.encounterIndicator = new EncounterIndicator();
    this.layers.fx.addChild(this.encounterIndicator.node);

    // Inventory modal — opened with `I`. Mounted on the UI layer; pause is
    // handled in update() (skip systems while open). Callbacks delegate to
    // helpers further down so the panel stays UI-only.
    this.inventoryPanel = new InventoryPanel(ctx.app);
    this.inventoryPanel.setCallbacks({
      onBind: (kind, slotIdx) => this.bindItemToHotbar(kind, slotIdx),
      onUse: (kind) => this.tryConsumeItem(kind),
      onDrop: (kind) => this.dropItemToWorld(kind),
    });
    this.layers.ui.addChild(this.inventoryPanel.container);

    // AdditionsBar — sits above the Hotbar. Click a slot to make it the active
    // addition; right-click in the world casts the active one.
    this.additionsBar = new AdditionsBar(ctx.app);
    this.additionsBar.setOnSelect((kind) => {
      this.activeAddition = kind;
    });
    this.layers.ui.addChild(this.additionsBar.container);

    // Custom animated sword cursor — added at the app stage level so it sits
    // above every layer (UI included) and isn't affected by camera scale.
    // Skipped on touch devices (no mouse → no cursor follower).
    const touch = isTouchDevice();
    if (!touch) {
      this.cursorOverlay = new CursorOverlay(ctx.app, this.viewport);
      ctx.app.stage.addChild(this.cursorOverlay.node);
      // Track the latest world-space mouse position for per-frame hover detection.
      const onPointerMoveTrack = (e: FederatedPointerEvent): void => {
        if (!this.viewport) return;
        const local = this.viewport.toWorld(e.global);
        this.lastMouseWorld = { x: local.x, y: local.y };
      };
      this.viewport.on('pointermove', onPointerMoveTrack);
      this.cleanups.push(() => this.viewport?.off('pointermove', onPointerMoveTrack));
    }
    this.layers.ui.addChild(
      this.hud.container,
      this.hotbar.container,
      this.minimap.container,
      this.zoneTitle.container,
      this.actionLog.container,
      this.settings.container,
    );

    // Touch overlay — joystick + action buttons + menu icons. Mounted on the
    // UI layer so they ride on top of everything else and the per-button
    // pointer handlers don't clash with the world's click-to-move pipeline.
    if (touch) {
      this.virtualJoystick = new VirtualJoystick(ctx.app);
      this.layers.ui.addChild(this.virtualJoystick.container);

      this.touchActionButtons = new TouchActionButtons(ctx.app, {
        onAttack: () => this.touchAttackNearest(),
        onAddition: () => this.input?.emitClick({ button: 'right', gx: 0, gy: 0 }),
        onDefendToggle: () => this.input?.emitDefend(!this.input.isDefending()),
        isDefending: () => this.input?.isDefending() ?? false,
      });
      this.layers.ui.addChild(this.touchActionButtons.container);

      this.touchMenuButtons = new TouchMenuButtons(ctx.app, {
        onInventory: () => {
          if (!this.inventoryPanel) return;
          if (this.inventoryPanel.isOpen) this.inventoryPanel.close();
          else this.openInventoryPanel();
        },
        onSettings: () => this.settings?.toggle(),
      });
      this.layers.ui.addChild(this.touchMenuButtons.container);
    }

    this.zoneTitle.show(t('zones.forestOfSeles.name'), t('zones.forestOfSeles.objective'));

    // Ambient music. AudioContext was already unlocked at TitleScene click;
    // playMusic is idempotent so re-entering the same scene won't restart it.
    playMusic('music.forestAmbient');

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
      if (exit.kind === 'transition' && exit.targetScene === 'world-map') {
        this.persist();
        queueMicrotask(() => {
          void ctx.scenes.switchTo(new WorldMapScene(SaveManager.load()), ctx);
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

    pickup.onPickup(({ kind, result, gold }) => {
      if (result === 'full') {
        // Item was left on the ground; don't play the pickup sfx so the player
        // notices something is off.
        this.toast?.show(t('inventory.full'));
        return;
      }
      playSfx('items.pickup');
      if (result === 'gold' && gold !== undefined) {
        this.actionLog?.push(t('log.goldPicked', { gold }));
        return;
      }
      this.autoBindItemToHotbar(kind);
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
      if (this.inventoryPanel?.isOpen) return; // modal swallows clicks itself
      // Ground-targeting mode: left-click commits the spell, right-click cancels.
      // Always swallow the click here so it doesn't also trigger move/attack.
      if (this.groundTargeting) {
        this.exitGroundTargeting(cmd.button === 'left');
        return;
      }
      if (this.world.hasComponent(this.playerId, 'Defending')) return;
      // Lock the player out of movement / attack-restart while an Addition or
      // Spell animation plays.
      if (this.world.hasComponent(this.playerId, 'Addition')) return;
      if (this.world.hasComponent(this.playerId, 'Spell')) return;

      // Right-click anywhere = trigger the active addition. Targets the
      // enemy under the cursor first, falls back to nearest in range.
      if (cmd.button === 'right') {
        this.tryTriggerAddition(this.activeAddition);
        return;
      }
      if (cmd.button === 'left') {
        const target = this.findEnemyAtCell(cmd.gx, cmd.gy);
        if (target !== null) {
          this.world.addComponent(this.playerId, 'CombatIntent', { targetId: target });
          // Click feedback: red ring pulse on the targeted enemy.
          const tp = this.world.getComponent(target, 'Position');
          if (tp) {
            spawnVfx(this.world, {
              kind: 'clickAttack',
              x: tp.x,
              y: tp.y,
              radius: 32,
              durationMs: 350,
            });
          }
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
      // Click feedback: iso diamond outline on the destination tile.
      const tilePos = gridToWorld(cmd.gx, cmd.gy);
      spawnVfx(this.world, {
        kind: 'clickMove',
        x: tilePos.x,
        y: tilePos.y,
        radius: 0,
        durationMs: 350,
      });
    });

    this.input.onDefendChange((active) => {
      if (!this.world || this.playerId === null) return;
      // Don't let defend interrupt an addition or spell animation.
      if (active && this.world.hasComponent(this.playerId, 'Addition')) return;
      if (active && this.world.hasComponent(this.playerId, 'Spell')) return;
      if (active) this.world.addComponent(this.playerId, 'Defending', {});
      else this.world.removeComponent(this.playerId, 'Defending');
    });

    this.input.onSlot((slotIdx) => this.activateHotbarSlot(slotIdx));

    this.input.onCameraFollowToggle((on) => {
      // Wild zones (FoV ON) lock the camera onto the player — letting the
      // toggle override that would walk Dart out of his lit zone.
      if (this.fogOverlay) return;
      this.cameraFollow = on;
    });

    // Auto-save when the user leaves the tab.
    const onVisibility = (): void => {
      if (document.hidden) this.persist();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

    // Inventory key bindings — `I` toggles, `Esc` closes, `D` drops the
    // selected item. The slot keys 1-8 are intercepted in `activateHotbarSlot`
    // when the panel is open (binds the selected item instead of triggering).
    const onInventoryKey = (e: KeyboardEvent): void => {
      if (e.key === 'i' || e.key === 'I') {
        if (!this.inventoryPanel) return;
        if (this.inventoryPanel.isOpen) this.inventoryPanel.close();
        else this.openInventoryPanel();
        return;
      }
      if (this.inventoryPanel?.isOpen) {
        if (e.key === 'Escape') this.inventoryPanel.close();
        else if (e.key === 'd' || e.key === 'D') {
          const sel = this.inventoryPanel.getSelectedKind();
          if (sel) this.dropItemToWorld(sel);
        }
      }
    };
    window.addEventListener('keydown', onInventoryKey);
    this.cleanups.push(() => window.removeEventListener('keydown', onInventoryKey));
  }

  exit(ctx: GameContext): void {
    stopMusic();
    if (this.groundTargeting) this.exitGroundTargeting(false);
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
    this.encounterIndicator?.destroy();
    this.encounterIndicator = null;
    this.encounterSystem = null;
    this.cursorOverlay?.destroy();
    this.cursorOverlay = null;
    this.fogOverlay?.destroy();
    this.fogOverlay = null;
    this.visionHalo?.destroy();
    this.visionHalo = null;
    this.virtualJoystick?.destroy();
    this.virtualJoystick = null;
    this.touchActionButtons?.destroy();
    this.touchActionButtons = null;
    this.touchMenuButtons?.destroy();
    this.touchMenuButtons = null;
    this.fog = null;
    this.lastMouseWorld = null;
    this.inventoryPanel?.destroy();
    this.inventoryPanel = null;
    this.additionsBar?.destroy();
    this.additionsBar = null;
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
      // Hard pause: skip every system so simulation + animation timers freeze.
      // Pixi keeps rendering the existing scene graph, and the SettingsPanel
      // overlay handles its own input — no ticking needed here.
      return;
    }
    if (this.inventoryPanel?.isOpen) {
      // Same hard pause as Settings. Refresh the panel state each frame so
      // count badges + hotbar mini follow live changes (e.g. when the player
      // uses an item via right-click while the panel is open).
      if (this.playerId !== null) {
        const inv = this.world.getComponent(this.playerId, 'Inventory');
        this.inventoryPanel.setState({
          items: inv ? { ...inv.items } : {},
          gold: inv?.gold ?? 0,
          hotbarSlots: this.hotbarSlots,
        });
      }
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
      if (this.hud) {
        // SP / MP are placeholders until Dragoon mode wires real pools.
        this.hud.setSp(0, PLAYER_SP_MAX);
        this.hud.setMp(0, PLAYER_MP_MAX);
        const inv = this.world.getComponent(this.playerId, 'Inventory');
        this.hud.setGold(inv?.gold ?? 0);
        const prog = this.world.getComponent(this.playerId, 'Progression');
        if (prog) {
          this.hud.setLevel(prog.level);
          this.hud.setXp(prog.xp, prog.xpToNext);
        }
        if (this.viewport) this.hud.setZoom(this.viewport.scale.x);
      }

      // Cursor: switch to attack-sword animation when the mouse hovers an
      // enemy in click-pick range, otherwise default OS cursor. Suppressed
      // during ground-target mode (the AoE reticle is the primary feedback)
      // and while the settings panel is open.
      if (this.cursorOverlay) {
        let mode: 'default' | 'attack' = 'default';
        if (
          this.lastMouseWorld &&
          !this.groundTargeting &&
          !this.settings?.isOpen &&
          this.findEnemyAtWorld(this.lastMouseWorld.x, this.lastMouseWorld.y) !== null
        ) {
          mode = 'attack';
        }
        this.cursorOverlay.setMode(mode);
        this.cursorOverlay.update(dt);
      }

      if (this.encounterIndicator && this.encounterSystem) {
        this.encounterIndicator.setFill(this.encounterSystem.fraction(), dt);
        const playerPos = this.world.getComponent(this.playerId, 'Position');
        if (playerPos) {
          // Float ~96 px above the player's tile-bottom point — same convention
          // as the HP bar offset, just a bit higher to clear the head.
          this.encounterIndicator.setPosition(playerPos.x, playerPos.y - 96);
        }
      }

      // Hotbar repaint: gather addition cooldowns + item counts each frame and
      // hand them to the dumb renderer alongside the slot bindings.
      // The AdditionsBar shares the cooldowns map so its own slot also paints.
      const cd = this.world.getComponent(this.playerId, 'SkillCooldown');
      const additionCooldowns: Partial<Record<AdditionKind, number>> = {};
      if (cd) {
        for (const k of Object.keys(cd.remainingMs) as AdditionKind[]) {
          const remaining = cd.remainingMs[k] ?? 0;
          const total = ADDITIONS[k].cooldownMs;
          if (remaining > 0 && total > 0) additionCooldowns[k] = Math.min(1, remaining / total);
        }
      }
      if (this.hotbar) {
        const inv = this.world.getComponent(this.playerId, 'Inventory');
        this.hotbar.setState({
          slots: this.hotbarSlots,
          additionCooldowns,
          itemCounts: inv?.items ?? {},
        });
      }
      if (this.additionsBar) {
        this.additionsBar.setState({
          unlocked: this.unlockedAdditions(),
          active: this.activeAddition,
          cooldowns: additionCooldowns,
        });
      }
    }
    // Fog of war: reveal cells around the player ONCE per frame, then push the
    // player's grid coords into both renderers so they paint the same state.
    // The MiniMap and FogOfWarOverlay both READ from `this.fog`; mutating it
    // here keeps a single source of truth.
    if (this.fog && this.playerId !== null) {
      const pos = this.world.getComponent(this.playerId, 'Position');
      if (pos) {
        const grid = worldToGrid(pos.x, pos.y);
        const pgx = Math.round(grid.x);
        const pgy = Math.round(grid.y);
        this.fog.revealCellsAround(pgx, pgy);
        this.fogOverlay?.update(pgx, pgy);
        // Tag/untag non-player Faction entities (mobs) with `Hidden` based on
        // current line of sight. The world-space fog dims the *terrain* of
        // memory tiles but leaves the entity sprites readable through the
        // tint — RTS-style "you remember the layout but lose live unit info"
        // requires hiding mobs explicitly when out of vision. Only runs when
        // the FoV overlay exists (peaceful zones don't tag).
        if (this.fogOverlay) this.updateMobVisibility(pgx, pgy);
      }
    }
    // Halo flicker — pure visual (no gameplay impact), so it ticks every
    // frame regardless of whether the player moved.
    this.visionHalo?.tick(dt);
    // Touch joystick: poll direction each frame, retarget the pathfinder at
    // most every 150 ms so we don't recompute the path on every tick. The
    // emitted click goes through the same pipeline as a real mouse click.
    this.pollJoystickMove();
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
    const inv = this.world.getComponent(this.playerId, 'Inventory');
    const prog = this.world.getComponent(this.playerId, 'Progression');
    // Preserve any pre-existing fog grids from other zones so the Forest
    // save doesn't clobber Hellena's exploration state.
    const existing = SaveManager.load();
    const existingFog = existing?.fogByZone ?? {};
    const forestFog = this.fog?.exportRevealed();
    SaveManager.save({
      currentZoneId: 'forest',
      discoveredZones: existing?.discoveredZones ?? ['forest', 'hellena'],
      fogByZone: forestFog ? { ...existingFog, forest: forestFog } : existingFog,
      player: {
        hp: Math.round(hp.current),
        maxHp: hp.max,
        gx: Math.round(grid.x),
        gy: Math.round(grid.y),
      },
      inventory: {
        items: inv ? { ...inv.items } : {},
        gold: inv?.gold ?? 0,
      },
      hotbar: this.hotbarSlots.slice(),
      progression: {
        level: prog?.level ?? 1,
        xp: prog?.xp ?? 0,
        xpToNext: prog?.xpToNext ?? 100,
      },
      activeAddition: this.activeAddition,
    });
  }

  /**
   * Player pressed a number key 0..7. Resolve the hotbar slot binding and
   * dispatch to the right handler. Empty slot → silent no-op.
   *
   * Special case: when the inventory modal is open AND has a selected item,
   * the same key binds the selection to that hotbar slot instead of firing
   * the slot's existing action.
   */
  private activateHotbarSlot(slotIdx: number): void {
    if (this.inventoryPanel?.isOpen) {
      const sel = this.inventoryPanel.getSelectedKind();
      if (sel) this.bindItemToHotbar(sel, slotIdx);
      return;
    }
    const slot = this.hotbarSlots[slotIdx] ?? null;
    if (!slot) return;
    if (slot.kind === 'addition') this.tryTriggerAddition(slot.addition);
    else if (slot.kind === 'item') this.tryConsumeItem(slot.item);
  }

  /** Filter Dart's per-level addition unlock schedule against ADDITIONS so we
   *  only return kinds that actually exist in the engine today. As we add
   *  Volcano / Burning Rush / etc. into ADDITIONS, they appear here once the
   *  player's level reaches their unlock. */
  private unlockedAdditions(): ReadonlyArray<AdditionKind> {
    if (!this.world || this.playerId === null) return ['doubleSlash'];
    const prog = this.world.getComponent(this.playerId, 'Progression');
    const level = prog?.level ?? 1;
    const out: AdditionKind[] = [];
    for (const [unlockLv, slug] of DART_ADDITION_UNLOCKS_BY_LEVEL) {
      if (level < unlockLv) continue;
      if (slug in ADDITIONS) out.push(slug as AdditionKind);
    }
    return out.length > 0 ? out : ['doubleSlash'];
  }

  /** Snapshot the current inventory + hotbar bindings into the modal and show it. */
  private openInventoryPanel(): void {
    if (!this.inventoryPanel || !this.world || this.playerId === null) return;
    const inv = this.world.getComponent(this.playerId, 'Inventory');
    this.inventoryPanel.open({
      items: inv ? { ...inv.items } : {},
      gold: inv?.gold ?? 0,
      hotbarSlots: this.hotbarSlots,
    });
  }

  /** Bind a freshly-picked item into the first empty hotbar slot, if any. */
  private autoBindItemToHotbar(kind: ItemKind): void {
    if (!ITEMS[kind].bindable) return;
    // Already bound to a slot? Nothing to do.
    for (const slot of this.hotbarSlots) {
      if (slot && slot.kind === 'item' && slot.item === kind) return;
    }
    for (let i = 0; i < this.hotbarSlots.length; i++) {
      if (this.hotbarSlots[i] === null) {
        this.hotbarSlots[i] = { kind: 'item', item: kind };
        return;
      }
    }
    // No empty slot — silent; player can rebind later via inventory UI.
  }

  /** Manual bind triggered from the InventoryPanel (drag or 1-8 key). Replaces
   *  any existing binding in that slot — including additions. If the item is
   *  already bound to another slot, the previous binding is cleared so the same
   *  item kind can't occupy two slots simultaneously. */
  private bindItemToHotbar(kind: ItemKind, slotIdx: number): void {
    if (slotIdx < 0 || slotIdx >= this.hotbarSlots.length) return;
    if (!ITEMS[kind].bindable) return;
    for (let i = 0; i < this.hotbarSlots.length; i++) {
      const s = this.hotbarSlots[i];
      if (s && s.kind === 'item' && s.item === kind) this.hotbarSlots[i] = null;
    }
    this.hotbarSlots[slotIdx] = { kind: 'item', item: kind };
  }

  /** Drop one of `kind` from the player's inventory onto the ground at the
   *  player's current position, as a pickable Item entity. A short grace
   *  period prevents the auto-pickup from grabbing it back next frame.
   *  Decrement count; no-op if count was 0. */
  private dropItemToWorld(kind: ItemKind): void {
    if (!this.world || this.playerId === null) return;
    const inv = this.world.getComponent(this.playerId, 'Inventory');
    const pos = this.world.getComponent(this.playerId, 'Position');
    if (!inv || !pos) return;
    const count = inv.items[kind] ?? 0;
    if (count <= 0) return;
    inv.items[kind] = count - 1;
    if ((inv.items[kind] ?? 0) <= 0) delete inv.items[kind];
    const id = spawnItem(this.world, kind, pos.x, pos.y);
    const item = this.world.getComponent(id, 'Item');
    // 1.5 s grace — long enough for the player to step away without spam-pickup.
    if (item) item.pickableAfterMs = performance.now() + 1500;
  }

  /**
   * Player presses an Addition hotkey: validate cooldown + target, then add an
   * `Addition` component (AdditionSystem ticks the animation and applies hits)
   * and seed the per-skill cooldown so the hotbar can paint the radial.
   *
   * Target picking: prefer the entity currently held in CombatIntent, otherwise
   * pick the nearest enemy within ADDITIONS[kind].rangeOverridePx ?? stats.range.
   */
  private tryTriggerAddition(kind: AdditionKind): void {
    if (!this.world || this.playerId === null) return;
    if (this.playerDied) return;
    if (this.settings?.isOpen) return;
    if (this.world.hasComponent(this.playerId, 'Addition')) return;
    if (this.world.hasComponent(this.playerId, 'Dying')) return;
    if (this.world.hasComponent(this.playerId, 'Defending')) return;

    const cd = this.world.getComponent(this.playerId, 'SkillCooldown');
    if (cd && (cd.remainingMs[kind] ?? 0) > 0) {
      this.toast?.show(t('addition.cooldown'));
      return;
    }

    const stats = this.world.getComponent(this.playerId, 'Stats');
    const pos = this.world.getComponent(this.playerId, 'Position');
    if (!stats || !pos) return;
    const def = ADDITIONS[kind];
    const range = def.rangeOverridePx ?? stats.range;

    const targetId = this.pickAdditionTarget(pos.x, pos.y, range);
    if (targetId === null) {
      this.toast?.show(t('addition.noTarget'));
      return;
    }

    const targetPos = this.world.getComponent(targetId, 'Position');
    if (!targetPos) return;
    const dx = targetPos.x - pos.x;
    const dy = targetPos.y - pos.y;
    const len = Math.hypot(dx, dy) || 1;

    this.world.addComponent(this.playerId, 'Addition', {
      kind,
      targetId,
      elapsedMs: 0,
      totalMs: def.totalMs,
      hitsApplied: 0,
      dirX: dx / len,
      dirY: dy / len,
    });

    if (cd) cd.remainingMs[kind] = def.cooldownMs;

    // Stop the player so the addition lock-in reads cleanly.
    const pf = this.world.getComponent(this.playerId, 'Pathfinder');
    if (pf) {
      pf.waypoints = null;
      pf.targetGrid = null;
    }

    playSfx('combat.swing');
  }

  /**
   * Player pressed a Hotbar slot bound to an inventory item: validate inventory
   * count + active state, then branch on the item's `use` effect:
   *  - heal       → restore N% of maxHP, decrement count, sfx, floating text.
   *  - spell single→ start a Spell on the locked target (or nearest in range).
   *  - spell AoE  → enter ground-targeting mode; commit via clickToCastAoE.
   * Returns void (effect happens via component mutation).
   */
  private tryConsumeItem(kind: ItemKind): void {
    if (!this.world || this.playerId === null) return;
    if (this.playerDied) return;
    if (this.settings?.isOpen) return;
    if (this.world.hasComponent(this.playerId, 'Addition')) return;
    if (this.world.hasComponent(this.playerId, 'Spell')) return;
    if (this.world.hasComponent(this.playerId, 'Dying')) return;
    if (this.world.hasComponent(this.playerId, 'Defending')) return;

    const inv = this.world.getComponent(this.playerId, 'Inventory');
    if (!inv) return;
    const count = inv.items[kind] ?? 0;
    if (count <= 0) {
      this.toast?.show(t('inventory.empty'));
      return;
    }

    const def = ITEMS[kind];
    const use = def.use;
    if (!use) return;

    if (use.kind === 'heal') {
      const hp = this.world.getComponent(this.playerId, 'Health');
      const pos = this.world.getComponent(this.playerId, 'Position');
      if (!hp || !pos) return;
      const healAmount = Math.max(1, Math.round(hp.max * use.percentMaxHp));
      const healed = Math.min(hp.max, hp.current + healAmount) - hp.current;
      if (healed <= 0) {
        // Already at full HP — refuse to consume to avoid silent waste.
        this.toast?.show(t('inventory.empty'));
        return;
      }
      hp.current += healed;
      this.decrementItem(inv, kind);
      spawnFloatingText(this.world, {
        x: pos.x,
        y: pos.y,
        text: `+${healed}`,
        color: 0x9bff9b,
      });
      playSfx('items.pickup');
      return;
    }

    if (use.kind === 'spell') {
      this.startSpellFromItem(kind, use.spell);
      return;
    }
  }

  private decrementItem(inv: Components['Inventory'], kind: ItemKind): void {
    const left = (inv.items[kind] ?? 0) - 1;
    if (left <= 0) delete inv.items[kind];
    else inv.items[kind] = left;
  }

  /**
   * Item-driven spell trigger. Single-target spells fire immediately; ground-AoE
   * spells enter targeting mode (cursor circle) and commit on click via
   * commitGroundSpell. The item is decremented at successful start, not at
   * targeting-mode entry, so cancelling the AoE preview doesn't waste an item.
   */
  private startSpellFromItem(itemKind: ItemKind, spellKind: SpellKind): void {
    if (!this.world || this.playerId === null) return;
    const spell = SPELLS[spellKind];
    const stats = this.world.getComponent(this.playerId, 'Stats');
    const pos = this.world.getComponent(this.playerId, 'Position');
    if (!stats || !pos) return;

    if (spell.target === 'lockedTarget') {
      const targetId = this.pickAdditionTarget(pos.x, pos.y, spell.rangePx);
      if (targetId === null) {
        this.toast?.show(t('inventory.noTarget'));
        return;
      }
      const tp = this.world.getComponent(targetId, 'Position');
      if (!tp) return;
      const dx = tp.x - pos.x;
      const dy = tp.y - pos.y;
      const len = Math.hypot(dx, dy) || 1;
      this.world.addComponent(this.playerId, 'Spell', {
        kind: spellKind,
        elapsedMs: 0,
        totalMs: spell.totalMs,
        hitTimingMs: spell.hitTimingMs,
        hitApplied: false,
        magicAtkMul: spell.magicAtkMul,
        target: 'lockedTarget',
        targetId,
        dirX: dx / len,
        dirY: dy / len,
        vfxKind: spell.vfx,
        vfxRadiusPx: spell.vfxRadiusPx ?? 60,
      });
      const inv = this.world.getComponent(this.playerId, 'Inventory');
      if (inv) this.decrementItem(inv, itemKind);
      const pf = this.world.getComponent(this.playerId, 'Pathfinder');
      if (pf) {
        pf.waypoints = null;
        pf.targetGrid = null;
      }
      playSfx('combat.swing');
      return;
    }

    // groundAoE — open targeting mode; spell + item commit happens on click.
    this.enterGroundTargeting(itemKind, spellKind);
  }

  /** Enter ground-targeting mode for an AoE spell. Adds an AoE preview cursor
   *  to the FX layer, attaches mousemove/Esc listeners. The click handler in
   *  the main input route picks up commit/cancel via groundTargeting state. */
  private enterGroundTargeting(itemKind: ItemKind, spellKind: SpellKind): void {
    if (!this.world || !this.viewport || !this.layers || this.playerId === null) return;
    if (this.groundTargeting) this.exitGroundTargeting(false);
    const spellDef = SPELLS[spellKind];
    if (spellDef.target !== 'groundAoE') return;
    const playerPos = this.world.getComponent(this.playerId, 'Position');
    if (!playerPos) return;

    const cursor = new Graphics()
      .circle(0, 0, spellDef.aoeRadiusPx)
      .fill({ color: 0xff4040, alpha: 0.18 })
      .stroke({ color: 0xff6060, width: 2, alpha: 0.85 });
    cursor.position.set(playerPos.x, playerPos.y);
    this.layers.fx.addChild(cursor);

    const viewport = this.viewport;
    const onMove = (e: FederatedPointerEvent): void => {
      if (!this.groundTargeting || !this.world || this.playerId === null) return;
      const playerNow = this.world.getComponent(this.playerId, 'Position');
      if (!playerNow) return;
      const local = viewport.toWorld(e.global);
      // Clamp the cursor inside castRangePx around the player.
      const dx = local.x - playerNow.x;
      const dy = local.y - playerNow.y;
      const dist = Math.hypot(dx, dy);
      const range = this.groundTargeting.castRangePx;
      if (dist > range) {
        const k = range / dist;
        cursor.position.set(playerNow.x + dx * k, playerNow.y + dy * k);
      } else {
        cursor.position.set(local.x, local.y);
      }
    };
    viewport.on('pointermove', onMove);

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && this.groundTargeting) this.exitGroundTargeting(false);
    };
    window.addEventListener('keydown', onKey);

    this.groundTargeting = {
      spell: spellKind,
      itemKind,
      aoeRadiusPx: spellDef.aoeRadiusPx,
      castRangePx: spellDef.castRangePx,
      cursor,
      cleanups: [
        () => viewport.off('pointermove', onMove),
        () => window.removeEventListener('keydown', onKey),
      ],
    };
  }

  /** Exit targeting mode. If `commit`, build the Spell at the cursor's last
   *  position, decrement the item, and freeze the player. */
  private exitGroundTargeting(commit: boolean): void {
    const gt = this.groundTargeting;
    if (!gt) return;
    this.groundTargeting = null;
    gt.cleanups.forEach((fn) => fn());
    const cursorX = gt.cursor.x;
    const cursorY = gt.cursor.y;
    gt.cursor.destroy();

    if (!commit || !this.world || this.playerId === null) return;
    const playerPos = this.world.getComponent(this.playerId, 'Position');
    const inv = this.world.getComponent(this.playerId, 'Inventory');
    if (!playerPos || !inv) return;
    if ((inv.items[gt.itemKind] ?? 0) <= 0) return; // sanity: was decremented elsewhere
    const spellDef = SPELLS[gt.spell];
    if (spellDef.target !== 'groundAoE') return;

    const dx = cursorX - playerPos.x;
    const dy = cursorY - playerPos.y;
    const len = Math.hypot(dx, dy) || 1;
    this.world.addComponent(this.playerId, 'Spell', {
      kind: gt.spell,
      elapsedMs: 0,
      totalMs: spellDef.totalMs,
      hitTimingMs: spellDef.hitTimingMs,
      hitApplied: false,
      magicAtkMul: spellDef.magicAtkMul,
      target: 'groundAoE',
      targetX: cursorX,
      targetY: cursorY,
      aoeRadiusPx: gt.aoeRadiusPx,
      dirX: dx / len,
      dirY: dy / len,
      vfxKind: spellDef.vfx,
      vfxRadiusPx: spellDef.vfxRadiusPx ?? gt.aoeRadiusPx,
    });
    this.decrementItem(inv, gt.itemKind);
    const pf = this.world.getComponent(this.playerId, 'Pathfinder');
    if (pf) {
      pf.waypoints = null;
      pf.targetGrid = null;
    }
    playSfx('combat.swing');
  }

  private pickAdditionTarget(px: number, py: number, range: number): Entity | null {
    if (!this.world || this.playerId === null) return null;
    const intent = this.world.getComponent(this.playerId, 'CombatIntent');
    if (intent !== undefined) {
      const tp = this.world.getComponent(intent.targetId, 'Position');
      const th = this.world.getComponent(intent.targetId, 'Health');
      if (
        tp &&
        th &&
        th.current > 0 &&
        !this.world.hasComponent(intent.targetId, 'Dying') &&
        Math.hypot(tp.x - px, tp.y - py) <= range
      ) {
        return intent.targetId;
      }
    }

    let bestId: Entity | null = null;
    let bestDist = Infinity;
    for (const id of this.world.query(['Health', 'Position', 'Faction'])) {
      if (id === this.playerId) continue;
      if (this.world.hasComponent(id, 'Dying')) continue;
      if (this.world.hasComponent(id, 'Hidden')) continue;
      const fac = this.world.getComponent(id, 'Faction');
      if (!fac || fac.side === 'player') continue;
      const tp = this.world.getComponent(id, 'Position');
      if (!tp) continue;
      const d = Math.hypot(tp.x - px, tp.y - py);
      if (d <= range && d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }
    return bestId;
  }

  /**
   * Pick the nearest enemy whose center is within `ENEMY_PICK_RADIUS_PX` of the
   * clicked cell's world position. Generous radius (~ ¾ tile) so the player
   * doesn't have to land on the exact mob cell — clicking just behind a tree
   * still hits the right target. Falls back to no pick if nothing is in range.
   */
  private findEnemyAtCell(gx: number, gy: number): Entity | null {
    const p = gridToWorld(gx, gy);
    return this.findEnemyAtWorld(p.x, p.y);
  }

  /**
   * Touch overlay — poll the virtual joystick and emit a left-click toward
   * a cell ≈ 5 tiles ahead of the player in the joystick's direction. We
   * throttle to ~150 ms because each click triggers a pathfinder request,
   * and we re-target the same kind of cell while the joystick is held —
   * faster polling would just spam the path solver.
   */
  private pollJoystickMove(): void {
    if (!this.virtualJoystick || !this.input || !this.world || this.playerId === null) return;
    const dir = this.virtualJoystick.direction();
    if (!dir) return;
    const now = performance.now();
    if (now - this.joystickEmitMs < 150) return;
    this.joystickEmitMs = now;
    const pos = this.world.getComponent(this.playerId, 'Position');
    if (!pos) return;
    // 5 tiles in the joystick direction. Tile diagonal in iso = √(W² + H²).
    const STEPS = 5;
    const tileDiag = Math.sqrt(64 * 64 + 32 * 32);
    const targetWx = pos.x + dir.x * STEPS * tileDiag;
    const targetWy = pos.y + dir.y * STEPS * tileDiag;
    const grid = worldToGrid(targetWx, targetWy);
    this.input.emitClick({
      button: 'left',
      gx: Math.round(grid.x),
      gy: Math.round(grid.y),
    });
  }

  /**
   * Touch attack button handler — picks the nearest enemy in the player's
   * melee range and emits a left-click on its cell, reusing the world's
   * click-to-target logic so combat behaves identically to a mouse click.
   * No-op when nothing's in range (player still has the addition button for
   * longer-reach engages).
   */
  private touchAttackNearest(): void {
    if (!this.world || this.playerId === null || !this.input) return;
    const stats = this.world.getComponent(this.playerId, 'Stats');
    const pos = this.world.getComponent(this.playerId, 'Position');
    if (!stats || !pos) return;
    const target = this.pickAdditionTarget(pos.x, pos.y, stats.range);
    if (target === null) return;
    const tp = this.world.getComponent(target, 'Position');
    if (!tp) return;
    const grid = worldToGrid(tp.x, tp.y);
    this.input.emitClick({
      button: 'left',
      gx: Math.round(grid.x),
      gy: Math.round(grid.y),
    });
  }

  /**
   * Tag/untag every non-player Faction entity (mobs) with the `Hidden`
   * component based on the player's current line of sight. RenderSystem +
   * EntityHudSystem read this tag to skip drawing — RTS-style "out of sight,
   * out of mind" while the underlying simulation keeps ticking.
   *
   * Click-targeting also needs to skip Hidden mobs (so you can't shift-click
   * an invisible mob behind the fog), but that's handled inside
   * findEnemyAtWorld via the same Hidden check.
   */
  private updateMobVisibility(playerGx: number, playerGy: number): void {
    if (!this.world || !this.fog) return;
    for (const id of this.world.query(['Faction', 'Position'])) {
      const fac = this.world.getComponent(id, 'Faction');
      if (!fac || fac.side === 'player') continue;
      const pos = this.world.getComponent(id, 'Position');
      if (!pos) continue;
      const grid = worldToGrid(pos.x, pos.y);
      const visible = this.fog.isCurrentlyVisible(
        Math.round(grid.x),
        Math.round(grid.y),
        playerGx,
        playerGy,
      );
      const hasHidden = this.world.hasComponent(id, 'Hidden');
      if (visible && hasHidden) {
        this.world.removeComponent(id, 'Hidden');
      } else if (!visible && !hasHidden) {
        this.world.addComponent(id, 'Hidden', {});
      }
    }
  }

  /** World-coord variant — used by hover detection (cursor) where we have the
   *  raw mouse world position and don't want to round-trip through the grid. */
  private findEnemyAtWorld(wx: number, wy: number): Entity | null {
    if (!this.world) return null;
    let bestId: Entity | null = null;
    let bestDist = ENEMY_PICK_RADIUS_PX;
    for (const id of this.world.query(['Health', 'Position', 'Faction'])) {
      if (id === this.playerId) continue;
      // Corpses (Dying) stay in the scene for the death-animation duration but
      // must not be re-targeted, otherwise a fast click on a freshly-killed mob
      // re-issues CombatIntent and the player walks over to swing into nothing.
      if (this.world.hasComponent(id, 'Dying')) continue;
      // Hidden mobs (out-of-vision in wild zones) are invisible — clicking on
      // their tile shouldn't pick them up as a target either.
      if (this.world.hasComponent(id, 'Hidden')) continue;
      const fac = this.world.getComponent(id, 'Faction');
      if (!fac || fac.side === 'player') continue;
      const pos = this.world.getComponent(id, 'Position');
      if (!pos) continue;
      const d = Math.hypot(pos.x - wx, pos.y - wy);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }
    return bestId;
  }
}
