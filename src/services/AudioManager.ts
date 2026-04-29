/**
 * M7 audio backend. Synthesizes SFX via Web Audio (zero external files) so the
 * pipeline is functional even without the OST. Music is routed through howler
 * once a real file is dropped into `assets/audio/music/` and added to the manifest.
 *
 * Volumes are persisted to localStorage so settings survive reloads.
 */

export type SfxAlias = 'combat.swing' | 'combat.hit' | 'combat.death' | 'items.pickup' | 'ui.click';

export type MusicAlias = 'music.forestAmbient';

// Music manifest will live here once real OST files exist in `assets/audio/music/`;
// `playMusic` is currently a no-op so the API contract is in place for callers.

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
  if (!masterGain || !sfxGain || !musicGain) return;
  masterGain.gain.value = volumes.master;
  sfxGain.gain.value = volumes.sfx;
  musicGain.gain.value = volumes.music;
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
 * Music API ready. M7 ships without an actual OST file; drop one into
 * `assets/audio/music/forest.mp3` and update MUSIC_MANIFEST['music.forestAmbient']
 * to start the ambient track on `playMusic`.
 */
export function playMusic(_alias: MusicAlias): void {
  ensureCtx();
  // No-op until a real file is wired in via howler.
}

export function stopMusic(): void {
  // No-op for now; will fade howler instance once music files exist.
}
