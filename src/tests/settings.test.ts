import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampSettings, DEFAULT_SETTINGS, QUALITY_PROFILES } from '../game/GameConfig';
import { joystickVector } from '../input/VirtualJoystick';
import { SaveManager } from '../storage/SaveManager';
import { QualityManager } from '../rendering/QualityManager';

test('clampSettings validates garbage input', () => {
  assert.deepEqual(clampSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(clampSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(clampSettings('nope'), DEFAULT_SETTINGS);
  assert.deepEqual(clampSettings(42), DEFAULT_SETTINGS);
  const s = clampSettings({ quality: 'ultra', cameraSensitivity: 99, invertCameraY: 'yes', handedness: 'middle' });
  assert.equal(s.quality, 'medium');
  assert.equal(s.cameraSensitivity, 2.5);
  assert.equal(s.invertCameraY, false);
  assert.equal(s.handedness, 'left');
  const ok = clampSettings({ quality: 'low', cameraSensitivity: 1.5, invertCameraY: true, handedness: 'right', runToggle: true });
  assert.equal(ok.quality, 'low');
  assert.equal(ok.invertCameraY, true);
  assert.equal(ok.handedness, 'right');
  assert.equal(ok.runToggle, true);
});

test('joystick deadzone and normalisation', () => {
  const out = { x: 0, y: 0, active: false };
  joystickVector(0.05, 0.02, 0.14, out);
  assert.equal(out.x, 0);
  assert.equal(out.y, 0);
  assert.equal(out.active, true);

  joystickVector(0, 0, 0.14, out);
  assert.equal(out.active, false);

  joystickVector(1, 0, 0.14, out);
  assert.ok(Math.abs(out.x - 1) < 1e-9);
  assert.equal(out.y, 0);

  // Diagonal stick corner is clamped to length ≤ 1.
  joystickVector(0.9, 0.9, 0.14, out);
  const mag = Math.hypot(out.x, out.y);
  assert.ok(mag <= 1.0001, `mag=${mag}`);
  assert.ok(mag > 0.85);

  // Outside the unit circle (impossible from the joystick, but guarded).
  joystickVector(2, 0, 0.14, out);
  assert.ok(Math.abs(out.x) <= 1.0001);
});

test('SaveManager falls back gracefully without a browser', async () => {
  const save = new SaveManager();
  await save.whenReady();
  const backend = save.getBackend();
  assert.ok(backend === 'idb' || backend === 'local' || backend === 'memory');
  await save.saveSettings({ ...DEFAULT_SETTINGS, quality: 'low' });
  const loaded = await save.loadSettings();
  assert.equal(loaded.quality, 'low');

  // Invalid stored position must be rejected.
  await save.set('position', { x: 'NaN', z: null });
  const bad = await save.loadLastPosition({ x: 0, z: 14, yaw: Math.PI });
  assert.equal(bad, null);

  // Absurd coordinates rejected.
  await save.set('position', { x: 5000, z: -9000, yaw: 0 });
  const far = await save.loadLastPosition({ x: 0, z: 14, yaw: Math.PI });
  assert.equal(far, null);

  // Valid coordinates accepted.
  await save.set('position', { x: 3.2, z: -8.5, yaw: 1.1 });
  const good = await save.loadLastPosition({ x: 0, z: 14, yaw: Math.PI });
  assert.ok(good);
  assert.equal(good?.x, 3.2);
  assert.equal(good?.z, -8.5);
  assert.equal(good?.yaw, 1.1);
});

test('quality manager steps down under sustained load and respects cooldown', () => {
  const qm = new QualityManager('high');
  let changes = 0;
  qm.onChange(() => changes++);
  for (let i = 0; i < 60; i++) qm.sample(50, 0.5); // 20 fps for 30 seconds
  assert.ok(changes >= 1, 'should have adapted');
  assert.ok(qm.getAdaptiveScale() < 1);
  const scaleAfterDown = qm.getAdaptiveScale();
  // Cooldown should prevent instant bounce.
  qm.sample(10, 0.1);
  assert.equal(qm.getAdaptiveScale(), scaleAfterDown);

  // Manual level change works and resets scale.
  qm.setLevel('low');
  assert.equal(qm.getProfile().name, 'low');
  assert.equal(qm.getAdaptiveScale(), 1);
  assert.equal(QUALITY_PROFILES.low.shadows, false);
  assert.ok(QUALITY_PROFILES.high.buildingDistance > QUALITY_PROFILES.low.buildingDistance);
});
