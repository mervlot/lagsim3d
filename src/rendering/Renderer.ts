/**
 * WebGL renderer wrapper: sizing, pixel-ratio capping, quality-driven resolution scale.
 */
import * as THREE from 'three';
import type { QualityProfile } from '../game/GameConfig';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement, profile: QualityProfile) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: profile.name === 'high',
      powerPreference: 'default',
      stencil: false,
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.applyProfile(profile);
    this.resize();
  }

  applyProfile(profile: QualityProfile): void {
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio) * profile.renderScale);
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Adaptive resolution scale (0.5–1.25) layered on top of the profile scale. */
  setAdaptiveScale(scale: number, profile: QualityProfile): void {
    const dpr = Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio);
    this.renderer.setPixelRatio(dpr * profile.renderScale * scale);
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  /** Render info for the debug overlay / tests. */
  getInfo(): { calls: number; triangles: number; points: number; lines: number } {
    const info = this.renderer.info.render;
    return { calls: info.calls, triangles: info.triangles, points: info.points, lines: info.lines };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
