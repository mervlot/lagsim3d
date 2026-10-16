/** Pause menu overlay. */
import { el } from './dom';
import { QUALITY_PROFILES, type GameSettings, type QualityLevelName } from '../game/GameConfig';

export interface PauseMenuActions {
  onResume(): void;
  onRespawn(): void;
  onQuit(): void;
  onSettingsChange(settings: GameSettings): void;
}

export class PauseMenu {
  readonly root: HTMLElement;
  private settings: GameSettings;
  private actions: PauseMenuActions;
  private qualitySelect: HTMLSelectElement;
  private sensitivityInput: HTMLInputElement;

  constructor(parent: HTMLElement, settings: GameSettings, actions: PauseMenuActions) {
    this.settings = { ...settings };
    this.actions = actions;
    this.root = el('div', 'overlay pause-overlay hidden');
    this.root.setAttribute('data-ui', '');

    const card = el('div', 'menu-card menu-card-small');
    card.appendChild(el('h1', 'game-title pause-title', 'Paused'));

    const resume = el('button', 'btn btn-primary', 'Resume') as HTMLButtonElement;
    resume.addEventListener('click', () => this.actions.onResume());
    card.appendChild(resume);

    const respawn = el('button', 'btn', 'Respawn at start') as HTMLButtonElement;
    respawn.addEventListener('click', () => this.actions.onRespawn());
    card.appendChild(respawn);

    const settingsBox = el('div', 'settings-box');
    settingsBox.appendChild(el('h2', 'settings-title', 'Settings'));

    this.qualitySelect = el('select', 'select') as HTMLSelectElement;
    for (const key of ['low', 'medium', 'high'] as QualityLevelName[]) {
      const opt = el('option', '', QUALITY_PROFILES[key].label) as HTMLOptionElement;
      opt.value = key;
      this.qualitySelect.appendChild(opt);
    }
    this.qualitySelect.value = settings.quality;
    this.qualitySelect.addEventListener('change', () => {
      this.settings.quality = this.qualitySelect.value as QualityLevelName;
      this.actions.onSettingsChange({ ...this.settings });
    });
    settingsBox.appendChild(this.row('Graphics quality', this.qualitySelect));

    this.sensitivityInput = el('input', 'range') as HTMLInputElement;
    this.sensitivityInput.type = 'range';
    this.sensitivityInput.min = '0.4';
    this.sensitivityInput.max = '2.2';
    this.sensitivityInput.step = '0.1';
    this.sensitivityInput.value = String(settings.cameraSensitivity);
    this.sensitivityInput.addEventListener('input', () => {
      this.settings.cameraSensitivity = parseFloat(this.sensitivityInput.value);
      this.actions.onSettingsChange({ ...this.settings });
    });
    settingsBox.appendChild(this.row('Camera sensitivity', this.sensitivityInput));
    card.appendChild(settingsBox);

    const quit = el('button', 'btn btn-ghost', 'Quit to menu') as HTMLButtonElement;
    quit.addEventListener('click', () => this.actions.onQuit());
    card.appendChild(quit);

    this.root.appendChild(card);
    parent.appendChild(this.root);
  }

  private row(labelText: string, control: HTMLElement): HTMLElement {
    const row = el('label', 'setting-row');
    row.appendChild(el('span', 'setting-label', labelText));
    row.appendChild(control);
    return row;
  }

  setSettings(settings: GameSettings): void {
    this.settings = { ...settings };
    this.qualitySelect.value = settings.quality;
    this.sensitivityInput.value = String(settings.cameraSensitivity);
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
