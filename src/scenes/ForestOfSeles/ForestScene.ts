import type { Viewport } from 'pixi-viewport';
import type { GameContext } from '@/Game';
import type { Scene } from '../Scene';
import { TileMap } from '@rendering/TileMap';
import { createCamera } from '@rendering/Camera';
import { Layers } from '@rendering/Layers';
import { RenderSystem } from '@rendering/systems/RenderSystem';
import { World } from '@core/ecs';
import type { Entity, System } from '@core/ecs';
import { gridToWorld } from '@core/math/iso';
import type { Components } from '@gameplay/components';
import { spawnPlayer } from '@gameplay/entities/player';
import { spawnProp } from '@gameplay/entities/props';
import { spawnExit } from '@gameplay/entities/props/exit';
import { InputController } from '@gameplay/controls/InputController';
import { PathfindingSystem } from '@gameplay/systems/PathfindingSystem';
import { MovementSystem } from '@gameplay/systems/MovementSystem';
import { ExitSystem } from '@gameplay/systems/ExitSystem';
import { ForestMap, buildCollisionGrid } from './MapLoader';
import { propBlocks } from '@data/props';
import { Toast } from '@ui/Toast';
import { t } from '@services/I18nService';
import { DemoEndScene } from '@scenes/DemoEndScene';

export class ForestScene implements Scene {
  readonly name = 'forest';

  private layers: Layers | null = null;
  private viewport: Viewport | null = null;
  private tilemap: TileMap | null = null;
  private world: World<Components> | null = null;
  private systems: System<Components>[] = [];
  private input: InputController | null = null;
  private toast: Toast | null = null;
  private playerId: Entity | null = null;
  private cameraFollow = false;

  enter(ctx: GameContext): void {
    const map = ForestMap;

    // Visual world.
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

    // ECS world + entities from map.
    this.world = new World<Components>();
    this.playerId = spawnPlayer(this.world, map.spawn);
    for (const prop of map.props) {
      spawnProp(this.world, prop);
    }
    for (const exit of map.exits) {
      spawnExit(this.world, exit);
    }

    // Pathfinding grid honors blocking props.
    const collisionGrid = buildCollisionGrid(map, propBlocks);
    const pathfinding = new PathfindingSystem(collisionGrid);
    const movement = new MovementSystem();
    const render = new RenderSystem(this.layers);
    const exits = new ExitSystem();
    this.systems = [pathfinding, movement, exits, render];

    // Toast for blocked-exit messages.
    this.toast = new Toast(ctx.app, this.layers.ui);

    exits.onTrigger(({ exit }) => {
      if (exit.kind === 'transition' && exit.targetScene === 'demo-end') {
        // Defer scene switch: ForestScene.exit() destroys our world/systems
        // synchronously, so doing it inline mid-update would NPE the remaining
        // systems in the same loop iteration.
        queueMicrotask(() => {
          void ctx.scenes.switchTo(new DemoEndScene(), ctx);
        });
      } else if (exit.kind === 'blocked') {
        this.toast?.show(t(exit.messageKey));
      }
    });

    // Center camera on the player spawn.
    const playerWorld = gridToWorld(map.spawn.gx, map.spawn.gy);
    this.viewport.moveCenter(playerWorld.x, playerWorld.y);

    // Input.
    this.input = new InputController({
      app: ctx.app,
      viewport: this.viewport,
      gridWidth: map.size.w,
      gridHeight: map.size.h,
    });
    this.input.onMove((cmd) => {
      if (!this.world || this.playerId === null) return;
      const pf = this.world.getComponent(this.playerId, 'Pathfinder');
      if (!pf) return;
      pf.targetGrid = { gx: cmd.gx, gy: cmd.gy };
      pf.waypoints = null;
      pf.computing = false;
    });
    this.input.onCameraFollowToggle((on) => {
      this.cameraFollow = on;
    });
  }

  exit(ctx: GameContext): void {
    this.toast?.destroy();
    this.toast = null;
    this.input?.destroy();
    this.input = null;
    for (const sys of this.systems) sys.destroy?.();
    this.systems = [];
    this.world = null;
    this.playerId = null;

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
    for (const sys of this.systems) {
      if (!this.world) break; // a previous system may have triggered exit()
      sys.update(dt, this.world);
    }

    if (this.cameraFollow && this.viewport && this.world && this.playerId !== null) {
      const pos = this.world.getComponent(this.playerId, 'Position');
      if (pos) this.viewport.moveCenter(pos.x, pos.y);
    }
  }
}
