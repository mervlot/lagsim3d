/**
 * QualityManager — manual quality profiles plus conservative adaptive scaling.
 * Frame times are smoothed; quality never changes more than once every few seconds,
 * and gameplay movement is never touched.
 */
import { QUALITY_PROFILES, type QualityLevelName, type QualityProfile } from '../game/GameConfig';

export interface QualityChange {
  profile: QualityProfile;
  adaptiveScale: number;
  reason: 'initial' | 'manual' | 'down' | 'up';
}

export class QualityManager {
  private level: QualityLevelName;
  private adaptiveScale = 1;
  private emaFrame = 16.7;
  private downStreak = 0;
  private upStreak = 0;
  private cooldown = 0;
  private listeners: ((change: QualityChange) => void)[] = [];

  constructor(initial: QualityLevelName) {
    this.level = initial;
  }

  getProfile(): QualityProfile {
    return QUALITY_PROFILES[this.level];
  }

  getAdaptiveScale(): number {
    return this.adaptiveScale;
  }

  onChange(listener: (change: QualityChange) => void): void {
    this.listeners.push(listener);
  }

  setLevel(level: QualityLevelName, reason: 'manual' | 'initial' = 'manual'): void {
    if (level === this.level) return;
    this.level = level;
    this.adaptiveScale = 1;
    this.resetStreaks();
    this.emit(reason);
  }

  /** Feed a frame duration in milliseconds. */
  sample(dtMs: number, dt: number): void {
    this.cooldown -= dt;
    const k = 1 - Math.exp(-dt * 1.2);
    this.emaFrame += (Math.min(dtMs, 120) - this.emaFrame) * k;

    if (this.cooldown > 0) return;

    if (this.emaFrame > 40) {
      this.downStreak += dt;
      this.upStreak = 0;
      if (this.downStreak > 2) this.stepDown();
    } else if (this.emaFrame < 22) {
      this.upStreak += dt;
      this.downStreak = 0;
      // Only climb back if we previously dropped the adaptive scale or sit below max.
      if (this.upStreak > 8 && this.adaptiveScale < 1) this.stepUp();
    } else {
      this.downStreak = 0;
      this.upStreak = 0;
    }
  }

  private stepDown(): void {
    this.downStreak = 0;
    this.cooldown = 6;
    if (this.adaptiveScale > 0.7) {
      this.adaptiveScale = Math.max(0.7, this.adaptiveScale - 0.12);
      this.emit('down');
    }
  }

  private stepUp(): void {
    this.upStreak = 0;
    this.cooldown = 8;
    this.adaptiveScale = Math.min(1, this.adaptiveScale + 0.1);
    this.emit('up');
  }

  private resetStreaks(): void {
    this.downStreak = 0;
    this.upStreak = 0;
    this.cooldown = 2;
  }

  private emit(reason: QualityChange['reason']): void {
    const change: QualityChange = { profile: this.getProfile(), adaptiveScale: this.adaptiveScale, reason };
    for (const l of this.listeners) l(change);
  }

  getEmaFrame(): number {
    return this.emaFrame;
  }
}
