import { describe, expect, it } from 'vitest';
import { World } from '@core/ecs/World';

interface Components {
  Position: { x: number; y: number };
  Health: { hp: number };
  Tag: { kind: 'player' | 'mob' };
}

describe('ECS World', () => {
  it('creates entities with unique ids', () => {
    const world = new World<Components>();
    const a = world.createEntity();
    const b = world.createEntity();
    expect(a).not.toBe(b);
    expect(world.entityCount).toBe(2);
  });

  it('adds and gets components by entity', () => {
    const world = new World<Components>();
    const id = world.createEntity();
    world.addComponent(id, 'Position', { x: 1, y: 2 });
    expect(world.getComponent(id, 'Position')).toEqual({ x: 1, y: 2 });
    expect(world.hasComponent(id, 'Position')).toBe(true);
    expect(world.hasComponent(id, 'Health')).toBe(false);
  });

  it('queries entities by component intersection', () => {
    const world = new World<Components>();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const e3 = world.createEntity();
    world.addComponent(e1, 'Position', { x: 0, y: 0 });
    world.addComponent(e1, 'Health', { hp: 10 });
    world.addComponent(e2, 'Position', { x: 5, y: 5 });
    world.addComponent(e3, 'Health', { hp: 3 });

    expect(world.query(['Position']).sort()).toEqual([e1, e2].sort());
    expect(world.query(['Position', 'Health'])).toEqual([e1]);
    expect(world.query(['Tag'])).toEqual([]);
  });

  it('destroyEntity removes all its components', () => {
    const world = new World<Components>();
    const id = world.createEntity();
    world.addComponent(id, 'Position', { x: 0, y: 0 });
    world.addComponent(id, 'Health', { hp: 10 });
    world.destroyEntity(id);
    expect(world.hasComponent(id, 'Position')).toBe(false);
    expect(world.hasComponent(id, 'Health')).toBe(false);
    expect(world.entityCount).toBe(0);
  });

  it('removeComponent only removes the named component', () => {
    const world = new World<Components>();
    const id = world.createEntity();
    world.addComponent(id, 'Position', { x: 0, y: 0 });
    world.addComponent(id, 'Health', { hp: 10 });
    world.removeComponent(id, 'Position');
    expect(world.hasComponent(id, 'Position')).toBe(false);
    expect(world.hasComponent(id, 'Health')).toBe(true);
  });
});
