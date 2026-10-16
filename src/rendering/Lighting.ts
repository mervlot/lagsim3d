/**
 * Lighting — hemisphere fill plus one shadow-casting directional sun that
 * follows the player with texel-snapped coordinates to avoid shadow shimmer.
 */
import * as THREE from 'three';
import type { QualityProfile } from '../game/GameConfig';

export class Lighting {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private texel = 1;

  constructor(scene: THREE.Scene, profile: QualityProfile) {
    this.hemi = new THREE.HemisphereLight(0xbfd8f0, 0x8a7a58, 0.85);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.55);
    this.sun.position.set(40, 60, 25);
    this.sun.castShadow = profile.shadows;
    this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    const extent = 34;
    this.sun.shadow.camera.left = -extent;
    this.sun.shadow.camera.right = extent;
    this.sun.shadow.camera.top = extent;
    this.sun.shadow.camera.bottom = -extent;
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    scene.fog = new THREE.Fog(0xd9d2c2, 70, 260);
  }

  applyProfile(scene: THREE.Scene, profile: QualityProfile): void {
    this.sun.castShadow = profile.shadows;
    this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    this.texel = (68 / profile.shadowMapSize);
    void scene;
  }

  /** Keep the shadow frustum centred near the player. */
  follow(playerX: number, playerZ: number): void {
    const snappedX = Math.round(playerX / this.texel) * this.texel;
    const snappedZ = Math.round(playerZ / this.texel) * this.texel;
    this.sun.position.set(snappedX + 42, 58, snappedZ + 26);
    this.sun.target.position.set(snappedX, 0, snappedZ);
    this.sun.target.updateMatrixWorld();
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.sun);
    scene.remove(this.sun.target);
    scene.remove(this.hemi);
  }
}
