import type { World } from './World';

export interface System<R extends object> {
  /** Called once per frame. dt is in milliseconds. */
  update(dt: number, world: World<R>): void;
  /** Optional teardown (close pending requests, detach listeners). */
  destroy?(): void;
}
