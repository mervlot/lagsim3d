/**
 * GameLoop — requestAnimationFrame with clamped delta time and pause support.
 * Handles tab visibility so huge deltas after suspension never reach gameplay.
 */
export class GameLoop {
  private running = false;
  private last = 0;
  private rafId = 0;
  private updateFn: (dt: number, nowMs: number) => void;

  constructor(updateFn: (dt: number, nowMs: number) => void) {
    this.updateFn = updateFn;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number): void => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(tick);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.05) dt = 0.05; // clamp after stalls / tab switches
      if (dt < 0) dt = 0;
      this.updateFn(dt, now);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Call after a pause so the next frame does not see a giant delta. */
  resetClock(): void {
    this.last = performance.now();
  }

  setUpdate(fn: (dt: number, nowMs: number) => void): void {
    this.updateFn = fn;
  }
}
