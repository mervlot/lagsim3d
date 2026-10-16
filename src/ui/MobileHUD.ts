/**
 * MobileHUD — joystick zone, run button, pause button.
 * The joystick/run DOM is owned by TouchControls; this module positions the
 * zones and exposes them to the input layer.
 */
import { el } from './dom';
import type { GameSettings } from '../game/GameConfig';

export class MobileHUD {
  readonly root: HTMLElement;
  readonly joystickZone: HTMLElement;
  readonly runButton: HTMLElement;
  readonly pauseButton: HTMLElement;

  constructor(parent: HTMLElement, settings: GameSettings, onPause: () => void) {
    this.root = el('div', 'hud hidden');
    this.root.setAttribute('data-ui', '');

    this.joystickZone = el('div', 'joystick-zone');
    this.joystickZone.setAttribute('data-ui', '');

    this.runButton = el('button', 'run-button', 'RUN');
    this.runButton.setAttribute('data-ui', '');
    this.runButton.setAttribute('aria-label', 'Run');

    this.pauseButton = el('button', 'pause-button', 'II');
    this.pauseButton.setAttribute('data-ui', '');
    this.pauseButton.setAttribute('aria-label', 'Pause');
    this.pauseButton.addEventListener('click', () => onPause());

    this.root.appendChild(this.joystickZone);
    this.root.appendChild(this.runButton);
    this.root.appendChild(this.pauseButton);
    parent.appendChild(this.root);
    this.setHandedness(settings.handedness);
  }

  setHandedness(handedness: GameSettings['handedness']): void {
    this.root.classList.toggle('hud-right-hand', handedness === 'right');
    this.root.classList.toggle('hud-left-hand', handedness !== 'right');
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  dispose(): void {
    this.root.remove();
  }
}
