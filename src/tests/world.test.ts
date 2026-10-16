import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldManager } from '../world/WorldManager';
import { QUALITY_PROFILES, PLAYER } from '../game/GameConfig';
import { PlayerController } from '../player/PlayerController';
import { PlayerCollision } from '../player/PlayerCollision';
import { CameraRig } from '../rendering/Camera';
import { ChunkState } from '../world/ChunkManager';

function makeWorld(): WorldManager {
  const scene = new THREE.Scene();
  const world = new WorldManager(scene, QUALITY_PROFILES.medium);
  world.loadBlocking();
  return world;
}

test('world builds with exactly 10 houses and a collision world', () => {
  const world = makeWorld();
  assert.equal(world.getHouseCount(), 10);
  assert.ok(world.collision.count > 40, `colliders=${world.collision.count}`);
  const chunks = world.getChunkManager();
  let built = 0;
  let visible = 0;
  for (const chunk of chunks.all()) {
    if (chunk.state === ChunkState.Ready || chunk.state === ChunkState.Active) built++;
    if (chunk.group && chunk.group.visible) visible++;
  }
  assert.ok(built >= 10, `built chunks=${built}`);
  // Regression: chunks near spawn must actually be visible (not just built).
  assert.ok(visible >= 1, 'at least one chunk must be visible at spawn');
  world.dispose();
});

test('player cannot walk through a house body', () => {
  const world = makeWorld();
  const collision = new PlayerCollision(world.collision);
  const camera = new CameraRig(1);
  camera.setCollision(world.collision);
  const player = new PlayerController(collision, camera);

  // Spawn just outside house 1's compound wall on the street, walk into it.
  const houseX = -12.5;
  const houseZ = -14;
  player.spawnAt(houseX, houseZ, Math.PI / 2);
  const startX = player.position.x;

  const input = { moveX: 0, moveZ: 1, run: true, joystickActive: true };
  // Rotate camera so "forward" heads toward -X (into the compound).
  camera.snapBehind(player.position, -Math.PI / 2);
  for (let i = 0; i < 120; i++) {
    player.update(1 / 60, input);
  }
  assert.ok(player.position.x < startX - 1, 'should move toward the wall');
  assert.ok(player.position.x > -17.2, `should be stopped by the wall, x=${player.position.x}`);
  world.dispose();
});

test('player movement: diagonal is not faster than straight running', () => {
  const world = makeWorld();
  const collision = new PlayerCollision(world.collision);
  const camera = new CameraRig(1);
  camera.setCollision(world.collision);
  const player = new PlayerController(collision, camera);
  camera.snapBehind(new THREE.Vector3(0, 0, 60), 0); // camera looks along +Z

  const straight = { moveX: 0, moveZ: 1, run: false, joystickActive: true };
  const diagonal = { moveX: 0.7071, moveZ: 0.7071, run: false, joystickActive: true };

  // Straight.
  player.spawnAt(0, 60, 0);
  for (let i = 0; i < 90; i++) player.update(1 / 60, straight);
  const straightDist = Math.hypot(player.position.x - 0, player.position.z - 60);
  const straightSpeed = player.getSpeed();

  // Diagonal (from a clear stretch of road).
  player.spawnAt(0, 20, 0);
  for (let i = 0; i < 90; i++) player.update(1 / 60, diagonal);
  const diagSpeed = player.getSpeed();

  assert.ok(straightDist > 3, `moved ${straightDist}`);
  assert.ok(diagSpeed <= straightSpeed + 0.15, `diag ${diagSpeed} vs straight ${straightSpeed}`);
  assert.ok(Math.abs(diagSpeed - straightSpeed) < 0.4);
  world.dispose();
});

