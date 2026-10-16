import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeChunks, LoadQueue, type ChunkInfo } from '../performance/PredictiveLoader';

const chunks: ChunkInfo[] = [];
for (let cx = -2; cx <= 2; cx++) {
  for (let cz = -2; cz <= 2; cz++) {
    chunks.push({ key: cx + ':' + cz, cx, cz, x: (cx + 0.5) * 40, z: (cz + 0.5) * 40 });
  }
}

test('current chunk is highest priority', () => {
  const ranked = prioritizeChunks(chunks, {
    playerX: 20, playerZ: 20, velX: 0, velZ: 0, speed: 0, camX: 0, camZ: 1, chunkSize: 40,
  });
  assert.equal(ranked[0].key, '0:0');
});

test('movement direction biases the queue forward', () => {
  const ranked = prioritizeChunks(chunks, {
    playerX: 20, playerZ: 60, velX: 0, velZ: 1, speed: 6, camX: 0, camZ: 1, chunkSize: 40,
  });
  const aheadIndex = ranked.findIndex((r) => r.key === '0:1');
  const behindIndex = ranked.findIndex((r) => r.key === '0:0');
  assert.ok(aheadIndex >= 0 && behindIndex >= 0);
  // Chunk ahead of the player ranks above the one behind (both distance-1 chunks).
  const aheadScore = ranked[aheadIndex].score;
  const behindScore = ranked[behindIndex].score;
  assert.ok(aheadScore < behindScore, `ahead ${aheadScore} vs behind ${behindScore}`);
});

test('camera direction biases the queue too', () => {
  const facingEast = prioritizeChunks(chunks, {
    playerX: 20, playerZ: 20, velX: 0, velZ: 0, speed: 0, camX: 1, camZ: 0, chunkSize: 40,
  });
  const eastRank = facingEast.findIndex((r) => r.key === '1:0');
  const westRank = facingEast.findIndex((r) => r.key === '-1:0');
  assert.ok(eastRank < westRank);
});

test('LoadQueue dedupes, reorders and cancels', () => {
  const q = new LoadQueue();
  q.refill(['a', 'b', 'c', 'a']);
  assert.equal(q.size, 3);
  assert.equal(q.dequeue(), 'a');
  q.refill(['c', 'b']);
  assert.equal(q.has('a'), false);
  assert.equal(q.size, 2);
  q.cancelExcept(new Set(['b']));
  assert.equal(q.size, 1);
  assert.equal(q.dequeue(), 'b');
  assert.equal(q.dequeue(), undefined);
});
