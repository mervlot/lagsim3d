/** Global configuration and tunable constants for Lagos Sim 3D Phase 1. */

export const WORLD = {
  /** Ground plane size (metres). */
  size: 220,
  /** Chunk edge length (metres). */
  chunkSize: 40,
  /** Keep-in clamp for the player. */
  bounds: 96,
} as const;

export const PLAYER = {
  walkSpeed: 3.4,
  runSpeed: 6.4,
  turnResponse: 12,
  accelResponse: 14,
  radius: 0.34,
  height: 1.7,
} as const;

export const CAMERA = {
  distance: 6.2,
  minDistance: 2.6,
  maxDistance: 12,
  minHeight: 0.6,
  maxHeight: 22,
  lookHeight: 1.35,
  /** Radians of pitch, clamped. */
  minPitch: -0.42,
  maxPitch: 1.15,
  keyboardRotateSpeed: 2.2,
} as const;

export const INPUT = {
  joystickDeadzone: 0.14,
  cameraSensitivity: 0.0032,
  pinchSensitivity: 0.012,
} as const;

export type QualityLevelName = 'low' | 'medium' | 'high';

export interface QualityProfile {
  name: QualityLevelName;
  label: string;
  /** Multiplier applied to device pixel ratio. */
  renderScale: number;
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  foliageDistance: number;
  detailDistance: number;
  buildingDistance: number;
}

export const QUALITY_PROFILES: Record<QualityLevelName, QualityProfile> = {
  low: {
    name: 'low',
    label: 'Low',
    renderScale: 0.7,
    maxPixelRatio: 1.25,
    shadows: false,
    shadowMapSize: 512,
    foliageDistance: 28,
    detailDistance: 45,
    buildingDistance: 110,
  },
  medium: {
    name: 'medium',
    label: 'Medium',
    renderScale: 0.85,
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    foliageDistance: 42,
    detailDistance: 70,
    buildingDistance: 150,
  },
  high: {
    name: 'high',
    label: 'High',
    renderScale: 1,
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    foliageDistance: 60,
    detailDistance: 95,
    buildingDistance: 200,
  },
};

export interface GameSettings {
  quality: QualityLevelName;
  /** Manual camera sensitivity multiplier (1 = default). */
  cameraSensitivity: number;
  invertCameraY: boolean;
  /** Which side the virtual joystick sits on. */
  handedness: 'left' | 'right';
  /** Preferred walk/run toggle behaviour on touch (hold vs toggle). */
  runToggle: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'medium',
  cameraSensitivity: 1,
  invertCameraY: false,
  handedness: 'left',
  runToggle: false,
};

export function clampSettings(raw: unknown): GameSettings {
  const out: GameSettings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const s = raw as Record<string, unknown>;
  if (s.quality === 'low' || s.quality === 'medium' || s.quality === 'high') out.quality = s.quality;
  if (typeof s.cameraSensitivity === 'number' && Number.isFinite(s.cameraSensitivity)) {
    out.cameraSensitivity = Math.min(2.5, Math.max(0.3, s.cameraSensitivity));
  }
  if (typeof s.invertCameraY === 'boolean') out.invertCameraY = s.invertCameraY;
  if (s.handedness === 'left' || s.handedness === 'right') out.handedness = s.handedness;
  if (typeof s.runToggle === 'boolean') out.runToggle = s.runToggle;
  return out;
}

export const IS_TOUCH =
  typeof window !== 'undefined' &&
  (typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    : 'ontouchstart' in window);
