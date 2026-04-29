/**
 * Marks an entity as a proximity interaction trigger (NPCs placeholders, lore objects, etc.).
 * The InteractableSystem fires the bound listener when the player steps on the cell.
 */
export interface Interactable {
  gx: number;
  gy: number;
  /** i18n key resolved by the scene to a toast / dialog message. */
  messageKey: string;
}
