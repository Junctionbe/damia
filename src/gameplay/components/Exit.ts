/**
 * Attached to an entity sitting on an exit cell. The ExitSystem fires when the
 * player enters that cell.
 *
 * `kind: 'transition'` → the scene manager swaps to `targetScene`.
 * `kind: 'blocked'` → a transient toast displays `messageKey`.
 */
export type Exit =
  | {
      kind: 'transition';
      gx: number;
      gy: number;
      targetScene: string;
    }
  | {
      kind: 'blocked';
      gx: number;
      gy: number;
      messageKey: string;
    };
