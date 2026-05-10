/**
 * Marker component that suppresses an entity's visual rendering. The
 * RenderSystem hides its sprite and the EntityHudSystem skips its HP bar /
 * target ring when this is present.
 *
 * Used by the fog-of-war pipeline: each frame, the wild scenes tag every
 * non-player Faction entity that's outside the player's current line of sight
 * with `Hidden` (and untag it when it re-enters vision). Simulation systems
 * are unaffected — mobs still tick, take damage, etc., they're just invisible.
 */
export type Hidden = Record<string, never>;
