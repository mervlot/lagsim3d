/**
 * MemoryManager — light bookkeeping of GPU resource counts and scene-graph
 * size so runaway growth is visible in the debug overlay and console.
 */
import type * as THREE from 'three';
import { assetCache } from './AssetCache';

export interface MemorySnapshot {
  geometries: number;
  materials: number;
  textures: number;
  sceneObjects: number;
}

export class MemoryManager {
  private lastLog = 0;
  private scene: THREE.Object3D | null = null;

  watch(scene: THREE.Object3D): void {
    this.scene = scene;
  }

  snapshot(): MemorySnapshot {
    let sceneObjects = 0;
    if (this.scene) {
      this.scene.traverse(() => {
        sceneObjects++;
      });
    }
    const stats = assetCache.stats();
    return { ...stats, sceneObjects };
  }

  /** Warn when scene-graph growth looks unhealthy (throttled). */
  check(nowMs: number, budget = 4000): void {
    if (nowMs - this.lastLog < 10000) return;
    this.lastLog = nowMs;
    const snap = this.snapshot();
    if (snap.sceneObjects > budget) {
      console.warn(`[MemoryManager] scene graph is large: ${snap.sceneObjects} objects`, snap);
    }
  }
}
