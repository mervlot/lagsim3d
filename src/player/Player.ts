/**
 * Low-poly humanoid player: body parts are boxes parented to pivots so a
 * simple sinusoidal walk cycle animates legs and arms without an animation system.
 */
import * as THREE from 'three';
import { assetCache } from '../performance/AssetCache';
import { flatMaterial } from '../rendering/Materials';

export class Player {
  readonly group = new THREE.Group();
  private legL!: THREE.Group;
  private legR!: THREE.Group;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private torso!: THREE.Group;
  private phase = 0;
  private readonly bodyYaw = new THREE.Group();

  constructor() {
    this.group.name = 'player';
    this.bodyYaw.name = 'playerBody';
    this.group.add(this.bodyYaw);
    this.build();
  }

  private box(
    parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material,
    x: number, y: number, z: number, key: string,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      assetCache.getGeometry(`pbox:${key}`, () => new THREE.BoxGeometry(w, h, d)),
      mat
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  private build(): void {
    const skin = flatMaterial(0x6b4630, 'skin');
    const shirt = flatMaterial(0x2f6f9f, 'shirt');
    const shirtAlt = flatMaterial(0xe8e8e4, 'shirt2');
    const trousers = flatMaterial(0x2b3550, 'trousers');
    const shoes = flatMaterial(0x1d1d1f, 'shoes');

    // Hips at y≈0.95.
    this.torso = new THREE.Group();
    this.torso.position.y = 0.95;
    this.bodyYaw.add(this.torso);

    // Torso + shirt.
    this.box(this.torso, 0.42, 0.55, 0.24, shirt, 0, 0.3, 0, 'torso');
    this.box(this.torso, 0.44, 0.12, 0.26, shirtAlt, 0, 0.06, 0, 'belt');

    // Neck + head + hair + simple face.
    this.box(this.torso, 0.1, 0.08, 0.1, skin, 0, 0.62, 0, 'neck');
    this.box(this.torso, 0.22, 0.24, 0.22, skin, 0, 0.78, 0, 'head');
    this.box(this.torso, 0.24, 0.08, 0.24, flatMaterial(0x171310, 'hair'), 0, 0.9, 0, 'hair');
    this.box(this.torso, 0.035, 0.035, 0.02, flatMaterial(0x101010, 'eye'), -0.05, 0.79, 0.115, 'eyeL');
    this.box(this.torso, 0.035, 0.035, 0.02, flatMaterial(0x101010, 'eye'), 0.05, 0.79, 0.115, 'eyeR');

    // Arms hang from shoulders.
    const makeArm = (side: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(0.26 * side, 0.55, 0);
      this.torso.add(pivot);
      this.box(pivot, 0.11, 0.42, 0.13, shirt, 0, -0.18, 0, 'armU' + side);
      this.box(pivot, 0.1, 0.16, 0.12, skin, 0, -0.46, 0, 'armL' + side);
      this.box(pivot, 0.11, 0.06, 0.13, skin, 0, -0.56, 0, 'hand' + side);
      return pivot;
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    // Legs pivot at hip.
    const makeLeg = (side: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(0.11 * side, 0.95, 0);
      this.bodyYaw.add(pivot);
      this.box(pivot, 0.15, 0.48, 0.17, trousers, 0, -0.24, 0, 'legU' + side);
      this.box(pivot, 0.13, 0.4, 0.15, trousers, 0, -0.66, 0, 'legL' + side);
      this.box(pivot, 0.14, 0.08, 0.24, shoes, 0, -0.88, 0.03, 'shoe' + side);
      return pivot;
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);
  }

  /** Animate the walk cycle. `speed` in m/s (0 = idle). */
  animate(speed: number, dt: number): void {
    if (speed > 0.15) {
      this.phase += dt * (4.2 + speed * 1.35);
      const swing = Math.min(1, speed / 5) * 0.72;
      const s = Math.sin(this.phase) * swing;
      this.legL.rotation.x = s;
      this.legR.rotation.x = -s;
      this.armL.rotation.x = -s * 0.85;
      this.armR.rotation.x = s * 0.85;
      this.torso.position.y = 0.95 + Math.abs(Math.cos(this.phase)) * 0.025;
      this.torso.rotation.z = Math.sin(this.phase * 2) * 0.015;
    } else {
      this.phase = 0;
      const damp = Math.max(0, 1 - dt * 10);
      this.legL.rotation.x *= damp;
      this.legR.rotation.x *= damp;
      this.armL.rotation.x *= damp;
      this.armR.rotation.x *= damp;
      this.torso.position.y += (0.95 - this.torso.position.y) * (1 - damp);
      this.torso.rotation.z *= damp;
    }
  }

  /** World yaw of the body (radians), smoothed externally. */
  setBodyYaw(yaw: number): void {
    this.bodyYaw.rotation.y = yaw;
  }

  getBodyYaw(): number {
    return this.bodyYaw.rotation.y;
  }
}
