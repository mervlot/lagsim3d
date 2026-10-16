/**
 * VirtualJoystick — pointer-driven analogue stick for touch screens.
 * Pure movement math lives in joystickVector so it can be unit-tested;
 * DOM handling stays in this module.
 */

export interface JoystickVector {
  x: number;
  y: number;
  active: boolean;
}

/**
 * Convert a normalised stick offset (-1..1 in both axes) into a clamped
 * direction vector with a deadzone. Returned x is strafe, y is forward (+up).
 */
export function joystickVector(nx: number, ny: number, deadzone: number, out: JoystickVector): JoystickVector {
  const mag = Math.hypot(nx, ny);
  if (mag < deadzone) {
    out.x = 0;
    out.y = 0;
    out.active = mag > 0.001;
    return out;
  }
  // Rescale so motion starts smoothly at the deadzone edge.
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  out.x = (nx / mag) * scaled;
  out.y = (ny / mag) * scaled;
  out.active = true;
  return out;
}

export interface VirtualJoystickOptions {
  deadzone: number;
  onChange(x: number, yForward: number, active: boolean): void;
}

export class VirtualJoystick {
  private base: HTMLElement;
  private knob: HTMLElement;
  private pointerId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  private radius = 1;
  private opts: VirtualJoystickOptions;
  private vec: JoystickVector = { x: 0, y: 0, active: false };

  constructor(base: HTMLElement, knob: HTMLElement, opts: VirtualJoystickOptions) {
    this.base = base;
    this.knob = knob;
    this.opts = opts;

    this.base.addEventListener('pointerdown', this.onDown);
    this.base.addEventListener('pointermove', this.onMove);
    this.base.addEventListener('pointerup', this.onUp);
    this.base.addEventListener('pointercancel', this.onUp);
    this.base.addEventListener('lostpointercapture', this.onUp);
  }

  private measure(): void {
    const rect = this.base.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.radius = Math.max(24, rect.width / 2 - 8);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    this.pointerId = e.pointerId;
    this.measure();
    try {
      this.base.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    this.apply(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.apply(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.vec.x = 0;
    this.vec.y = 0;
    this.vec.active = false;
    this.opts.onChange(0, 0, false);
    this.base.classList.remove('is-active');
  };

  private apply(clientX: number, clientY: number): void {
    let dx = clientX - this.centerX;
    let dy = clientY - this.centerY;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      dx = (dx / len) * this.radius;
      dy = (dy / len) * this.radius;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const nx = dx / this.radius;
    const ny = dy / this.radius;
    joystickVector(nx, -ny, this.opts.deadzone, this.vec); // screen up = forward
    this.opts.onChange(this.vec.x, this.vec.y, this.vec.active);
    this.base.classList.toggle('is-active', this.vec.active);
  }

  reset(): void {
    this.pointerId = null;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.vec = { x: 0, y: 0, active: false };
    this.base.classList.remove('is-active');
    this.opts.onChange(0, 0, false);
  }

  dispose(): void {
    this.base.removeEventListener('pointerdown', this.onDown);
    this.base.removeEventListener('pointermove', this.onMove);
    this.base.removeEventListener('pointerup', this.onUp);
    this.base.removeEventListener('pointercancel', this.onUp);
    this.base.removeEventListener('lostpointercapture', this.onUp);
  }
}
