/**
 * WorldManager — owns the level: ground, sky dome, chunk streaming, collision.
 * Registers every chunk that contains content, then lets ChunkManager stream it.
 */
import * as THREE from 'three';
import { WORLD } from '../game/GameConfig';
import { WorldCollision } from './WorldCollision';
import { ChunkManager, ChunkState, type Chunk, type ChunkContent } from './ChunkManager';
import { buildHouse, type HouseModel } from './HouseFactory';
import { buildRoadSegmentMesh } from './RoadFactory';
import { buildChunkEnvironment } from './EnvironmentFactory';
import {
  HOUSE_SPECS, buildRoadSegments, buildVegetation, buildStreetProps,
  chunkIndexOf, SPAWN_POINT, type HouseSpec, type PropPlacement, type DrumPlacement,
} from './WorldLayout';
import { groundTexture } from '../rendering/Textures';
import { assetCache } from '../performance/AssetCache';
import { VisibilityManager } from '../performance/VisibilityManager';
import type { QualityProfile } from '../game/GameConfig';

interface ChunkContentPlan {
  houses: HouseSpec[];
  roads: ReturnType<typeof buildRoadSegments>;
  vegetation: PropPlacement[];
  drums: DrumPlacement[];
  poles: DrumPlacement[];
  wirePairs: { a: { x: number; z: number }; b: { x: number; z: number } }[];
}

export class WorldManager {
  readonly scene = new THREE.Group();
  readonly collision = new WorldCollision();
  readonly spawn = { ...SPAWN_POINT };
  private chunkManager: ChunkManager;
  private visibility: VisibilityManager;
  private plans = new Map<string, ChunkContentPlan>();
  private houses: HouseModel[] = [];
  private chunkSize = WORLD.chunkSize;

  constructor(parent: THREE.Scene, profile: QualityProfile) {
    parent.add(this.scene);
    this.buildGroundAndSky();
    this.chunkManager = new ChunkManager({
      scene: this.scene,
      collision: this.collision,
      chunkSize: this.chunkSize,
      buildContent: (chunk) => this.buildChunkContent(chunk),
      unloadDistance: 260,
    });
    this.buildPlans();
    this.visibility = new VisibilityManager();
    this.visibility.setProfile(profile);
  }

  /** Build every chunk now and finalise collision (used at game start). */
  loadBlocking(activeDistance = 150): void {
    this.chunkManager.buildAll();
    this.collision.build();
    // Mark chunks around the spawn point as active so the first frame is populated.
    const spawn = this.spawn;
    for (const chunk of this.chunkManager.all()) {
      const dist = Math.hypot(chunk.centerX - spawn.x, chunk.centerZ - spawn.z);
      if (dist <= activeDistance && chunk.group) {
        chunk.state = ChunkState.Active;
        chunk.group.visible = true;
      }
    }
  }

  getHouseCount(): number {
    return this.houses.length;
  }

  getChunkManager(): ChunkManager {
    return this.chunkManager;
  }

  getSpawn(): { x: number; z: number; yaw: number } {
    return { ...this.spawn };
  }

  update(
    dt: number,
    playerX: number,
    playerZ: number,
    velX: number,
    velZ: number,
    speed: number,
    camDirX: number,
    camDirZ: number,
    profile: QualityProfile,
  ): void {
    this.visibility.setProfile(profile);
    this.chunkManager.update(
      dt, playerX, playerZ, velX, velZ, speed, camDirX, camDirZ,
      profile.buildingDistance, 4,
    );
    this.visibility.update(playerX, playerZ, this.chunkManager, profile, dt);
  }

