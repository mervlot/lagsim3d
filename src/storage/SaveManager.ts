/**
 * SaveManager — persistent settings and last position.
 * IndexedDB with graceful fallback to localStorage, then in-memory.
 */
import { clampSettings, DEFAULT_SETTINGS, type GameSettings } from '../game/GameConfig';

const DB_NAME = 'lagos-sim-3d';
const DB_VERSION = 1;
const STORE = 'kv';

export interface SaveData {
  settings: GameSettings;
  lastX: number | null;
  lastZ: number | null;
  lastYaw: number | null;
}

type Backend = 'idb' | 'local' | 'memory';

export class SaveManager {
  private db: IDBDatabase | null = null;
  private backend: Backend = 'memory';
  private memory = new Map<string, unknown>();
  private ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  private init(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        this.backend = typeof localStorage !== 'undefined' ? 'local' : 'memory';
        resolve();
        return;
      }
      let settled = false;
      const finish = (backend: Backend): void => {
        if (settled) return;
        settled = true;
        this.backend = backend;
        resolve();
      };
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        request.onsuccess = () => {
          this.db = request.result;
          finish('idb');
        };
        request.onerror = () => finish(typeof localStorage !== 'undefined' ? 'local' : 'memory');
        request.onblocked = () => finish('local');
        setTimeout(() => finish(this.db ? 'idb' : 'local'), 1500);
      } catch {
        finish(typeof localStorage !== 'undefined' ? 'local' : 'memory');
      }
    });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  getBackend(): Backend {
    return this.backend;
  }

  private idbGet<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve) => {
      if (!this.db) return resolve(undefined);
      try {
        const tx = this.db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  }

  private idbSet(key: string, value: unknown): Promise<void> {
    return new Promise((resolve) => {
      if (!this.db) return resolve();
      try {
        const tx = this.db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.ready;
    if (this.backend === 'idb') return this.idbGet<T>(key);
    if (this.backend === 'local') {
      try {
        const raw = localStorage.getItem('lagos-sim-3d:' + key);
        return raw ? (JSON.parse(raw) as T) : undefined;
      } catch {
        return undefined;
      }
    }
    return this.memory.get(key) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ready;
    if (this.backend === 'idb') await this.idbSet(key, value);
    else if (this.backend === 'local') {
      try {
        localStorage.setItem('lagos-sim-3d:' + key, JSON.stringify(value));
      } catch {
        /* storage full or blocked */
      }
    } else {
      this.memory.set(key, value);
    }
  }

  async loadSettings(): Promise<GameSettings> {
    const raw = await this.get<unknown>('settings');
    return clampSettings(raw);
  }

  async saveSettings(settings: GameSettings): Promise<void> {
    await this.set('settings', settings);
  }

  /** Returns a validated spawn override, or null to use the default spawn. */
  async loadLastPosition(defaultSpawn: { x: number; z: number; yaw: number }): Promise<{ x: number; z: number; yaw: number } | null> {
    const raw = await this.get<{ x: unknown; z: unknown; yaw: unknown }>('position');
    if (!raw || typeof raw !== 'object') return null;
    const { x, z, yaw } = raw;
    if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    if (Math.abs(x) > 100 || Math.abs(z) > 100) return null;
    const safeYaw = typeof yaw === 'number' && Number.isFinite(yaw) ? yaw : defaultSpawn.yaw;
    return { x, z, yaw: safeYaw };
  }

  async savePosition(x: number, z: number, yaw: number): Promise<void> {
    await this.set('position', { x, z, yaw, savedAt: Date.now() });
  }

  async clearAll(): Promise<void> {
    await this.set('settings', DEFAULT_SETTINGS);
    await this.set('position', null);
  }
}
