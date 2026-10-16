import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_SPECS, buildRoadSegments, buildVegetation, buildStreetProps, chunkIndexOf, SPAWN_POINT } from '../world/WorldLayout';
import { WorldCollision } from '../world/WorldCollision';
import { transformAABB } from '../world/HouseFactory';

test('exactly ten houses are defined, with unique ids', () => {
  assert.equal(HOUSE_SPECS.length, 10);
  const ids = new Set(HOUSE_SPECS.map((h) => h.id));
  assert.equal(ids.size, 10);
});

test('houses are spread out and do not overlap each other', () => {
  for (let i = 0; i < HOUSE_SPECS.length; i++) {
    for (let j = i + 1; j < HOUSE_SPECS.length; j++) {
      const a = HOUSE_SPECS[i];
      const b = HOUSE_SPECS[j];
      const dist = Math.hypot(a.cx - b.cx, a.cz - b.cz);
      const minDist = (Math.hypot(a.plotW, a.plotD) + Math.hypot(b.plotW, b.plotD)) / 2 - 1.5;
      assert.ok(dist > minDist * 0.6, `houses ${a.id} and ${b.id} too close: ${dist.toFixed(1)}m`);
    }
  }
});

test('houses have varied architecture', () => {
  const footprints = new Set(HOUSE_SPECS.map((h) => `${h.bodyW}x${h.bodyD}`));
  assert.ok(footprints.size >= 8, 'expected distinct footprints');
  const roofs = new Set(HOUSE_SPECS.map((h) => h.roof));
  assert.ok(roofs.size >= 2);
  const colors = new Set(HOUSE_SPECS.map((h) => h.wallColor));
  assert.ok(colors.size >= 6);
  assert.ok(HOUSE_SPECS.some((h) => h.storeys === 2));
  assert.ok(HOUSE_SPECS.some((h) => h.storeys === 1));
});

test('houses sit near roads', () => {
  const roads = buildRoadSegments();
  for (const h of HOUSE_SPECS) {
    const dist = Math.min(
      ...roads.map((r) => {
        const dx = Math.max(Math.abs(h.cx - r.cx) - r.halfW, 0);
        const dz = Math.max(Math.abs(h.cz - r.cz) - r.halfD, 0);
        return Math.hypot(dx, dz);
      })
    );
    assert.ok(dist < 22, `house ${h.id} is ${dist.toFixed(1)}m from any road`);
  }
});

test('spawn point is on the main road and clear of collisions', () => {
  const c = new WorldCollision();
  for (const h of HOUSE_SPECS) {
    // Rebuild the plot walls + body colliders the same way the factory does.
    const halfW = h.plotW / 2;
    const halfD = h.plotD / 2;
    const gate = 3.4;
    const local = [
      { minX: -halfW, minZ: -halfD - 0.24, maxX: halfW, maxZ: -halfD },
      { minX: -halfW - 0.24, minZ: -halfD, maxX: -halfW, maxZ: halfD },
      { minX: halfW, minZ: -halfD, maxX: halfW + 0.24, maxZ: halfD },
      { minX: -halfW, minZ: halfD, maxX: -gate / 2, maxZ: halfD + 0.24 },
      { minX: gate / 2, minZ: halfD, maxX: halfW, maxZ: halfD + 0.24 },
      { minX: -h.bodyW / 2, minZ: -h.plotD * 0.08 - h.bodyD / 2, maxX: h.bodyW / 2, maxZ: -h.plotD * 0.08 + h.bodyD / 2 },
    ];
    for (const b of local) {
      const w = transformAABB(b.minX, b.minZ, b.maxX, b.maxZ, h.yaw, h.cx, h.cz);
      c.addBox(w.minX, w.minZ, w.maxX, w.maxZ);
    }
  }
  c.build();
  assert.equal(c.overlapsCircle(SPAWN_POINT.x, SPAWN_POINT.z, 0.34), false);
});

test('roads cover both axes and chunkify cleanly', () => {
  const segments = buildRoadSegments();
  assert.ok(segments.length >= 15);
  const keys = new Set(segments.map((s) => chunkIndexOf(s.cx, s.cz, 40).key));
  assert.ok(keys.size >= 6);
});

test('vegetation and street props are deterministic', () => {
  const a = buildVegetation(HOUSE_SPECS);
  const b = buildVegetation(HOUSE_SPECS);
  assert.deepEqual(a, b);
  assert.ok(a.length > 20);
  const propsA = buildStreetProps(HOUSE_SPECS);
  const propsB = buildStreetProps(HOUSE_SPECS);
  assert.deepEqual(propsA, propsB);
  assert.ok(propsA.poles.length >= 4);
});
