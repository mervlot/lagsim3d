/**
 * Touch controls for phones/tablets: virtual joystick, run button, and
 * drag-to-rotate camera (with two-finger pinch zoom). Each active pointer has
 * exactly one role, so the joystick and camera can be used simultaneously.
 */
import type { InputManager } from './InputManager';
import { VirtualJoystick } from './VirtualJoystick';

export interface TouchHudElements {
  joystickZone: HTMLElement;
  runButton: HTMLElement;
  sensitivityProvider: () => number;
  runToggleProvider?: () => boolean;
}

interface CameraPointer {
  x: number;
  y: number;
}

export function attachTouchControls(
  surface: HTMLElement,
  input: InputManager,
  hud: TouchHudElements,
): { dispose(): void; setState(enabled: boolean): void } {
  // Build the joystick DOM inside the provided zone.
  const base = hud.joystickZone;
  base.classList.add('joystick-base');
  const knob = document.createElement('div');
  knob.className = 'joystick-knob';
  base.appendChild(knob);

  const joystick = new VirtualJoystick(base, knob, {
    deadzone: 0.14,
    onChange(x, yForward, active) {
      // Touch stick y is already "screen up = forward"; input space expects +Z forward.
      input.setMove(x, yForward, active);
    },
  });

  let runToggled = false;
  const setRun = (value: boolean): void => {
    input.setRun(value);
    hud.runButton.classList.toggle('is-active', value);
  };

  const onRunDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    try {
      hud.runButton.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
    if (hud.runToggleProvider?.()) {
      runToggled = !runToggled;
      setRun(runToggled);
    } else {
      setRun(true);
    }
  };
  const onRunUp = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!hud.runToggleProvider?.()) setRun(false);
  };
  hud.runButton.addEventListener('pointerdown', onRunDown);
  hud.runButton.addEventListener('pointerup', onRunUp);
  hud.runButton.addEventListener('pointercancel', onRunUp);

  // Camera drag pointers (touches only — mouse is handled by KeyboardControls).
  const camPointers = new Map<number, CameraPointer>();
  let pinchStart = 0;

  const isUi = (e: PointerEvent): boolean => {
    const el = e.target as HTMLElement | null;
    return !!el && !!el.closest('[data-ui]');
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    if (isUi(e)) return;
    camPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
    if (camPointers.size === 2) {
      const pts = [...camPointers.values()];
      pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    const prev = camPointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;
    const sens = hud.sensitivityProvider();
    if (camPointers.size === 1) {
      input.addCameraDelta(-dx * 0.0032 * sens, -dy * 0.0026 * sens, 0);
    } else if (camPointers.size === 2 && pinchStart > 0) {
      const pts = [...camPointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const delta = (dist - pinchStart) * 0.012;
      input.addCameraDelta(0, 0, -delta);
      pinchStart = dist;
    }
  };

  const onPointerEnd = (e: PointerEvent): void => {
    if (!camPointers.has(e.pointerId)) return;
    camPointers.delete(e.pointerId);
    if (camPointers.size < 2) pinchStart = 0;
    if (camPointers.size === 0) {
      try {
        surface.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
  };

  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', onPointerEnd);
  surface.addEventListener('pointercancel', onPointerEnd);

  // Prevent page scroll / browser gestures while touching the game surface.
  const prevent = (e: Event): void => {
    if (!isUi(e as PointerEvent)) e.preventDefault();
  };
  surface.addEventListener('touchmove', prevent, { passive: false });
  const preventContext = (e: Event): void => e.preventDefault();
  surface.addEventListener('contextmenu', preventContext);

  return {
    setState(enabled: boolean) {
      base.style.display = enabled ? '' : 'none';
      hud.runButton.style.display = enabled ? '' : 'none';
      if (!enabled) {
        joystick.reset();
        camPointers.clear();
        runToggled = false;
        setRun(false);
      }
    },
    dispose() {
      hud.runButton.removeEventListener('pointerdown', onRunDown);
      hud.runButton.removeEventListener('pointerup', onRunUp);
      hud.runButton.removeEventListener('pointercancel', onRunUp);
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', onPointerEnd);
      surface.removeEventListener('pointercancel', onPointerEnd);
      surface.removeEventListener('touchmove', prevent);
      surface.removeEventListener('contextmenu', preventContext);
      joystick.dispose();
      knob.remove();
    },
  };
}
