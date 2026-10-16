/**
 * InputManager — single source of truth for gameplay input.
 * Keyboard and touch controls write into the same state object; the
 * PlayerController and CameraRig consume it. The game never branches on device.
 */
import { attachKeyboardControls } from './KeyboardControls';
import { attachTouchControls } from './TouchControls';

export interface InputState {
  /** Strafe: -1 left … +1 right. */
  moveX: number;
  /** Forward/back: +1 forward (away from camera) … -1 back. */
  moveZ: number;
  run: boolean;
  /** Pointer/touch joystick engaged (for HUD feedback). */
  joystickActive: boolean;
}

export interface CameraInput {
  yawDelta: number;
  pitchDelta: number;
  zoomDelta: number;
}

export class InputManager {
  readonly state: InputState = { moveX: 0, moveZ: 0, run: false, joystickActive: false };
  /** Accumulated camera deltas, consumed once per frame. */
  readonly camera: CameraInput = { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
  private keyboardEnabled = false;
  private keyboard: { dispose(): void } | null = null;
  private touch: { dispose(): void; setState(enabled: boolean): void } | null = null;
  /** Desktop arrow-key camera fallback (when no mouse drag). */
  private arrowCamera = { left: false, right: false, up: false, down: false };
  private onPause: () => void;

  constructor(onPause: () => void) {
    this.onPause = onPause;
  }

  attachKeyboard(target: Window, cameraSensitivityProvider: () => number): void {
    if (this.keyboard) return;
    this.keyboardEnabled = true;
    this.keyboard = attachKeyboardControls(target, this, this.arrowCamera, () => this.onPause(), cameraSensitivityProvider);
  }

  attachTouch(surface: HTMLElement, hud: {
    joystickZone: HTMLElement;
    runButton: HTMLElement;
    sensitivityProvider: () => number;
    runToggleProvider?: () => boolean;
  }): void {
    if (this.touch) return;
    this.touch = attachTouchControls(surface, this, hud);
  }

  setTouchUiVisible(visible: boolean): void {
    this.touch?.setState(visible);
  }

  /** Called by control backends. */
  setMove(x: number, z: number, joystickActive: boolean): void {
    this.state.moveX = x;
    this.state.moveZ = z;
    this.state.joystickActive = joystickActive;
  }

  setRun(run: boolean): void {
    this.state.run = run;
  }

  addCameraDelta(yaw: number, pitch: number, zoom: number): void {
    this.camera.yawDelta += yaw;
    this.camera.pitchDelta += pitch;
    this.camera.zoomDelta += zoom;
  }

  /** Apply desktop arrow-key camera rotation (fallback) and consume accumulators. */
  consumeCamera(dt: number, sensitivity: number): CameraInput {
    if (this.keyboardEnabled) {
      const speed = 2.0 * sensitivity;
      if (this.arrowCamera.left) this.camera.yawDelta -= speed * dt;
      if (this.arrowCamera.right) this.camera.yawDelta += speed * dt;
      if (this.arrowCamera.up) this.camera.pitchDelta -= speed * dt * 0.6;
      if (this.arrowCamera.down) this.camera.pitchDelta += speed * dt * 0.6;
    }
    // Backends already scaled their deltas by the user's sensitivity, so do not
    // apply it again here (that would square it).
    const out: CameraInput = {
      yawDelta: this.camera.yawDelta,
      pitchDelta: this.camera.pitchDelta,
      zoomDelta: this.camera.zoomDelta,
    };
    this.camera.yawDelta = 0;
    this.camera.pitchDelta = 0;
    this.camera.zoomDelta = 0;
    return out;
  }

  reset(): void {
    this.state.moveX = 0;
    this.state.moveZ = 0;
    this.state.run = false;
    this.state.joystickActive = false;
    this.camera.yawDelta = 0;
    this.camera.pitchDelta = 0;
    this.camera.zoomDelta = 0;
  }

  dispose(): void {
    this.keyboard?.dispose();
    this.touch?.dispose();
    this.keyboard = null;
    this.touch = null;
  }
}
