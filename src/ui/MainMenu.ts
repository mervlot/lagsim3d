/**
 * Main menu overlay: title, start/resume, settings, control guide.
 */
import { el } from './dom';
import { QUALITY_PROFILES, IS_TOUCH, type GameSettings, type QualityLevelName } from '../game/GameConfig';

export interface MainMenuActions {
  onStart(): void;
  onSettingsChange(settings: GameSettings): void;
}

export class MainMenu {
  readonly root: HTMLElement;
  private startBtn: HTMLButtonElement;
  private qualitySelect!: HTMLSelectElement;
  private sensitivityInput!: HTMLInputElement;
  private invertInput: HTMLInputElement;
  private handednessSelect: HTMLSelectElement;
  private runToggleInput!: HTMLInputElement;
  private settings: GameSettings;
  private actions: MainMenuActions;
  private resumeLabel = 'Start';

  constructor(parent: HTMLElement, settings: GameSettings, actions: MainMenuActions) {
    this.settings = { ...settings };
    this.actions = actions;
    this.root = el('div', 'overlay menu-overlay');
    this.root.setAttribute('data-ui', '');

    const card = el('div', 'menu-card');
    card.appendChild(el('h1', 'game-title', 'LAGOS SIM 3D'));
    card.appendChild(el('p', 'game-subtitle', 'Phase 1 — a Lagos neighbourhood you can walk'));

    this.startBtn = el('button', 'btn btn-primary', this.resumeLabel) as HTMLButtonElement;
    this.startBtn.addEventListener('click', () => this.actions.onStart());
    card.appendChild(this.startBtn);

    const settingsBox = el('div', 'settings-box');
    settingsBox.appendChild(el('h2', 'settings-title', 'Settings'));

    settingsBox.appendChild(this.labelled('Graphics quality', this.buildQuality()));
    settingsBox.appendChild(this.labelled('Camera sensitivity', this.buildSensitivity()));
    this.invertInput = this.checkbox('Invert camera Y');
    settingsBox.appendChild(this.invertInput.parentElement as HTMLElement);
    if (!IS_TOUCH) {
      this.handednessSelect = el('select', 'select') as HTMLSelectElement;
      for (const [value, label] of [['left', 'Left'], ['right', 'Right']] as const) {
        const opt = el('option', '', label) as HTMLOptionElement;
        opt.value = value;
        this.handednessSelect.appendChild(opt);
      }
      this.handednessSelect.addEventListener('change', () => this.push());
      settingsBox.appendChild(this.labelled('Joystick hand (touch)', this.handednessSelect));
    } else {
      this.handednessSelect = el('select', 'select') as HTMLSelectElement;
      for (const [value, label] of [['left', 'Left'], ['right', 'Right']] as const) {
        const opt = el('option', '', label) as HTMLOptionElement;
        opt.value = value;
        this.handednessSelect.appendChild(opt);
      }
      this.handednessSelect.addEventListener('change', () => this.push());
      settingsBox.appendChild(this.labelled('Joystick hand', this.handednessSelect));
      this.runToggleInput = this.checkbox('Run is a toggle');
      settingsBox.appendChild(this.runToggleInput.parentElement as HTMLElement);
    }
    card.appendChild(settingsBox);

    const guide = el('div', 'control-guide');
    guide.appendChild(el('h2', '', 'Controls'));
    if (IS_TOUCH) {
      guide.appendChild(el('p', '', 'Left stick — move · Hold RUN — sprint'));
      guide.appendChild(el('p', '', 'Drag on the world — look around · Pinch — zoom'));
      guide.appendChild(el('p', '', 'Best played in landscape'));
    } else {
      guide.appendChild(el('p', '', 'W A S D / arrows — move · Shift — run'));
      guide.appendChild(el('p', '', 'Mouse drag — look around · Wheel — zoom'));
      guide.appendChild(el('p', '', 'I J K L or drag — camera · Esc — pause'));
    }
    card.appendChild(guide);

    this.root.appendChild(card);
    parent.appendChild(this.root);
    this.applySettingsToUi();
  }

  private labelled(labelText: string, control: HTMLElement): HTMLElement {
    const row = el('label', 'setting-row');
    row.appendChild(el('span', 'setting-label', labelText));
    row.appendChild(control);
    return row;
  }

  private buildQuality(): HTMLSelectElement {
    const select = el('select', 'select') as HTMLSelectElement;
    for (const key of ['low', 'medium', 'high'] as QualityLevelName[]) {
      const opt = el('option', '', QUALITY_PROFILES[key].label) as HTMLOptionElement;
      opt.value = key;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      this.settings.quality = select.value as QualityLevelName;
      this.push();
    });
    this.qualitySelect = select;
    return select;
  }

  private buildSensitivity(): HTMLInputElement {
    const input = el('input', 'range') as HTMLInputElement;
    input.type = 'range';
    input.min = '0.4';
    input.max = '2.2';
    input.step = '0.1';
    input.addEventListener('input', () => {
      this.settings.cameraSensitivity = parseFloat(input.value);
      this.push();
    });
    this.sensitivityInput = input;
    return input;
  }

  private checkbox(labelText: string): HTMLInputElement {
    const row = el('label', 'setting-row setting-check');
    const input = el('input', 'checkbox') as HTMLInputElement;
    input.type = 'checkbox';
    row.appendChild(input);
    row.appendChild(el('span', 'setting-label', labelText));
    input.addEventListener('change', () => {
      if (input === this.invertInput) this.settings.invertCameraY = input.checked;
      if (input === this.runToggleInput) this.settings.runToggle = input.checked;
      this.push();
    });
    return input;
  }

  private applySettingsToUi(): void {
    this.qualitySelect.value = this.settings.quality;
    this.sensitivityInput.value = String(this.settings.cameraSensitivity);
    this.invertInput.checked = this.settings.invertCameraY;
    this.handednessSelect.value = this.settings.handedness;
    if (this.runToggleInput) this.runToggleInput.checked = this.settings.runToggle;
  }

  setSettings(settings: GameSettings): void {
    this.settings = { ...settings };
    this.applySettingsToUi();
  }

  private push(): void {
    this.actions.onSettingsChange({ ...this.settings });
  }

  setStartLabel(label: string): void {
    this.resumeLabel = label;
    this.startBtn.textContent = label;
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
