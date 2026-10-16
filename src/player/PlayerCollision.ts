/** Keeps the player circle out of static world geometry and inside world bounds. */
import { WORLD } from '../game/GameConfig';
import type { WorldCollision, CircleResult } from '../world/WorldCollision';

export class PlayerCollision {
  private result: CircleResult = { x: 0, z: 0, hit: false };

  constructor(private collision: WorldCollision) {}

  /** Resolve a desired position against the world; returns the safe position. */
  resolve(x: number, z: number, radius: number): { x: number; z: number; hit: boolean } {
    const r = this.collision.resolveCircle(x, z, radius, this.result);
    // Clamp to world bounds.
    const b = WORLD.bounds;
    let clamped = false;
    if (r.x < -b) { r.x = -b; clamped = true; }
    if (r.x > b) { r.x = b; clamped = true; }
    if (r.z < -b) { r.z = -b; clamped = true; }
    if (r.z > b) { r.z = b; clamped = true; }
    r.hit = r.hit || clamped;
    return { x: r.x, z: r.z, hit: r.hit };
  }
}
