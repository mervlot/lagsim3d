/**
 * Chunk-based world streaming.
 * Chunks move through Unloaded → Loading → Ready → Active/Inactive → Unloaded.
 * Visuals are created/destroyed with the chunk; collision stays resident for
 * the lifetime of the level so the player can never fall through hidden geometry.
 */
import * as THREE from 'three';
import type { WorldCollision, AABB } from './WorldCollision';
import type { HouseModel } from './HouseFactory';
import { prioritizeChunks, LoadQueue, type ChunkInfo } from '../performance/PredictiveLoader';
import { assetCache } from '../performance/AssetCache';

export enum ChunkState {
  Unloaded = 'unloaded',
  Loading = 'loading',
  Ready = 'ready',
  Active = 'active',
  Inactive = 'inactive',
}

export interface ChunkContent {
  group: THREE.Group;
  houses: HouseModel[];
  colliders: AABB[];
}

export interface ChunkMetrics {
  built: number;
  disposed: number;
  duplicateBuildsPrevented: number;
}

export class Chunk {
  readonly key: string;
  readonly cx: number;
  readonly cz: number;
  readonly centerX: number;
  readonly centerZ: number;
  state: ChunkState = ChunkState.Unloaded;
  group: THREE.Group | null = null;
  houses: HouseModel[] = [];
  colliders: AABB[] = [];
  /** Collision AABBs are added to the world exactly once and stay resident. */
  collisionRegistered = false;

  constructor(key: string, cx: number, cz: number, centerX: number, centerZ: number) {
    this.key = key;
    this.cx = cx;
    this.cz = cz;
    this.centerX = centerX;
    this.centerZ = centerZ;
  }
}

export type ChunkContentBuilder = (chunk: Chunk) => ChunkContent;

export interface ChunkManagerOptions {
  scene: THREE.Group;
  collision: WorldCollision;
  chunkSize: number;
  buildContent: ChunkContentBuilder;
  /** Distance beyond which loaded chunks are unloaded. */
  unloadDistance: number;
}

export class ChunkManager {
  private scene: THREE.Group;
  private collision: WorldCollision;
  private chunkSize: number;
  private buildContent: ChunkContentBuilder;
  private unloadDistance: number;
  private chunks = new Map<string, Chunk>();
  private queue = new LoadQueue();
  private info: ChunkInfo[] = [];
  private rebuildTimer = 0;
  readonly metrics: ChunkMetrics = { built: 0, disposed: 0, duplicateBuildsPrevented: 0 };

  constructor(opts: ChunkManagerOptions) {
    this.scene = opts.scene;
    this.collision = opts.collision;
    this.chunkSize = opts.chunkSize;
    this.buildContent = opts.buildContent;
    this.unloadDistance = opts.unloadDistance;
  }

