import type { Application } from 'pixi.js';
import { Container, Graphics, Text } from 'pixi.js';
import { t, getLanguage, setLanguage, SUPPORTED_LANGUAGES } from '@services/I18nService';
import {
  getVolumes,
  playSfx,
  setMasterVolume,
  setMusicVolume,
  setSfxVolume,
} from '@services/AudioManager';

const PANEL_WIDTH = 460;
const PANEL_HEIGHT = 440;
const ROW_HEIGHT = 44;
const VOLUME_STEP = 0.1;

export type SettingsPanelAction = 'resume' | 'quit-to-title';

/**
 * Esc-toggled settings overlay. Provides volume +/- controls (10% step),
 * a language toggle (full reload via I18nService.setLanguage), and Resume /
 * Quit-to-Title buttons. The scene wires the action callback.
 */
export class SettingsPanel {
  readonly container: Container;
  private readonly panel: Container;
  private readonly app: Application;
  private readonly cleanups: Array<() => void> = [];
  private actionListener: ((action: SettingsPanelAction) => void) | null = null;
  private masterValueText!: Text;
  private musicValueText!: Text;
  private sfxValueText!: Text;
  private langValueText!: Text;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container({ label: 'settings-panel' });
    this.container.visible = false;

    const dim = new Graphics()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: 0x000000, alpha: 0.65 });
    dim.eventMode = 'static';
    this.container.addChild(dim);

    this.panel = new Container({ label: 'settings-panel-box' });
    this.container.addChild(this.panel);
    this.buildPanel();

    this.reposition();
    app.renderer.on('resize', () => {
      dim
        .clear()
        .rect(0, 0, app.screen.width, app.screen.height)
        .fill({ color: 0x000000, alpha: 0.65 });
      this.reposition();
    });

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        this.toggle();
        playSfx('ui.click');
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanups.push(() => window.removeEventListener('keydown', onKey));
  }

  onAction(listener: (action: SettingsPanelAction) => void): void {
    this.actionListener = listener;
  }

  show(): void {
    this.refreshValues();
    this.container.visible = true;
  }
  hide(): void {
    this.container.visible = false;
  }
  toggle(): void {
    if (this.container.visible) this.hide();
    else this.show();
  }
  get isOpen(): boolean {
    return this.container.visible;
  }

  destroy(): void {
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    this.container.destroy({ children: true });
  }

  private buildPanel(): void {
    const bg = new Graphics()
      .roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8)
      .fill({ color: 0x101814, alpha: 0.98 })
      .stroke({ width: 2, color: 0xa08050 });
    this.panel.addChild(bg);

    const title = new Text({
      text: t('settings.title'),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 28,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(PANEL_WIDTH / 2, 18);
    this.panel.addChild(title);

    let y = 80;
    this.masterValueText = this.addVolumeRow(t('settings.master'), y, 'master');
    y += ROW_HEIGHT;
    this.musicValueText = this.addVolumeRow(t('settings.music'), y, 'music');
    y += ROW_HEIGHT;
    this.sfxValueText = this.addVolumeRow(t('settings.sfx'), y, 'sfx');
    y += ROW_HEIGHT + 16;
    this.langValueText = this.addLangRow(t('settings.language'), y);
    y += ROW_HEIGHT + 24;

    this.addActionButton(t('settings.resume'), y, 'resume');
    y += ROW_HEIGHT;
    this.addActionButton(t('settings.quitToTitle'), y, 'quit-to-title');
  }

  private addVolumeRow(label: string, y: number, kind: 'master' | 'music' | 'sfx'): Text {
    const labelText = new Text({
      text: label,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 16, fill: 0xddcfae },
    });
    labelText.position.set(28, y + 8);
    this.panel.addChild(labelText);

    const valueText = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 16, fill: 0xfaf6e8 },
    });
    valueText.anchor.set(1, 0);
    valueText.position.set(PANEL_WIDTH - 100, y + 8);
    this.panel.addChild(valueText);

    this.makeStepperButton('-', PANEL_WIDTH - 80, y + 4, () =>
      this.adjustVolume(kind, -VOLUME_STEP),
    );
    this.makeStepperButton('+', PANEL_WIDTH - 40, y + 4, () =>
      this.adjustVolume(kind, VOLUME_STEP),
    );
    return valueText;
  }

  private adjustVolume(kind: 'master' | 'music' | 'sfx', delta: number): void {
    playSfx('ui.click');
    const v = getVolumes();
    const next = Math.max(0, Math.min(1, v[kind] + delta));
    if (kind === 'master') setMasterVolume(next);
    else if (kind === 'music') setMusicVolume(next);
    else setSfxVolume(next);
    this.refreshValues();
  }

  private addLangRow(label: string, y: number): Text {
    const labelText = new Text({
      text: label,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 16, fill: 0xddcfae },
    });
    labelText.position.set(28, y + 8);
    this.panel.addChild(labelText);

    const valueText = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 16, fill: 0xfaf6e8 },
    });
    valueText.anchor.set(1, 0);
    valueText.position.set(PANEL_WIDTH - 100, y + 8);
    this.panel.addChild(valueText);

    this.makeStepperButton('<', PANEL_WIDTH - 80, y + 4, () => this.cycleLanguage(-1));
    this.makeStepperButton('>', PANEL_WIDTH - 40, y + 4, () => this.cycleLanguage(1));
    return valueText;
  }

  private cycleLanguage(direction: number): void {
    playSfx('ui.click');
    const cur = getLanguage();
    const idx = SUPPORTED_LANGUAGES.indexOf(cur);
    const next =
      SUPPORTED_LANGUAGES[
        (idx + direction + SUPPORTED_LANGUAGES.length) % SUPPORTED_LANGUAGES.length
      ];
    if (next && next !== cur) setLanguage(next);
  }

  private addActionButton(label: string, y: number, action: SettingsPanelAction): void {
    const btn = new Container();
    const bg = new Graphics()
      .roundRect(0, 0, PANEL_WIDTH - 56, ROW_HEIGHT - 8, 5)
      .fill({ color: 0x202820 })
      .stroke({ width: 1, color: 0xa08050 });
    const text = new Text({
      text: label,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 16, fill: 0xfaf6e8 },
    });
    text.anchor.set(0.5);
    text.position.set((PANEL_WIDTH - 56) / 2, (ROW_HEIGHT - 8) / 2);
    btn.addChild(bg, text);
    btn.position.set(28, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      playSfx('ui.click');
      this.actionListener?.(action);
    });
    btn.on('pointerover', () => {
      bg.tint = 0xc8b58a;
    });
    btn.on('pointerout', () => {
      bg.tint = 0xffffff;
    });
    this.panel.addChild(btn);
  }

  private makeStepperButton(label: string, x: number, y: number, onClick: () => void): void {
    const size = 32;
    const btn = new Container();
    const bg = new Graphics()
      .roundRect(0, 0, size, size, 4)
      .fill({ color: 0x202820 })
      .stroke({ width: 1, color: 0xa08050 });
    const text = new Text({
      text: label,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 18,
        fill: 0xfaf6e8,
        fontWeight: 'bold',
      },
    });
    text.anchor.set(0.5);
    text.position.set(size / 2, size / 2 - 1);
    btn.addChild(bg, text);
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', onClick);
    btn.on('pointerover', () => {
      bg.tint = 0xc8b58a;
    });
    btn.on('pointerout', () => {
      bg.tint = 0xffffff;
    });
    this.panel.addChild(btn);
  }

  private refreshValues(): void {
    const v = getVolumes();
    this.masterValueText.text = `${Math.round(v.master * 100)}%`;
    this.musicValueText.text = `${Math.round(v.music * 100)}%`;
    this.sfxValueText.text = `${Math.round(v.sfx * 100)}%`;
    this.langValueText.text = getLanguage().toUpperCase();
  }

  private reposition(): void {
    this.panel.position.set(
      (this.app.screen.width - PANEL_WIDTH) / 2,
      (this.app.screen.height - PANEL_HEIGHT) / 2,
    );
  }
}
