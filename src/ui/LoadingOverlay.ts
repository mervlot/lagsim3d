/** Lightweight loading overlay with progress text. */
import { el } from './dom';

export class LoadingOverlay {
  readonly root: HTMLElement;
  private bar: HTMLElement;
  private label: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'overlay loading-overlay hidden');
    this.root.setAttribute('data-ui', '');
    const card = el('div', 'loading-card');
    card.appendChild(el('h2', '', 'Building the neighbourhood…'));
    this.label = el('p', 'loading-label', '');
    card.appendChild(this.label);
    const track = el('div', 'loading-track');
    this.bar = el('div', 'loading-bar');
    track.appendChild(this.bar);
    card.appendChild(track);
    this.root.appendChild(card);
    parent.appendChild(this.root);
  }

  show(message = 'Loading…'): void {
    this.label.textContent = message;
    this.root.classList.remove('hidden');
  }

  setProgress(fraction: number, message?: string): void {
    const pct = Math.max(0, Math.min(1, fraction)) * 100;
    this.bar.style.width = pct.toFixed(1) + '%';
    if (message) this.label.textContent = message;
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  dispose(): void {
    this.root.remove();
  }
}