  private buildPlans(): void {
    const roads = buildRoadSegments();
    const vegetation = buildVegetation(HOUSE_SPECS);
    const { drums, poles } = buildStreetProps(HOUSE_SPECS);

    const ensure = (key: string): ChunkContentPlan => {
      let plan = this.plans.get(key);
      if (!plan) {
        plan = { houses: [], roads: [], vegetation: [], drums: [], poles: [], wirePairs: [] };
        this.plans.set(key, plan);
      }
      return plan;
    };

    for (const spec of HOUSE_SPECS) {
      const { key } = chunkIndexOf(spec.cx, spec.cz, this.chunkSize);
      ensure(key).houses.push(spec);
    }
    for (const seg of roads) {
      const { key } = chunkIndexOf(seg.cx, seg.cz, this.chunkSize);
      ensure(key).roads.push(seg);
    }
    for (const v of vegetation) {
      const { key } = chunkIndexOf(v.x, v.z, this.chunkSize);
      ensure(key).vegetation.push(v);
    }
    for (const d of drums) {
      const { key } = chunkIndexOf(d.x, d.z, this.chunkSize);
      ensure(key).drums.push(d);
    }
    // Wires: consecutive pole pairs; each pair lives in the chunk of its first pole.
    const nsPoles = poles.filter((p) => p.x < 0).sort((a, b) => a.z - b.z);
    const ewPoles = poles.filter((p) => p.x >= 0).sort((a, b) => a.x - b.x);
    for (const run of [nsPoles, ewPoles]) {
      for (let i = 0; i < run.length - 1; i++) {
        const a = run[i];
        const b = run[i + 1];
        const { key } = chunkIndexOf(a.x, a.z, this.chunkSize);
        ensure(key).wirePairs.push({ a, b });
        // Poles themselves are registered in their own chunk.
        ensure(chunkIndexOf(b.x, b.z, this.chunkSize).key).poles.push(b);
      }
      if (run.length) ensure(chunkIndexOf(run[0].x, run[0].z, this.chunkSize).key).poles.push(run[0]);
    }

    // Register every planned chunk (and a few empty neighbours so streaming has room).
    const half = Math.ceil(WORLD.size / this.chunkSize / 2) + 1;
    for (let cx = -half; cx <= half; cx++) {
      for (let cz = -half; cz <= half; cz++) {
        this.chunkManager.register(cx, cz);
      }
    }
  }

  private buildChunkContent(chunk: Chunk): ChunkContent {
    const plan = this.plans.get(chunk.key) ?? {
      houses: [], roads: [], vegetation: [], drums: [], poles: [], wirePairs: [],
    };
    const group = new THREE.Group();
    group.name = 'chunk:' + chunk.key;
    const houses: HouseModel[] = [];
    const colliders: ReturnType<typeof buildHouse>['colliders'] = [];

    for (const spec of plan.houses) {
      const model = buildHouse(spec);
      group.add(model.root);
      houses.push(model);
      this.houses.push(model);
      colliders.push(...model.colliders);
    }
    for (const seg of plan.roads) {
      group.add(buildRoadSegmentMesh(seg));
    }

    const wireTargets = new Map<string, { x: number; z: number }[]>();
    plan.wirePairs.forEach((pair, i) => {
      wireTargets.set('w' + i, [pair.a, pair.b]);
    });
    const env = buildChunkEnvironment(plan.vegetation, plan.drums, plan.poles, wireTargets);
    group.add(env.group);
    colliders.push(...env.colliders);

    return { group, houses, colliders };
  }

  private buildGroundAndSky(): void {
    const groundTex = groundTexture().clone();
    groundTex.needsUpdate = true;
    groundTex.colorSpace = THREE.SRGBColorSpace;
    groundTex.repeat.set(WORLD.size / 8, WORLD.size / 8);
    const ground = new THREE.Mesh(
      assetCache.getGeometry(`plane:${WORLD.size}`, () => new THREE.PlaneGeometry(WORLD.size, WORLD.size)),
      assetCache.getMaterial('mat:ground', () => new THREE.MeshLambertMaterial({ map: groundTex }))
    );
    ground.name = 'ground';
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Simple gradient sky dome.
    const skyGeo = assetCache.getGeometry('skydome', () => new THREE.SphereGeometry(380, 16, 10));
    const skyMat = assetCache.getMaterial('mat:sky', () => new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 sky = mix(vec3(0.72, 0.83, 0.91), vec3(0.45, 0.65, 0.86), clamp(h, 0.0, 1.0));
          vec3 horizon = vec3(0.93, 0.88, 0.78);
          vec3 col = mix(horizon, sky, smoothstep(-0.02, 0.25, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }));
    const sky = new THREE.Mesh(skyGeo, skyMat as THREE.Material);
    sky.name = 'sky';
    sky.frustumCulled = false;
    this.scene.add(sky);
  }

  dispose(): void {
    this.chunkManager.dispose();
    this.collision.clear();
    this.plans.clear();
    this.houses = [];
  }
}