test('strafe input moves the character toward screen-right at any camera yaw', () => {
  const world = makeWorld();
  const collision = new PlayerCollision(world.collision);
  const camera = new CameraRig(16 / 9);
  camera.setCollision(world.collision);
  const player = new PlayerController(collision, camera);
  const vel = new THREE.Vector2();
  const fwd = new THREE.Vector2();
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
    player.spawnAt(0, 14, yaw);
    camera.snapBehind(player.position, yaw);
    player.update(1 / 60, { moveX: 1, moveZ: 0, run: false, joystickActive: true });
    player.getVelocity(vel);
    camera.getForwardXZ(fwd);
    // Camera-right in world XZ is forward rotated -90° about +Y: (-fz, fx).
    const rightX = -fwd.y;
    const rightZ = fwd.x;
    const dot = vel.x * rightX + vel.y * rightZ;
    assert.ok(dot > 0, `yaw=${yaw}: strafing right should head camera-right (dot=${dot.toFixed(3)})`);
  }
  world.dispose();
});

test('run is faster than walk', () => {
  const world = makeWorld();
  const collision = new PlayerCollision(world.collision);
  const camera = new CameraRig(1);
  camera.setCollision(world.collision);
  const player = new PlayerController(collision, camera);
  camera.snapBehind(new THREE.Vector3(0, 0, 70), 0);

  player.spawnAt(0, 70, 0);
  const walk = { moveX: 0, moveZ: 1, run: false, joystickActive: true };
  for (let i = 0; i < 120; i++) player.update(1 / 60, walk);
  const walkSpeed = player.getSpeed();

  player.spawnAt(0, 70, 0);
  const run = { moveX: 0, moveZ: 1, run: true, joystickActive: true };
  for (let i = 0; i < 120; i++) player.update(1 / 60, run);
  const runSpeed = player.getSpeed();

  assert.ok(walkSpeed > PLAYER.walkSpeed - 0.6);
  assert.ok(runSpeed > walkSpeed + 1.5, `run ${runSpeed} walk ${walkSpeed}`);
  world.dispose();
});

test('player stays inside world bounds', () => {
  const world = makeWorld();
  const collision = new PlayerCollision(world.collision);
  const camera = new CameraRig(1);
  camera.setCollision(world.collision);
  const player = new PlayerController(collision, camera);
  player.spawnAt(0, 90, Math.PI);
  camera.snapBehind(player.position, Math.PI);
  const input = { moveX: 0, moveZ: 1, run: true, joystickActive: true };
  for (let i = 0; i < 600; i++) player.update(1 / 60, input);
  assert.ok(Math.abs(player.position.z) <= 96.001);
  world.dispose();
});

test('streaming: chunks unload far away but collision remains', () => {
  const world = makeWorld();
  const chunks = world.getChunkManager();
  const before = world.collision.count;
  // Teleport far away and run the streamer long enough to unload.
  for (let i = 0; i < 40; i++) {
    world.update(0.3, 0, 95, 0, 1, 4, 0, 1, QUALITY_PROFILES.medium);
  }
  const after = world.collision.count;
  assert.equal(after, before, 'collision must never shrink');
  // Return near the centre: chunks should rebuild.
  for (let i = 0; i < 40; i++) {
    world.update(0.3, 0, 14, 0, 0, 0, 0, 1, QUALITY_PROFILES.high);
  }
  let rebuilt = 0;
  for (const chunk of chunks.all()) {
    if (chunk.state === ChunkState.Active || chunk.state === ChunkState.Ready) rebuilt++;
  }
  assert.ok(rebuilt > 0, 'chunks near the player should be active again');
  world.dispose();
});

test('streaming: repeated updates never duplicate chunk builds', () => {
  const world = makeWorld();
  const chunks = world.getChunkManager();
  const builtAfterLoad = chunks.metrics.built;
  for (let i = 0; i < 30; i++) {
    world.update(0.1, 0, 14, 0, 0, 0, 0, 1, QUALITY_PROFILES.medium);
  }
  assert.equal(chunks.metrics.built, builtAfterLoad);
  assert.ok(chunks.metrics.duplicateBuildsPrevented >= 0);
  world.dispose();
});
