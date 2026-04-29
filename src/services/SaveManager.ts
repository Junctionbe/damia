const KEY = 'damia.save';

export interface SaveDataV1 {
  schemaVersion: 1;
  zone: 'forest';
  player: {
    hp: number;
    maxHp: number;
    gx: number;
    gy: number;
  };
  savedAtMs: number;
}

export const SaveManager = {
  save(payload: Omit<SaveDataV1, 'schemaVersion' | 'savedAtMs'>): void {
    const data: SaveDataV1 = { schemaVersion: 1, savedAtMs: Date.now(), ...payload };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[SaveManager] failed to persist save:', e);
    }
  },

  load(): SaveDataV1 | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { schemaVersion?: number };
      if (parsed.schemaVersion !== 1) return null; // future: migrate
      return parsed as SaveDataV1;
    } catch {
      return null;
    }
  },

  has(): boolean {
    return SaveManager.load() !== null;
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};
