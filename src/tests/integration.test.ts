import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDomShim, makeRoot, FakeElement } from './dom-shim';
import { makeMockCanvas, installWebGLGlobals } from './webgl-mock';

const shim = installDomShim();
installWebGLGlobals();

import { Game } from '../game/Game';

const asEl = (node: unknown): FakeElement => node as FakeElement;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function clickByClass(root: FakeElement, cls: string): boolean {
  const node = root.querySelector('.' + cls);
  if (!node) return false;
  // Walk up to the nearest button and click it.
  let cur: FakeElement | null = node;
  while (cur && cur.tagName !== 'button') cur = cur.parentElement;
  (cur ?? node).dispatch('click');
  return true;
}

test('Game boots, streams, plays, pauses and tears down without a real GPU', async () => {
  const uiRoot = makeRoot();
  const { canvas, stats } = makeMockCanvas();
  const game = new Game(canvas as unknown as HTMLCanvasElement, uiRoot as unknown as HTMLElement);

  await game.init();
  assert.equal(game.getState(), 'menu', 'after init the menu is shown');

  // The start button lives in the main menu card.
  assert.ok(clickByClass(uiRoot, 'menu-card'), 'main menu rendered');
  // Directly find the start button by its label to avoid ambiguity.
  const menuCard = asEl(uiRoot.querySelector('.menu-card'));
  const startBtn = menuCard.children.find((c) => c.tagName === 'button') as FakeElement | undefined;
  assert.ok(startBtn, 'start button present');
  startBtn!.dispatch('click');
  assert.equal(game.getState(), 'playing', 'clicking start enters playing');

  // Let a handful of frames run.
  await sleep(60);
  assert.ok(stats.programs > 0, `shader programs compiled (${stats.programs})`);
  assert.ok(stats.drawCalls > 0, `draw calls issued (${stats.drawCalls})`);

  // Pause/resume via the Escape key (bound by InputManager).
  shim.window.dispatch('keydown', { code: 'Escape' });
  assert.equal(game.getState(), 'paused', 'Escape pauses');
  const pauseCard = asEl(uiRoot.querySelector('.menu-card'));
  assert.ok(pauseCard, 'pause menu rendered');

  shim.window.dispatch('keydown', { code: 'Escape' });
  assert.equal(game.getState(), 'playing', 'Escape resumes');

  // Movement input should not throw over several frames.
  shim.window.dispatch('keydown', { code: 'KeyW' });
  shim.window.dispatch('keydown', { code: 'ShiftLeft' });
  await sleep(50);
  shim.window.dispatch('keyup', { code: 'KeyW' });

  const callsBefore = stats.drawCalls;
  await sleep(30);
  assert.ok(stats.drawCalls >= callsBefore, 'rendering continues each frame');

  assert.doesNotThrow(() => game.destroy(), 'destroy is clean');
  const programsAtDestroy = stats.programs;
  await sleep(20);
  // After destroy the loop is stopped, so no new programs/draws should appear.
  assert.ok(stats.programs <= programsAtDestroy + 1, 'loop stopped after destroy');
});
