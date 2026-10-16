/**
 * In-memory cache for shared geometries, materials and procedural textures.
 * Guarantees a single GPU resource per key and tracks counts for memory monitoring.
 */
import * as THREE from 'three';

export interface AssetStats {
  geometries: number;
  materials: number;
  textures: number;
}

export class AssetCache {
  private geometries = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<string, THREE.Material>();
  private textures = new Map<string, THREE.Texture>();
  /** Every geometry handed out — used to decide what is safe to dispose. */
  private sharedGeometries = new Set<THREE.BufferGeometry>();
  /** Resources pinned for the lifetime of the game (shared across chunks). */
  private pinned = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();

  getGeometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geometries.get(key);
    if (!g) {
      g = factory();
      g.name = key;
      this.geometries.set(key, g);
    }
    this.sharedGeometries.add(g);
    return g;
  }

  /** True when a geometry came from this cache (shared — do not dispose per-owner). */
  isShared(geo: THREE.BufferGeometry): boolean {
    return this.sharedGeometries.has(geo);
  }

  getMaterial(key: string, factory: () => THREE.Material): THREE.Material {
    let m = this.materials.get(key);
    if (!m) {
      m = factory();
      m.name = key;
      this.materials.set(key, m);
    }
    return m;
  }

  getTexture(key: string, factory: () => THREE.Texture): THREE.Texture {
    let t = this.textures.get(key);
    if (!t) {
      t = factory();
      t.name = key;
      this.textures.set(key, t);
    }
    return t;
  }

  has(key: string): boolean {
    return this.geometries.has(key) || this.materials.has(key) || this.textures.has(key);
  }

  pin(key: string): void {
    const g = this.geometries.get(key);
    const m = this.materials.get(key);
    const t = this.textures.get(key);
    if (g) this.pinned.add(g);
    if (m) this.pinned.add(m);
    if (t) this.pinned.add(t);
  }

  /** Number of live GPU-side resources. */
  stats(): AssetStats {
    return {
      geometries: this.geometries.size,
      materials: this.materials.size,
      textures: this.textures.size,
    };
  }

  dispose(): void {
    for (const g of this.geometries.values()) if (!this.pinned.has(g)) g.dispose();
    for (const m of this.materials.values()) if (!this.pinned.has(m)) m.dispose();
    for (const t of this.textures.values()) if (!this.pinned.has(t)) t.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.sharedGeometries.clear();
    this.pinned.clear();
  }
}

export const assetCache = new AssetCache();
