import type { Entity } from './Entity';
import { NULL_ENTITY } from './Entity';

/**
 * Map-of-Maps ECS storage. Plenty fast for our entity counts (hundreds, not millions).
 *
 * Generic `R` is the project-specific component registry: `{ ComponentName: ComponentShape }`.
 * Defined per project in `gameplay/components/index.ts`.
 */
export class World<R extends object> {
  private nextId: Entity = NULL_ENTITY + 1;
  private readonly entities = new Set<Entity>();
  private readonly stores = new Map<keyof R, Map<Entity, unknown>>();

  createEntity(): Entity {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(id: Entity): void {
    if (!this.entities.has(id)) return;
    for (const store of this.stores.values()) store.delete(id);
    this.entities.delete(id);
  }

  addComponent<K extends keyof R>(id: Entity, name: K, data: R[K]): void {
    if (!this.entities.has(id)) {
      throw new Error(`addComponent: unknown entity ${id}`);
    }
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    store.set(id, data);
  }

  removeComponent<K extends keyof R>(id: Entity, name: K): void {
    this.stores.get(name)?.delete(id);
  }

  getComponent<K extends keyof R>(id: Entity, name: K): R[K] | undefined {
    return this.stores.get(name)?.get(id) as R[K] | undefined;
  }

  hasComponent<K extends keyof R>(id: Entity, name: K): boolean {
    return this.stores.get(name)?.has(id) ?? false;
  }

  /**
   * Returns all entities that have ALL of the requested components.
   * Iterates over the smallest store for efficiency.
   */
  query<K extends keyof R>(names: readonly K[]): Entity[] {
    if (names.length === 0) return [...this.entities];
    const stores: Map<Entity, unknown>[] = [];
    for (const name of names) {
      const store = this.stores.get(name);
      if (!store) return []; // No entity has this component yet.
      stores.push(store);
    }
    stores.sort((a, b) => a.size - b.size);
    const smallestStore = stores[0];
    if (!smallestStore) return [];
    const rest = stores.slice(1);
    const result: Entity[] = [];
    for (const id of smallestStore.keys()) {
      let matches = true;
      for (const store of rest) {
        if (!store.has(id)) {
          matches = false;
          break;
        }
      }
      if (matches) result.push(id);
    }
    return result;
  }

  get entityCount(): number {
    return this.entities.size;
  }
}
