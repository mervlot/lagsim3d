/**
 * PlayerController — camera-relative movement fed by the shared InputManager state.
 * Keyboard and touch both end up here through the same input abstraction.
 */
import * as THREE from 'three';
import { PLAYER } from '../game/GameConfig';
import { Player } from './Player';
import { PlayerCollision } from './PlayerCollision';
import type { InputState } from '../input/InputManager';
import type { CameraRig } from '../rendering/Camera';

export class PlayerController {
  readonly player = new Player();
  readonly position = new THREE.Vector3();
  private velocity = new THREE.Vector2();
  private collision: PlayerCollision;
  private camera: CameraRig;
  private speedSmoothed = 0;

  constructor(collision: PlayerCollision, camera: CameraRig) {
    this.collision = collision;
    this.camera = camera;
  }

  spawnAt(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0);
    this.player.group.position.set(x, 0, z);
    this.player.setBodyYaw(yaw);
    this.camera.snapBehind(this.position, yaw);
  }

  getSpeed(): number {
    return this.speedSmoothed;
  }

  getVelocity(out: THREE.Vector2): THREE.Vector2 {
    out.copy(this.velocity);
    return out;
  }

  update(dt: number, input: InputState): void {
    // Camera-relative desired direction.
    const camYaw = this.camera.getYaw();
    const mx = input.moveX;
    const mz = input.moveZ;
    // Camera forward in world XZ is (sin, cos). Camera right is that rotated
    // -90° about +Y, i.e. (-cos, sin). Combine so "push right" truly moves the
    // character to the right of the screen at any camera yaw.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    let dirX = mz * sin - mx * cos;
    let dirZ = mz * cos + mx * sin;
    const mag = Math.hypot(dirX, dirZ);
    if (mag > 1) {
      dirX /= mag;
      dirZ /= mag;
    }

    const targetSpeed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const desiredX = dirX * targetSpeed * Math.min(1, mag);
    const desiredZ = dirZ * targetSpeed * Math.min(1, mag);
    const k = 1 - Math.exp(-PLAYER.accelResponse * dt);
    this.velocity.x += (desiredX - this.velocity.x) * k;
    this.velocity.y += (desiredZ - this.velocity.y) * k;

    let nx = this.position.x + this.velocity.x * dt;
    let nz = this.position.z + this.velocity.y * dt;
    const resolved = this.collision.resolve(nx, nz, PLAYER.radius);
    nx = resolved.x;
    nz = resolved.z;

    // Kill velocity into surfaces so the player does not jitter against walls.
    if (resolved.hit) {
      const afterX = this.collision.resolve(nx + this.velocity.x * 0.02, nz, PLAYER.radius);
      if (Math.abs(afterX.x - (nx + this.velocity.x * 0.02)) > 1e-4) this.velocity.x = 0;
      const afterZ = this.collision.resolve(nx, nz + this.velocity.y * 0.02, PLAYER.radius);
      if (Math.abs(afterZ.z - (nz + this.velocity.y * 0.02)) > 1e-4) this.velocity.y = 0;
    }

    this.position.x = nx;
    this.position.z = nz;
    this.position.y = 0;
    this.player.group.position.set(nx, 0, nz);

    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    this.speedSmoothed = planarSpeed;

    // Face movement direction smoothly.
    if (planarSpeed > 0.35) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.y);
      const current = this.player.getBodyYaw();
      let diff = targetYaw - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.player.setBodyYaw(current + diff * Math.min(1, PLAYER.turnResponse * dt));
    }
    this.player.animate(planarSpeed, dt);

    this.camera.update(this.position, dt);
  }
}
