/** Tiny always-on-corner debug readout (FPS, draw calls, memory). Toggle with the backquote key. */
import { el } from './dom';

export class DebugHUD {
  readonly root: HTMLElement;
  private lastUpdate = 0;
  private frames = 0;
  private fps = 0;
  private visible = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'debug-hud hidden');
    this.root.setAttribute('data-ui', '');
    parent.appendChild(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Backquote') {
      this.visible = !this.visible;
      this.root.classList.toggle('hidden', !this.visible);
    }
  };

  /** Call once per rendered frame. */
  frame(nowMs: number, extra: () => string): void {
    this.frames++;
    const elapsed = nowMs - this.lastUpdate;
    if (elapsed >= 500) {
      this.fps = (this.frames * 1000) / elapsed;
      this.frames = 0;
      this.lastUpdate = nowMs;
      if (this.visible) {
        this.root.textContent = `${this.fps.toFixed(0)} fps | ${extra()}`;
      }
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}