  register(cx: number, cz: number): Chunk {
    const key = cx + ':' + cz;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const centerX = (cx + 0.5) * this.chunkSize;
      const centerZ = (cz + 0.5) * this.chunkSize;
      chunk = new Chunk(key, cx, cz, centerX, centerZ);
      this.chunks.set(key, chunk);
      this.info.push({ key, cx, cz, x: centerX, z: centerZ });
    }
    return chunk;
  }

  get(key: string): Chunk | undefined {
    return this.chunks.get(key);
  }

  all(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  get size(): number {
    return this.chunks.size;
  }

  stateOf(key: string): ChunkState {
    return this.chunks.get(key)?.state ?? ChunkState.Unloaded;
  }

  /** Build one chunk immediately (also used by tests). */
  buildNow(key: string): boolean {
    const chunk = this.chunks.get(key);
    if (!chunk || chunk.state !== ChunkState.Unloaded) {
      this.metrics.duplicateBuildsPrevented++;
      return false;
    }
    chunk.state = ChunkState.Loading;
    const content = this.buildContent(chunk);
    chunk.group = content.group;
    chunk.houses = content.houses;
    chunk.colliders = content.colliders;
    chunk.group.visible = false;
    this.scene.add(chunk.group);
    if (!chunk.collisionRegistered) {
      for (const box of content.colliders) {
        this.collision.addBox(box.minX, box.minZ, box.maxX, box.maxZ);
      }
      // Collision is deterministic and stays resident for the level lifetime.
      chunk.collisionRegistered = true;
    }
    chunk.state = ChunkState.Ready;
    this.metrics.built++;
    return true;
  }

  private unload(chunk: Chunk): void {
    if (chunk.group) {
      this.scene.remove(chunk.group);
      disposeGroup(chunk.group);
      chunk.group = null;
    }
    chunk.houses = [];
    // Collision stays: this.collision keeps the AABBs for safety.
    chunk.state = ChunkState.Unloaded;
    this.metrics.disposed++;
  }

  /**
   * Streaming tick: predictive loading within a frame-time budget, plus
   * Active/Inactive transitions and far-chunk unload.
   */
  update(
    dt: number,
    playerX: number,
    playerZ: number,
    velX: number,
    velZ: number,
    speed: number,
    camX: number,
    camZ: number,
    activeDistance: number,
    budgetMs: number,
  ): void {
    this.rebuildTimer -= dt;
    if (this.rebuildTimer <= 0) {
      this.rebuildTimer = 0.25;
      const priority = prioritizeChunks(this.info, {
        playerX, playerZ, velX, velZ, speed, camX, camZ, chunkSize: this.chunkSize,
      });
      const needed: string[] = [];
      const neededSet = new Set<string>();
      for (const p of priority) {
        const chunk = this.chunks.get(p.key);
        if (!chunk) continue;
        const dist = Math.hypot(chunk.centerX - playerX, chunk.centerZ - playerZ);
        if (dist > this.unloadDistance) continue;
        if (chunk.state === ChunkState.Unloaded) {
          needed.push(p.key);
          neededSet.add(p.key);
        }
      }
      this.queue.refill(needed);
      this.queue.cancelExcept(neededSet);
    }

    // State transitions for already-built chunks.
    for (const chunk of this.chunks.values()) {
      const dist = Math.hypot(chunk.centerX - playerX, chunk.centerZ - playerZ);
      if (chunk.state === ChunkState.Active && dist > activeDistance) {
        chunk.state = ChunkState.Inactive;
        if (chunk.group) chunk.group.visible = false;
      } else if ((chunk.state === ChunkState.Inactive || chunk.state === ChunkState.Ready) && dist <= activeDistance) {
        chunk.state = ChunkState.Active;
        if (chunk.group) chunk.group.visible = true;
      } else if ((chunk.state === ChunkState.Active || chunk.state === ChunkState.Inactive || chunk.state === ChunkState.Ready) && dist > this.unloadDistance) {
        this.unload(chunk);
      }
    }

    // Budgeted builds.
    if (this.queue.size > 0) {
      const start = performance.now();
      let built = 0;
      while (this.queue.size > 0 && performance.now() - start < budgetMs && built < 2) {
        const key = this.queue.dequeue();
        if (!key) break;
        const chunk = this.chunks.get(key);
        if (!chunk || chunk.state !== ChunkState.Unloaded) continue;
        this.buildNow(key);
        built++;
      }
    }
  }

  /** Build every registered chunk synchronously (initial load / tests). */
  buildAll(): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.state === ChunkState.Unloaded) this.buildNow(chunk.key);
    }
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.group) {
        this.scene.remove(chunk.group);
        disposeGroup(chunk.group);
        chunk.group = null;
      }
      chunk.houses = [];
      chunk.state = ChunkState.Unloaded;
    }
    this.queue.clear();
  }
}

/** Dispose only geometries that are not shared through the asset cache. */
function disposeGroup(root: THREE.Object3D): void {
  root.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !assetCache.isShared(mesh.geometry)) {
      mesh.geometry.dispose();
    }
    const instanced = obj as THREE.InstancedMesh;
    if ((obj as { isInstancedMesh?: boolean }).isInstancedMesh && instanced.instanceMatrix) {
      instanced.dispose();
    }
  });
}
