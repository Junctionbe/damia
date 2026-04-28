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
import { InputController } from '@gameplay/controls/InputController';
import { PathfindingSystem } from '@gameplay/systems/PathfindingSystem';
import { MovementSystem } from '@gameplay/systems/MovementSystem';

const GRID_SIZE = 32;
const PLAYER_SPAWN = { gx: 16, gy: 16 } as const;

export class ForestScene implements Scene {
  readonly name = 'forest';

  private layers: Layers | null = null;
  private viewport: Viewport | null = null;
  private tilemap: TileMap | null = null;
  private world: World<Components> | null = null;
  private systems: System<Components>[] = [];
  private input: InputController | null = null;
  private playerId: Entity | null = null;
  private cameraFollow = false;

  enter(ctx: GameContext): void {
    // Build the visual world.
    this.tilemap = new TileMap({ width: GRID_SIZE, height: GRID_SIZE });
    const bounds = this.tilemap.worldBounds();

    this.viewport = createCamera(ctx.app, {
      worldWidth: bounds.width * 2,
      worldHeight: bounds.height * 2,
    });
    ctx.app.stage.addChild(this.viewport);

    this.layers = new Layers();
    this.layers.mountWorld(this.viewport);
    this.layers.mountUi(ctx.app.stage);

    // Tilemap is drawn around (0,0) in its own local space; we keep it at origin
    // so world coords map 1:1 to iso coords (worldToGrid works without offset).
    this.layers.ground.addChild(this.tilemap.container);

    // Build the ECS world.
    this.world = new World<Components>();
    this.playerId = spawnPlayer(this.world, PLAYER_SPAWN);

    // Build the collision grid (M2: all walkable; M3 will mark obstacles).
    const collisionGrid: number[][] = Array.from({ length: GRID_SIZE }, () =>
      new Array<number>(GRID_SIZE).fill(0),
    );

    this.systems = [
      new PathfindingSystem(collisionGrid),
      new MovementSystem(),
      new RenderSystem(this.layers),
    ];

    // Center the camera on the player's initial position.
    const playerWorld = gridToWorld(PLAYER_SPAWN.gx, PLAYER_SPAWN.gy);
    this.viewport.moveCenter(playerWorld.x, playerWorld.y);

    // Wire input.
    this.input = new InputController({
      app: ctx.app,
      viewport: this.viewport,
      gridWidth: GRID_SIZE,
      gridHeight: GRID_SIZE,
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
    for (const sys of this.systems) sys.update(dt, this.world);

    if (this.cameraFollow && this.viewport && this.playerId !== null) {
      const pos = this.world.getComponent(this.playerId, 'Position');
      if (pos) this.viewport.moveCenter(pos.x, pos.y);
    }
  }
}
