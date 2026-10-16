/**
 * Per-chunk environment: instanced vegetation, refuse drums, utility poles and wires.
 * Everything is instanced per chunk so chunk visibility toggles the whole set cheaply.
 */
import * as THREE from 'three';
import type { PropPlacement, DrumPlacement } from './WorldLayout';
import { assetCache } from '../performance/AssetCache';
import { flatMaterial, leafMaterial, leafMaterial2, trunkMaterial, woodMaterial } from '../rendering/Materials';
import type { AABB } from './WorldCollision';

export interface ChunkEnvironment {
  group: THREE.Group;
  colliders: AABB[];
}

const _dummy = new THREE.Object3D();

function treeCanopyGeometry(): THREE.BufferGeometry {
  return assetCache.getGeometry('env:treecanopy', () => {
    const canopy = new THREE.IcosahedronGeometry(1.05, 0);
    canopy.scale(1, 0.8, 1);
    canopy.translate(0, 2.2, 0);
    return canopy;
  });
}

function treeTrunkGeometry(): THREE.BufferGeometry {
  return assetCache.getGeometry('env:treetrunk', () => {
    const trunk = new THREE.CylinderGeometry(0.11, 0.16, 1.7, 6);
    trunk.translate(0, 0.85, 0);
    return trunk;
  });
}

function palmTrunkGeometry(): THREE.BufferGeometry {
  return assetCache.getGeometry('env:palmtrunk', () => {
    const trunk = new THREE.CylinderGeometry(0.09, 0.14, 3.2, 6);
    trunk.translate(0, 1.6, 0);
    return trunk;
  });
}

function palmFrondsGeometry(): THREE.BufferGeometry {
  return assetCache.getGeometry('env:palmfronds', () => {
    const parts: THREE.BufferGeometry[] = [];
    const crown = new THREE.IcosahedronGeometry(0.28, 0);
    crown.translate(0, 3.25, 0);
    parts.push(crown);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.BoxGeometry(0.22, 0.05, 1.7);
      frond.translate(0, 0, 0.85);
      frond.rotateX(-0.45);
      frond.rotateY((i / 6) * Math.PI * 2);
      frond.translate(0, 3.2, 0);
      parts.push(frond);
    }
    return mergeSimple(parts);
  });
}

function bushGeometry(): THREE.BufferGeometry {
  return assetCache.getGeometry('env:bush', () => {
    const g = new THREE.IcosahedronGeometry(0.55, 0);
    g.scale(1, 0.75, 1);
    g.translate(0, 0.35, 0);
    return g;
  });
}

function drumGeometry(): THREE.BufferGeometry {
  return assetCache.getGeometry('env:drum', () => {
    const body = new THREE.CylinderGeometry(0.32, 0.32, 0.85, 8);
    body.translate(0, 0.425, 0);
    return body;
  });
}

function poleGeometry(): THREE.BufferGeometry {
  return assetCache.getGeometry('env:pole', () => {
    const pole = new THREE.BoxGeometry(0.16, 6.2, 0.16);
    pole.translate(0, 3.1, 0);
    const arm = new THREE.BoxGeometry(1.3, 0.1, 0.1);
    arm.translate(0, 5.7, 0);
    return mergeSimple([pole, arm]);
  });
}

/** Minimal geometry merge (position/normal/uv attributes, non-indexed). */
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of nonIndexed) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const norm = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let offset = 0;
  for (const g of nonIndexed) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const u = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    for (let i = 0; i < p.count; i++) {
      pos[(offset + i) * 3] = p.getX(i);
      pos[(offset + i) * 3 + 1] = p.getY(i);
      pos[(offset + i) * 3 + 2] = p.getZ(i);
      if (n) {
        norm[(offset + i) * 3] = n.getX(i);
        norm[(offset + i) * 3 + 1] = n.getY(i);
        norm[(offset + i) * 3 + 2] = n.getZ(i);
      }
      if (u) {
        uv[(offset + i) * 2] = u.getX(i);
        uv[(offset + i) * 2 + 1] = u.getY(i);
      }
    }
    offset += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

