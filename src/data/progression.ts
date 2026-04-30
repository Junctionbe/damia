import { DART_XP_TO_REACH_LEVEL } from './dart';

/**
 * Cumulative XP needed to *reach* `level`. TLoD-style: XP keeps accumulating
 * across level-ups (the counter never resets), and `xpThresholdForLevel(N)`
 * gives the total threshold for level N. Currently routes to Dart's table —
 * other characters have slightly different curves; switch to a per-character
 * lookup when more playables are added.
 *
 *   xpThresholdForLevel(1) === 0           (start)
 *   xpThresholdForLevel(2) === 20          (Dart's level-up to LV2)
 *   xpThresholdForLevel(60) === 382000     (cap)
 *   xpThresholdForLevel(>60) clamps to 382000.
 */
export function xpThresholdForLevel(level: number): number {
  const idx = Math.max(1, Math.min(DART_XP_TO_REACH_LEVEL.length, Math.round(level))) - 1;
  return DART_XP_TO_REACH_LEVEL[idx]!;
}
