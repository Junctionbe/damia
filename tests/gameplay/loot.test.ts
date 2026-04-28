import { describe, expect, it } from 'vitest';
import { DROP_CHANCE, ITEMS, rollLoot } from '@data/items';

describe('rollLoot', () => {
  it('returns null when the drop roll meets or exceeds DROP_CHANCE', () => {
    expect(rollLoot(DROP_CHANCE, 0.5)).toBeNull();
    expect(rollLoot(0.99, 0.5)).toBeNull();
  });

  it('returns an item when the drop roll is under DROP_CHANCE', () => {
    expect(rollLoot(0, 0.5)).not.toBeNull();
  });

  it('respects weights — first key wins when rollKind is 0', () => {
    const firstKey = Object.keys(ITEMS)[0];
    expect(rollLoot(0, 0)).toBe(firstKey);
  });

  it('returns the last key when rollKind approaches 1', () => {
    const keys = Object.keys(ITEMS);
    const last = keys[keys.length - 1];
    expect(rollLoot(0, 1 - 1e-9)).toBe(last);
  });
});
