/**
 * Predictive chunk loading — pure prioritisation logic (no three.js).
 * Combines distance, player movement direction and camera view direction into a
 * single priority score; the ChunkManager consumes the ordered list each tick.
 */

export interface ChunkInfo {
  key: string;
  cx: number;
  cz: number;
  /** Chunk centre in world metres. */
  x: number;
  z: number;
}

export interface PredictionInputs {
  playerX: number;
  playerZ: number;
  /** Normalised movement direction (may be zero). */
  velX: number;
  velZ: number;
  speed: number;
  /** Normalised camera forward direction in XZ. */
  camX: number;
  camZ: number;
  chunkSize: number;
}

export interface PrioritizedChunk {
  key: string;
  score: number;
}

/**
 * Lower score = higher priority. Conservative prediction: distance dominates,
 * movement and camera add modest bonuses so sudden turns adapt quickly.
 */
export function prioritizeChunks(chunks: readonly ChunkInfo[], inputs: PredictionInputs): PrioritizedChunk[] {
  const { playerX, playerZ, velX, velZ, speed, camX, camZ, chunkSize } = inputs;
  const half = chunkSize / 2;
  const moveBonus = Math.min(1, speed / 6);
  const out: PrioritizedChunk[] = [];
  for (const chunk of chunks) {
    // Distance to the nearest point of the chunk (not just its centre).
    const dx = Math.max(Math.abs(chunk.x - playerX) - half, 0);
    const dz = Math.max(Math.abs(chunk.z - playerZ) - half, 0);
    const dist = Math.hypot(dx, dz);
    let score = dist;
    if (dist > 0.001 && moveBonus > 0) {
      const toChunkX = (chunk.x - playerX) / (dist + half);
      const toChunkZ = (chunk.z - playerZ) / (dist + half);
      const facing = toChunkX * velX + toChunkZ * velZ;
      score -= facing * 14 * moveBonus;
    }
    if (dist > 0.001) {
      const toChunkX = (chunk.x - playerX) / (dist + half);
      const toChunkZ = (chunk.z - playerZ) / (dist + half);
      const camFacing = toChunkX * camX + toChunkZ * camZ;
      score -= camFacing * 8;
    }
    // The chunk the player stands in is always top priority.
    if (dx === 0 && dz === 0) score = -1000;
    out.push({ key: chunk.key, score });
  }
  out.sort((a, b) => a.score - b.score);
  return out;
}

/** Simple bounded work queue with dedupe and cancellation by recomputation. */
export class LoadQueue {
  private queue: string[] = [];
  private queued = new Set<string>();

  get size(): number {
    return this.queue.length;
  }

  has(key: string): boolean {
    return this.queued.has(key);
  }

  /** Replace the queue with a new prioritised order (keys not listed are dropped). */
  refill(keys: readonly string[]): void {
    this.queue.length = 0;
    this.queued.clear();
    for (const key of keys) {
      if (this.queued.has(key)) continue;
      this.queue.push(key);
      this.queued.add(key);
    }
  }

  /** Drop queued work that is no longer needed. */
  cancelExcept(needed: ReadonlySet<string>): void {
    this.queue = this.queue.filter((k) => needed.has(k));
    this.queued = new Set(this.queue);
  }

  dequeue(): string | undefined {
    const key = this.queue.shift();
    if (key !== undefined) this.queued.delete(key);
    return key;
  }

  clear(): void {
    this.queue.length = 0;
    this.queued.clear();
  }
}