export function buildChunkEnvironment(
  vegetation: PropPlacement[],
  drums: DrumPlacement[],
  poles: DrumPlacement[],
  wireTargets: Map<string, { x: number; z: number }[]>,
): ChunkEnvironment {
  const group = new THREE.Group();
  group.name = 'env';
  const colliders: AABB[] = [];

  const trees = vegetation.filter((v) => v.kind === 'tree');
  const palms = vegetation.filter((v) => v.kind === 'palm');
  const bushes = vegetation.filter((v) => v.kind === 'bush');

  const addInstances = (
    geo: THREE.BufferGeometry, mat: THREE.Material, items: PropPlacement[], heightScale = 1,
  ): void => {
    if (items.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      _dummy.position.set(it.x, 0, it.z);
      _dummy.rotation.set(0, it.rot, 0);
      _dummy.scale.set(it.scale, it.scale * heightScale, it.scale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      colliders.push({ minX: it.x - 0.2, minZ: it.z - 0.2, maxX: it.x + 0.2, maxZ: it.z + 0.2 });
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  };

  addInstances(treeCanopyGeometry(), leafMaterial(), trees, 1);
  addInstances(treeTrunkGeometry(), trunkMaterial(), trees);
  addInstances(palmTrunkGeometry(), trunkMaterial(), palms);
  addInstances(palmFrondsGeometry(), leafMaterial2(), palms);
  addInstances(bushGeometry(), leafMaterial2(), bushes);

  if (drums.length) {
    const drumMesh = new THREE.InstancedMesh(drumGeometry(), flatMaterial(0x3d5a48, 'drum'), drums.length);
    drumMesh.castShadow = true;
    for (let i = 0; i < drums.length; i++) {
      const d = drums[i];
      _dummy.position.set(d.x, 0, d.z);
      _dummy.rotation.set(0, d.rot, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      drumMesh.setMatrixAt(i, _dummy.matrix);
      colliders.push({ minX: d.x - 0.33, minZ: d.z - 0.33, maxX: d.x + 0.33, maxZ: d.z + 0.33 });
    }
    drumMesh.instanceMatrix.needsUpdate = true;
    drumMesh.computeBoundingSphere();
    group.add(drumMesh);
  }

  if (poles.length) {
    const poleMesh = new THREE.InstancedMesh(poleGeometry(), woodMaterial(), poles.length);
    poleMesh.castShadow = true;
    for (let i = 0; i < poles.length; i++) {
      const p = poles[i];
      _dummy.position.set(p.x, 0, p.z);
      _dummy.rotation.set(0, p.rot, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      poleMesh.setMatrixAt(i, _dummy.matrix);
      colliders.push({ minX: p.x - 0.15, minZ: p.z - 0.15, maxX: p.x + 0.15, maxZ: p.z + 0.15 });
    }
    poleMesh.instanceMatrix.needsUpdate = true;
    poleMesh.computeBoundingSphere();
    group.add(poleMesh);

    // Wires between consecutive poles of the same run (sagging polylines).
    const linePts: number[] = [];
    for (const run of wireTargets.values()) {
      for (let i = 0; i < run.length - 1; i++) {
        const a = run[i];
        const b = run[i + 1];
        const dist = Math.hypot(b.x - a.x, b.z - a.z);
        if (dist > 40) continue;
        const steps = 6;
        let prevX = a.x;
        let prevZ = a.z;
        let prevY = 5.6;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          const y = 5.6 - Math.sin(t * Math.PI) * 0.45;
          linePts.push(prevX, prevY, prevZ, x, y, z);
          prevX = x;
          prevZ = z;
          prevY = y;
        }
      }
    }
    if (linePts.length) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
      const lines = new THREE.LineSegments(lineGeo, assetCache.getMaterial('mat:wire', () =>
        new THREE.LineBasicMaterial({ color: 0x222222 })));
      lines.frustumCulled = true;
      group.add(lines);
    }
  }

  return { group, colliders };
}
