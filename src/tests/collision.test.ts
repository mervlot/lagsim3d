import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldCollision, rayAABB2D } from '../world/WorldCollision';

test('circle is pushed out of a wall', () => {
  const c = new WorldCollision();
  c.addBoxCentered(0, 0, 2, 0.25); // wall along X at z=0
  c.build();
  const result = c.resolveCircle(0, 0.4, 0.34, { x: 0, z: 0, hit: false });
  assert.ok(result.hit);
  assert.ok(result.z >= 0.25 + 0.34 - 1e-6, `expected z >= 0.59, got ${result.z}`);
});

test('circle inside a wall depenetrates along the shallow axis', () => {
  const c = new WorldCollision();
  c.addBoxCentered(0, 0, 2, 2);
  c.build();
  const result = c.resolveCircle(1.7, 0, 0.34, { x: 0, z: 0, hit: false });
  assert.ok(result.hit);
  assert.ok(result.x > 2 - 1e-6 || Math.abs(result.z) > 2 - 1e-6);
});

test('free space is untouched', () => {
  const c = new WorldCollision();
  c.addBoxCentered(50, 50, 1, 1);
  c.build();
  const result = c.resolveCircle(0, 0, 0.34, { x: 0, z: 0, hit: false });
  assert.equal(result.hit, false);
  assert.equal(result.x, 0);
  assert.equal(result.z, 0);
});

test('overlapping boxes resolve in corner cases', () => {
  const c = new WorldCollision();
  // Two walls forming an L corner.
  c.addBox(0, 0, 10, 0.3);
  c.addBox(0, 0, 0.3, 10);
  c.build();
  const result = c.resolveCircle(0.5, 0.5, 0.34, { x: 0, z: 0, hit: false });
  assert.ok(result.hit);
  assert.equal(c.overlapsCircle(result.x, result.z, 0.34), false);
});

test('raycast reports the nearest wall', () => {
  const c = new WorldCollision();
  c.addBox(-1, 5, 1, 5.4); // thin wall ahead along +Z
  c.build();
  const dist = c.raycast(0, 0, 0, 1, 20);
  assert.ok(dist > 4.5 && dist < 5.1, `dist=${dist}`);
  const miss = c.raycast(5, 0, 0, 1, 20);
  assert.equal(miss, 20);
});

test('rayAABB2D handles axis-aligned rays', () => {
  const box = { minX: -1, maxX: 1, minZ: 3, maxZ: 4 };
  assert.equal(rayAABB2D(0, 0, 0, 1, box), 3);
  assert.equal(rayAABB2D(0, 0, 1, 0, box), -1);
  // Travelling in -X at the box's z: enters at x = 1 (t = 4).
  assert.equal(rayAABB2D(5, 3.5, -1, 0, box), 4);
  // A near-axis ray that never reaches the box in z must miss.
  assert.equal(rayAABB2D(5, 0, -1, 0.0001, box), -1);
});

test('many boxes stay performant in the grid', () => {
  const c = new WorldCollision();
  for (let i = 0; i < 500; i++) {
    c.addBoxCentered((i % 25) * 8 - 100, Math.floor(i / 25) * 8 - 80, 1.5, 1.5);
  }
  const t0 = performance.now();
  c.build();
  for (let i = 0; i < 200; i++) {
    c.resolveCircle(Math.sin(i) * 50, Math.cos(i) * 50, 0.34, { x: 0, z: 0, hit: false });
  }
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 500, `took ${elapsed}ms`);
});
