/**
 * VisibilityManager — distance-based visibility and house LOD with hysteresis.
 * Runs a few times per second; frustum culling handles the rest in the renderer.
 */
import * as THREE from 'three';
import type { ChunkManager } from '../world/ChunkManager';
import type { QualityProfile } from '../game/GameConfig';

const HYSTERESIS = 3; // metres
const LOD_HYSTERESIS = 4;

interface HouseRuntime {
  lod0: THREE.Object3D;
  lod1: THREE.Object3D;
  x: number;
  z: number;
  detailed: boolean;
}

export class VisibilityManager {
  private houses: HouseRuntime[] = [];
  private envGroups: { obj: THREE.Object3D; x: number; z: number; visible: boolean }[] = [];
  private timer = 0;
  private scannedChunks = new WeakSet<object>();

  setProfile(_profile: QualityProfile): void {
    // Profiles are supplied per-update; kept as an explicit hook for future caching.
  }

  /** Discover per-chunk detail objects the first time each chunk becomes ready. */
  private scan(chunkManager: ChunkManager): void {
    for (const chunk of chunkManager.all()) {
      if (!chunk.group) continue;
      if (this.scannedChunks.has(chunk.group)) continue;
      this.scannedChunks.add(chunk.group);
      for (const house of chunk.houses) {
        this.houses.push({ lod0: house.lod0, lod1: house.lod1, x: house.cx, z: house.cz, detailed: true });
      }
      const env = chunk.group.getObjectByName('env');
      if (env) {
        this.envGroups.push({ obj: env, x: chunk.centerX, z: chunk.centerZ, visible: true });
      }
    }
  }

  update(playerX: number, playerZ: number, chunkManager: ChunkManager, profile: QualityProfile, dt = 0): void {
    this.timer -= dt;
    // Discovery can run every update (cheap set-based check); evaluation is throttled.
    this.scan(chunkManager);
    if (this.timer > 0) return;
    this.timer = 0.2;

    const foliage = profile.foliageDistance;
    const detail = profile.detailDistance;

    for (const house of this.houses) {
      const dist = Math.hypot(house.x - playerX, house.z - playerZ);
      const wantDetailed = house.detailed
        ? dist < detail + LOD_HYSTERESIS
        : dist < detail - LOD_HYSTERESIS;
      if (wantDetailed !== house.detailed) {
        house.detailed = wantDetailed;
        house.lod0.visible = wantDetailed;
        house.lod1.visible = !wantDetailed;
      }
    }

    for (const env of this.envGroups) {
      const dist = Math.hypot(env.x - playerX, env.z - playerZ);
      const wantVisible = env.visible
        ? dist < foliage + HYSTERESIS
        : dist < foliage - HYSTERESIS;
      if (wantVisible !== env.visible) {
        env.visible = wantVisible;
        env.obj.visible = wantVisible;
      }
    }
  }

  reset(): void {
    this.houses.length = 0;
    this.envGroups.length = 0;
    this.scannedChunks = new WeakSet<object>();
    this.timer = 0;
  }
}
