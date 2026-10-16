/**
 * OrientationOverlay — asks mobile players to rotate to landscape.
 * Pauses gameplay via the provided callbacks while portrait is active.
 */
import { el } from './dom';

export class OrientationOverlay {
  readonly root: HTMLElement;
  private portrait = false;
  private onSuspend: (suspended: boolean) => void;
  private onLockRequest: () => void;

  constructor(parent: HTMLElement, onSuspend: (suspended: boolean) => void, onLockRequest: () => void) {
    this.onSuspend = onSuspend;
    this.onLockRequest = onLockRequest;
    this.root = el('div', 'overlay orientation-overlay hidden');
    this.root.setAttribute('data-ui', '');
    const card = el('div', 'orientation-card');
    const icon = el('div', 'phone-icon');
    card.appendChild(icon);
    card.appendChild(el('h2', '', 'Rotate your phone'));
    card.appendChild(el('p', '', 'Lagos Sim 3D plays in landscape.'));
    const btn = el('button', 'btn btn-primary', 'Try to lock landscape') as HTMLButtonElement;
    btn.addEventListener('click', () => this.onLockRequest());
    card.appendChild(btn);
    this.root.appendChild(card);
    parent.appendChild(this.root);

    window.addEventListener('resize', this.check);
    window.addEventListener('orientationchange', this.check);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', this.check);
    }
    this.check();
  }

  private check = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Treat a clearly taller-than-wide viewport as portrait. Desktop never triggers.
    const isMobileLike = Math.min(w, h) < 820;
    const portrait = isMobileLike && h > w;
    if (portrait === this.portrait) return;
    this.portrait = portrait;
    if (portrait) {
      this.root.classList.remove('hidden');
      this.onSuspend(true);
    } else {
      this.root.classList.add('hidden');
      this.onSuspend(false);
    }
  };

  isPortrait(): boolean {
    return this.portrait;
  }

  dispose(): void {
    window.removeEventListener('resize', this.check);
    window.removeEventListener('orientationchange', this.check);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.removeEventListener('change', this.check);
    }
    this.root.remove();
  }
}
