/**
 * Audio backend. SFX are still synthesized via Web Audio (zero file dependency,
 * see `playSfx`); music is streamed via howler from the MUSIC_MANIFEST.
 *
 * Volumes are persisted to localStorage so settings survive reloads.
 *
 * Swap-out path: replace any MUSIC_MANIFEST entry with a different file URL —
 * call sites only know the alias. SFX can later get the same treatment by
 * extending `playSfx` to look up a SFX_MANIFEST.
 */
import { Howl } from 'howler';

export type SfxAlias = 'combat.swing' | 'combat.hit' | 'combat.death' | 'items.pickup' | 'ui.click';

export type MusicAlias = 'music.forestAmbient' | 'music.titleScreen';

interface MusicEntry {
  url: string;
  /** Per-track playback volume relative to the music gain (1.0 = unchanged). */
  trackVolume?: number;
}

const MUSIC_MANIFEST: Record<MusicAlias, MusicEntry> = {
  'music.forestAmbient': { url: '/audio/music/forest.ogg', trackVolume: 0.9 },
  'music.titleScreen': { url: '/audio/music/title.ogg', trackVolume: 0.85 },
};

const STORAGE_KEY = 'damia.audio';

interface VolumeState {
  master: number;
  music: number;
  sfx: number;
}

const DEFAULT_VOLUMES: VolumeState = { master: 0.7, music: 0.5, sfx: 0.6 };

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let volumes: VolumeState = { ...DEFAULT_VOLUMES };
let initialized = false;
let pendingResume = false;
/** Cached Howl instances per alias so re-entering the same scene reuses the loaded buffer. */
const musicHowls = new Map<MusicAlias, Howl>();
let currentMusic: { alias: MusicAlias; howl: Howl } | null = null;

function readVolumes(): VolumeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOLUMES };
    const parsed = JSON.parse(raw) as Partial<VolumeState>;
    return {
      master: clamp(parsed.master ?? DEFAULT_VOLUMES.master),
      music: clamp(parsed.music ?? DEFAULT_VOLUMES.music),
      sfx: clamp(parsed.sfx ?? DEFAULT_VOLUMES.sfx),
    };
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

function writeVolumes(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes));
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function ensureCtx(): void {
  if (initialized) return;
  initialized = true;
  volumes = readVolumes();
  try {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyGains();
  } catch {
    ctx = null;
  }
}

function applyGains(): void {
  if (masterGain && sfxGain && musicGain) {
    masterGain.gain.value = volumes.master;
    sfxGain.gain.value = volumes.sfx;
    musicGain.gain.value = volumes.music;
  }
  // Howler has its own audio graph (HTMLAudioElement-backed by default),
  // independent from our Web Audio context. Mirror our gains onto it so the
  // settings sliders affect both pipelines.
  syncMusicHowlVolume();
}

function syncMusicHowlVolume(): void {
  if (!currentMusic) return;
  const entry = MUSIC_MANIFEST[currentMusic.alias];
  const trackVol = entry.trackVolume ?? 1;
  currentMusic.howl.volume(volumes.master * volumes.music * trackVol);
}

/**
 * Browsers block AudioContext until a user gesture. Call this from a click handler
 * once at startup; subsequent calls are no-ops.
 */
export function unlockAudio(): void {
  ensureCtx();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume();
  }
  pendingResume = false;
}

export function initAudioManager(): void {
  ensureCtx();
  // Pause/resume on tab visibility.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (!pendingResume) void ctx.resume();
  });
}

export function getVolumes(): VolumeState {
  return { ...volumes };
}

export function setMasterVolume(v: number): void {
  volumes.master = clamp(v);
  applyGains();
  writeVolumes();
}
export function setMusicVolume(v: number): void {
  volumes.music = clamp(v);
  applyGains();
  writeVolumes();
}
export function setSfxVolume(v: number): void {
  volumes.sfx = clamp(v);
  applyGains();
  writeVolumes();
}

export function playSfx(alias: SfxAlias): void {
  ensureCtx();
  if (!ctx || !sfxGain) return;
  const now = ctx.currentTime;
  switch (alias) {
    case 'combat.swing':
      tone(now, 220, 80, 'sawtooth', 0.25);
      tone(now + 0.02, 110, 60, 'sawtooth', 0.2);
      break;
    case 'combat.hit':
      noiseBurst(now, 90, 0.4);
      tone(now, 320, 60, 'square', 0.15);
      break;
    case 'combat.death':
      tone(now, 330, 120, 'square', 0.3);
      tone(now + 0.1, 220, 180, 'square', 0.25);
      tone(now + 0.25, 110, 240, 'square', 0.2);
      break;
    case 'items.pickup':
      tone(now, 660, 80, 'sine', 0.3);
      tone(now + 0.06, 990, 120, 'sine', 0.3);
      break;
    case 'ui.click':
      tone(now, 800, 30, 'square', 0.18);
      break;
  }
}

function tone(
  startTime: number,
  freq: number,
  durationMs: number,
  type: OscillatorType,
  vol: number,
): void {
  if (!ctx || !sfxGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const dur = durationMs / 1000;
  gain.gain.setValueAtTime(vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
  osc.connect(gain).connect(sfxGain);
  osc.start(startTime);
  osc.stop(startTime + dur + 0.02);
}

function noiseBurst(startTime: number, durationMs: number, vol: number): void {
  if (!ctx || !sfxGain) return;
  const dur = durationMs / 1000;
  const sampleCount = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
  src.connect(gain).connect(sfxGain);
  src.start(startTime);
  src.stop(startTime + dur + 0.02);
}

/**
 * Start a looping music track. If another track is already playing it's faded
 * out and replaced. Re-calling with the same alias is a no-op (avoids restart
 * when the scene re-enters via continue/quick-load).
 */
export function playMusic(alias: MusicAlias): void {
  ensureCtx();
  if (currentMusic?.alias === alias && currentMusic.howl.playing()) return;

  if (currentMusic && currentMusic.alias !== alias) {
    fadeOutAndStop(currentMusic.howl);
    currentMusic = null;
  }

  let howl = musicHowls.get(alias);
  if (!howl) {
    howl = new Howl({
      src: [MUSIC_MANIFEST[alias].url],
      loop: true,
      html5: true, // stream large files without decoding the whole buffer
      preload: true,
      volume: 0,
    });
    musicHowls.set(alias, howl);
  }

  currentMusic = { alias, howl };
  syncMusicHowlVolume();
  if (!howl.playing()) howl.play();
}

export function stopMusic(): void {
  if (!currentMusic) return;
  fadeOutAndStop(currentMusic.howl);
  currentMusic = null;
}

function fadeOutAndStop(howl: Howl): void {
  const from = howl.volume();
  howl.fade(from, 0, 400);
  setTimeout(() => howl.stop(), 450);
}
