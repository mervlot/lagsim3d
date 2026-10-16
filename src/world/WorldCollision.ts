/**
 * Static 2D (XZ) collision world: axis-aligned boxes in a uniform grid.
 * The player circle is resolved against them; camera rays are clamped against them.
 * Pure logic — no three.js dependency so it stays unit-testable in node.
 */

export interface AABB {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface CircleResult {
  x: number;
  z: number;
  hit: boolean;
}

const CELL = 8;

export class WorldCollision {
  private boxes: AABB[] = [];
  private grid = new Map<string, number[]>();
  private built = false;

  get count(): number {
    return this.boxes.length;
  }

  clear(): void {
    this.boxes = [];
    this.grid.clear();
    this.built = false;
  }

  addBox(minX: number, minZ: number, maxX: number, maxZ: number): AABB {
    const box: AABB = { minX, minZ, maxX, maxZ };
    this.boxes.push(box);
    this.built = false;
    return box;
  }

  addBoxCentered(cx: number, cz: number, halfW: number, halfD: number): AABB {
    return this.addBox(cx - halfW, cz - halfD, cx + halfW, cz + halfD);
  }

  /** (Re)build the spatial hash. Call once after adding boxes. */
  build(): void {
    this.grid.clear();
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      const x0 = Math.floor(b.minX / CELL);
      const x1 = Math.floor(b.maxX / CELL);
      const z0 = Math.floor(b.minZ / CELL);
      const z1 = Math.floor(b.maxZ / CELL);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const key = cx + ',' + cz;
          let list = this.grid.get(key);
          if (!list) {
            list = [];
            this.grid.set(key, list);
          }
          list.push(i);
        }
      }
    }
    this.built = true;
  }

  private queryBox(minX: number, minZ: number, maxX: number, maxZ: number, out: AABB[]): AABB[] {
    out.length = 0;
    if (!this.built) this.build();
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.grid.get(cx + ',' + cz);
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const b = this.boxes[list[k]];
          if (out.indexOf(b) === -1) out.push(b);
        }
      }
    }
    return out;
  }

  private readonly scratch: AABB[] = [];

  /** True if a circle overlaps any solid box. */
  overlapsCircle(x: number, z: number, radius: number): boolean {
    this.queryBox(x - radius, z - radius, x + radius, z + radius, this.scratch);
    const r2 = radius * radius;
    for (let i = 0; i < this.scratch.length; i++) {
      const b = this.scratch[i];
      const nx = Math.max(b.minX, Math.min(x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  }

  /**
   * Push a circle out of every overlapping box (iterative depenetration).
   * Returns the corrected position.
   */
  resolveCircle(x: number, z: number, radius: number, result: CircleResult): CircleResult {
    let px = x;
    let pz = z;
    let hit = false;
    for (let iter = 0; iter < 4; iter++) {
      this.queryBox(px - radius - 0.01, pz - radius - 0.01, px + radius + 0.01, pz + radius + 0.01, this.scratch);
      let moved = false;
      for (let i = 0; i < this.scratch.length; i++) {
        const b = this.scratch[i];
        const nx = Math.max(b.minX, Math.min(px, b.maxX));
        const nz = Math.max(b.minZ, Math.min(pz, b.maxZ));
        let dx = px - nx;
        let dz = pz - nz;
        const distSq = dx * dx + dz * dz;
        if (distSq >= radius * radius) continue;
        hit = true;
        let dist = Math.sqrt(distSq);
        if (dist < 1e-6) {
          // Centre inside the box: push out along the shallowest axis.
          const pushLeft = px - b.minX + radius;
          const pushRight = b.maxX - px + radius;
          const pushUp = pz - b.minZ + radius;
          const pushDown = b.maxZ - pz + radius;
          const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
          if (min === pushLeft) px = b.minX - radius;
          else if (min === pushRight) px = b.maxX + radius;
          else if (min === pushUp) pz = b.minZ - radius;
          else pz = b.maxZ + radius;
        } else {
          const overlap = radius - dist;
          dx /= dist;
          dz /= dist;
          px += dx * overlap;
          pz += dz * overlap;
        }
        moved = true;
      }
      if (!moved) break;
    }
    result.x = px;
    result.z = pz;
    result.hit = hit;
    return result;
  }

  /**
   * Shortest distance from (ox,oz) along (dx,dz) (normalised) until the ray
   * hits a solid box. Used to keep the third-person camera out of walls.
   * Returns maxDist when nothing is hit.
   */
  raycast(ox: number, oz: number, dx: number, dz: number, maxDist: number): number {
    if (!this.built) this.build();
    let best = maxDist;
    const endX = ox + dx * maxDist;
    const endZ = oz + dz * maxDist;
    this.queryBox(Math.min(ox, endX), Math.min(oz, endZ), Math.max(ox, endX), Math.max(oz, endZ), this.scratch);
    for (let i = 0; i < this.scratch.length; i++) {
      const b = this.scratch[i];
      const t = rayAABB2D(ox, oz, dx, dz, b);
      if (t >= 0 && t < best) best = t;
    }
    // Pull the camera slightly in front of an actual hit; leave a clear miss untouched.
    return best >= maxDist ? maxDist : Math.max(0, best - 0.25);
  }

  /** All boxes (read-only use; do not mutate). */
  getAll(): readonly AABB[] {
    return this.boxes;
  }
}

/** Slab intersection in 2D; returns entry distance or -1. */
export function rayAABB2D(ox: number, oz: number, dx: number, dz: number, box: AABB): number {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < box.minX || ox > box.maxX) return -1;
  } else {
    const inv = 1 / dx;
    let t1 = (box.minX - ox) * inv;
    let t2 = (box.maxX - ox) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < box.minZ || oz > box.maxZ) return -1;
  } else {
    const inv = 1 / dz;
    let t1 = (box.minZ - oz) * inv;
    let t2 = (box.maxZ - oz) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}
