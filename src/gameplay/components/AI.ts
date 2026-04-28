export type AIBehavior = 'mouse' | 'goblin' | 'cock' | 'trent';

/** Tells AISystem which per-mob handler to dispatch. State is derived from other components. */
export interface AI {
  behavior: AIBehavior;
}
