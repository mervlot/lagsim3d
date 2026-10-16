/**
 * Keyboard + mouse controls for desktop.
 * WASD/arrows move, Shift runs, mouse drag rotates the camera, Escape pauses,
 * wheel zooms. No pointer lock required.
 */
import type { InputManager } from './InputManager';

interface ArrowCamera {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

const KEY_MAP_MOVE: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const KEY_MAP_CAMERA: Record<string, keyof ArrowCamera> = {
  KeyJ: 'left',
  KeyL: 'right',
  KeyI: 'up',
  KeyK: 'down',
};

export function attachKeyboardControls(
  target: Window,
  input: InputManager,
  arrowCamera: ArrowCamera,
  onPause: () => void,
  cameraSensitivityProvider: () => number,
): { dispose(): void } {
  const pressed = new Map<string, [number, number]>();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pointerId: number | null = null;

  const applyMove = (): void => {
    let x = 0;
    let z = 0;
    for (const [dx, dz] of pressed.values()) {
      x += dx;
      z += dz;
    }
    // Keyboard is digital; normalise so diagonals are not faster.
    const mag = Math.hypot(x, z);
    if (mag > 1) {
      x /= mag;
      z /= mag;
    }
    input.setMove(x, z, false);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      onPause();
      return;
    }
    const move = KEY_MAP_MOVE[e.code];
    if (move) {
      e.preventDefault();
      if (!pressed.has(e.code)) {
        pressed.set(e.code, move);
        applyMove();
      }
      return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      input.setRun(true);
      return;
    }
    const cam = KEY_MAP_CAMERA[e.code];
    if (cam) {
      e.preventDefault();
      arrowCamera[cam] = true;
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    const move = KEY_MAP_MOVE[e.code];
    if (move) {
      pressed.delete(e.code);
      applyMove();
      return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      input.setRun(false);
      return;
    }
    const cam = KEY_MAP_CAMERA[e.code];
    if (cam) arrowCamera[cam] = false;
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = e.target as HTMLElement | null;
    if (el && el.closest('[data-ui]')) return;
    dragging = true;
    pointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const sens = cameraSensitivityProvider();
    input.addCameraDelta(-dx * 0.0032 * sens, -dy * 0.0026 * sens, 0);
  };

  const endDrag = (e: PointerEvent): void => {
    if (e.pointerId === pointerId) {
      dragging = false;
      pointerId = null;
    }
  };

  const onWheel = (e: WheelEvent): void => {
    const el = e.target as HTMLElement | null;
    if (el && el.closest('[data-ui]')) return;
    e.preventDefault();
    input.addCameraDelta(0, 0, Math.sign(e.deltaY) * 0.7);
  };

  const onBlur = (): void => {
    pressed.clear();
    input.setMove(0, 0, false);
    input.setRun(false);
    arrowCamera.left = arrowCamera.right = arrowCamera.up = arrowCamera.down = false;
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', endDrag);
  target.addEventListener('pointercancel', endDrag);
  target.addEventListener('wheel', onWheel, { passive: false });

  return {
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', endDrag);
      target.removeEventListener('pointercancel', endDrag);
      target.removeEventListener('wheel', onWheel);
    },
  };
}
