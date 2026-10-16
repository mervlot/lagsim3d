/**
 * Third-person follow camera with clamped orbit, zoom, and simple wall clipping.
 */
import * as THREE from 'three';
import { CAMERA } from '../game/GameConfig';
import type { WorldCollision } from '../world/WorldCollision';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private pitch = 0.42;
  private distance: number = CAMERA.distance;
  private targetDistance: number = CAMERA.distance;
  private collision: WorldCollision | null = null;
  private readonly head = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.1, 420);
    this.camera.position.set(0, 3, 8);
  }

  setCollision(collision: WorldCollision): void {
    this.collision = collision;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  getYaw(): number {
    return this.yaw;
  }

  /** Camera forward direction in XZ (unit length). */
  getForwardXZ(out: THREE.Vector2): THREE.Vector2 {
    out.set(Math.sin(this.yaw), Math.cos(this.yaw));
    return out;
  }

  rotate(dx: number, dy: number, invertY: boolean): void {
    this.yaw += dx;
    this.pitch += dy * (invertY ? -1 : 1);
    this.pitch = Math.max(CAMERA.minPitch, Math.min(CAMERA.maxPitch, this.pitch));
  }

  zoom(delta: number): void {
    this.targetDistance = Math.max(CAMERA.minDistance, Math.min(CAMERA.maxDistance, this.targetDistance + delta));
  }

  /** Place the camera behind a yaw immediately (spawn / orientation resume). */
  snapBehind(playerPos: THREE.Vector3 | { x: number; z: number }, yaw: number): void {
    this.yaw = yaw;
    this.update(playerPos as THREE.Vector3, 0, true);
  }

  update(playerPos: THREE.Vector3, dt: number, immediate = false): void {
    this.distance += (this.targetDistance - this.distance) * (immediate ? 1 : Math.min(1, dt * 8));

    this.head.set(playerPos.x, CAMERA.lookHeight + 1.15, playerPos.z);
    const cosP = Math.cos(this.pitch);
    const offX = -Math.sin(this.yaw) * cosP;
    const offZ = -Math.cos(this.yaw) * cosP;
    const offY = Math.sin(this.pitch);

    let dist = this.distance;
    if (this.collision) {
      const hitDist = this.collision.raycast(this.head.x, this.head.z, offX, offZ, dist + 0.4);
      dist = Math.min(dist, Math.max(1.1, hitDist));
    }
    this.desired.set(this.head.x + offX * dist, this.head.y + offY * dist, this.head.z + offZ * dist);
    // Keep the camera above the ground.
    if (this.desired.y < 0.45) this.desired.y = 0.45;

    if (immediate) this.camera.position.copy(this.desired);
    else this.camera.position.lerp(this.desired, Math.min(1, dt * 14));

    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.lookTarget.set(
      this.head.x + this.forward.x * 0.6,
      this.head.y - 0.15 + Math.sin(this.pitch) * 0.4,
      this.head.z + this.forward.z * 0.6
    );
    this.camera.lookAt(this.lookTarget);
  }
}
