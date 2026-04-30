import { Container, Graphics, Text } from 'pixi.js';

const PAD_X = 8;
const PAD_Y = 6;

/**
 * Reusable tooltip widget — dark rounded background + multiline text. Used by
 * Hotbar / AdditionsBar / InventoryPanel for hover popups.
 *
 * The tooltip lives inside its host container; the caller positions it via
 * `position` on `node` (or shows it `above(x, y)` for the common "anchor at a
 * point with a small gap" case). It hides itself after construction.
 */
export class Tooltip {
  readonly node: Container;
  private readonly bg: Graphics;
  private readonly text: Text;
  private currentText = '';

  constructor() {
    this.node = new Container({ label: 'tooltip' });
    this.node.visible = false;
    this.bg = new Graphics();
    this.text = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        fill: 0xfaf6e8,
        align: 'center',
      },
    });
    this.node.addChild(this.bg, this.text);
  }

  /** Set the tooltip text (multiline allowed) and rebuild the bg to fit. */
  setText(text: string): void {
    if (text === this.currentText) return;
    this.currentText = text;
    this.text.text = text;
    const w = this.text.width + PAD_X * 2;
    const h = this.text.height + PAD_Y * 2;
    this.bg
      .clear()
      .roundRect(0, 0, w, h, 4)
      .fill({ color: 0x101010, alpha: 0.92 })
      .stroke({ color: 0xa08050, width: 1, alpha: 0.85 });
    this.text.position.set(PAD_X, PAD_Y);
  }

  /** Show the tooltip above (anchorX, anchorY), centred horizontally on it. */
  showAbove(anchorX: number, anchorY: number, gap = 6): void {
    const w = this.text.width + PAD_X * 2;
    const h = this.text.height + PAD_Y * 2;
    this.node.position.set(anchorX - w / 2, anchorY - h - gap);
    this.node.visible = true;
  }

  hide(): void {
    this.node.visible = false;
  }

  destroy(): void {
    this.node.destroy({ children: true });
  }
}
