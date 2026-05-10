/**
 * Device-capability helpers. Used by the scene wiring to decide whether to
 * mount the touch overlay (joystick + on-screen buttons) instead of (or in
 * addition to) the keyboard / mouse pipeline.
 *
 * Detection is a single point-in-time check at scene enter — we don't try to
 * react to a hybrid device sprouting a touch screen mid-session. If the user
 * later plugs in a mouse on a touch laptop, the joystick stays visible and
 * the mouse still works alongside it (pointer events are unified).
 */

/** True when the current browser advertises any touch input capability. We
 *  union both heuristics because either alone misses some devices: the
 *  legacy `ontouchstart` lives on iPhones / Android, while
 *  `navigator.maxTouchPoints` is what surface laptops + Chromebooks expose. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  );
}
