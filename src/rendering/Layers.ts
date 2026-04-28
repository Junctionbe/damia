import { Container } from 'pixi.js';

export type LayerName = 'ground' | 'entities' | 'fx' | 'ui';

export class Layers {
  readonly ground: Container;
  readonly entities: Container;
  readonly fx: Container;
  readonly ui: Container;

  constructor() {
    this.ground = new Container({ label: 'ground' });
    this.entities = new Container({ label: 'entities', isRenderGroup: true });
    this.entities.sortableChildren = true; // for iso depth sort via zIndex
    this.fx = new Container({ label: 'fx' });
    this.ui = new Container({ label: 'ui' });
  }

  /** Mount ground/entities/fx into a world parent (e.g. viewport). UI mounts at app stage level. */
  mountWorld(worldParent: Container): void {
    worldParent.addChild(this.ground, this.entities, this.fx);
  }

  mountUi(uiParent: Container): void {
    uiParent.addChild(this.ui);
  }

  destroy(): void {
    this.ground.destroy({ children: true });
    this.entities.destroy({ children: true });
    this.fx.destroy({ children: true });
    this.ui.destroy({ children: true });
  }
}
