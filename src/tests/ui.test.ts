import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDomShim, makeRoot, FakeElement } from './dom-shim';

// The shim must exist before UI modules are constructed, but after import.
const shim = installDomShim();

import { MainMenu } from '../ui/MainMenu';
import { PauseMenu } from '../ui/PauseMenu';
import { MobileHUD } from '../ui/MobileHUD';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { OrientationOverlay } from '../ui/OrientationOverlay';
import { DebugHUD } from '../ui/DebugHUD';
import { DEFAULT_SETTINGS } from '../game/GameConfig';

const asEl = (node: unknown): FakeElement => node as FakeElement;
const asHost = (node: unknown): HTMLElement => node as unknown as HTMLElement;

test('MainMenu builds, wires start and settings', () => {
  const root = makeRoot();
  let started = 0;
  let lastQuality = '';
  const menu = new MainMenu(asHost(root), { ...DEFAULT_SETTINGS, quality: 'low' }, {
    onStart: () => started++,
    onSettingsChange: (s) => {
      lastQuality = s.quality;
    },
  });
  assert.ok(root.children.length >= 1);

  // Start button click.
  const card = asEl(root.querySelector('.menu-card'));
  const startBtn = asEl(card.children.find((c) => c.tagName === 'button'));
  assert.ok(startBtn, 'start button exists');
  startBtn.dispatch('click');
  assert.equal(started, 1);

  // Quality select change.
  const select = asEl(root.querySelector('.select'));
  select.value = 'high';
  select.dispatch('change');
  assert.equal(lastQuality, 'high');

  menu.setStartLabel('Resume');
  assert.equal(startBtn.textContent, 'Resume');
  menu.hide();
  assert.equal(asEl(menu.root).classList.contains('hidden'), true);
  menu.show();
  assert.equal(asEl(menu.root).classList.contains('hidden'), false);
});

test('PauseMenu action callbacks and settings', () => {
  const root = makeRoot();
  const calls: string[] = [];
  const menu = new PauseMenu(asHost(root), DEFAULT_SETTINGS, {
    onResume: () => calls.push('resume'),
    onRespawn: () => calls.push('respawn'),
    onQuit: () => calls.push('quit'),
    onSettingsChange: () => calls.push('settings'),
  });
  const card = asEl(root.querySelector('.menu-card'));
  const buttons = card.children.filter((c) => c.tagName === 'button').map(asEl);
  buttons[0].dispatch('click');
  buttons[1].dispatch('click');
  buttons[2].dispatch('click');
  assert.deepEqual(calls, ['resume', 'respawn', 'quit']);

  const select = asEl(root.querySelector('.select'));
  select.value = 'low';
  select.dispatch('change');
  assert.ok(calls.includes('settings'));
  menu.show();
  assert.equal(asEl(menu.root).classList.contains('hidden'), false);
});

test('MobileHUD positions by handedness and exposes zones', () => {
  const root = makeRoot();
  let paused = 0;
  const hud = new MobileHUD(asHost(root), DEFAULT_SETTINGS, () => paused++);
  assert.ok(hud.joystickZone);
  assert.ok(hud.runButton);
  assert.equal(asEl(hud.root).classList.contains('hud-left-hand'), true);
  hud.setHandedness('right');
  assert.equal(asEl(hud.root).classList.contains('hud-right-hand'), true);
  assert.equal(asEl(hud.root).classList.contains('hud-left-hand'), false);
  asEl(hud.pauseButton).dispatch('click');
  assert.equal(paused, 1);
  hud.show();
  assert.equal(asEl(hud.root).classList.contains('hidden'), false);
});

test('LoadingOverlay progress and visibility', () => {
  const root = makeRoot();
  const overlay = new LoadingOverlay(asHost(root));
  overlay.show('Building');
  assert.equal(asEl(overlay.root).classList.contains('hidden'), false);
  overlay.setProgress(0.5, 'half');
  const track = asEl(root.querySelector('.loading-track'));
  const bar = asEl(track.children[0]);
  assert.equal(bar.style.width, '50.0%');
  overlay.hide();
  assert.equal(asEl(overlay.root).classList.contains('hidden'), true);
});

test('OrientationOverlay suspends in portrait and resumes in landscape', () => {
  const root = makeRoot();
  const states: boolean[] = [];
  const overlay = new OrientationOverlay(asHost(root), (s) => states.push(s), () => {});
  // Force portrait via the mocked window.
  (shim.window as { innerWidth: number; innerHeight: number }).innerWidth = 400;
  (shim.window as { innerWidth: number; innerHeight: number }).innerHeight = 800;
  shim.window.dispatch('resize');
  assert.equal(overlay.isPortrait(), true);
  assert.deepEqual(states, [true]);
  assert.equal(asEl(overlay.root).classList.contains('hidden'), false);

  // Back to landscape.
  (shim.window as { innerWidth: number; innerHeight: number }).innerWidth = 900;
  (shim.window as { innerWidth: number; innerHeight: number }).innerHeight = 400;
  shim.window.dispatch('resize');
  assert.equal(overlay.isPortrait(), false);
  assert.deepEqual(states, [true, false]);
  assert.equal(asEl(overlay.root).classList.contains('hidden'), true);
});

test('DebugHUD toggles with the backquote key', () => {
  const root = makeRoot();
  const hud = new DebugHUD(asHost(root));
  assert.equal(asEl(hud.root).classList.contains('hidden'), true);
  // window keydown listener registered by DebugHUD.
  shim.window.dispatch('keydown', { code: 'Backquote' });
  assert.equal(asEl(hud.root).classList.contains('hidden'), false);
  shim.window.dispatch('keydown', { code: 'Backquote' });
  assert.equal(asEl(hud.root).classList.contains('hidden'), true);
  hud.dispose();
});
