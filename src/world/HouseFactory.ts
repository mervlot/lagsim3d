/**
 * Procedural Lagos-style house builder.
 * Each house is produced twice: a detailed LOD0 group and a cheap LOD1 group,
 * plus world-space AABB colliders that stay valid even when visuals are hidden.
 *
 * Houses are built in local space with the compound gate facing +Z,
 * then rotated/translated into world space (yaw is always a multiple of 90°).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HouseSpec } from './WorldLayout';
import type { AABB } from './WorldCollision';
import { assetCache } from '../performance/AssetCache';
import {
  wallMaterial, trimMaterial, roofMaterial, blockWallMaterial, flatMaterial,
  windowMaterial, tankMaterial, metalMaterial, woodMaterial,
} from '../rendering/Materials';

export interface HouseModel {
  id: number;
  /** Parent group containing both LODs — add this to the chunk. */
  root: THREE.Group;
  lod0: THREE.Group;
  lod1: THREE.Group;
  colliders: AABB[];
  cx: number;
  cz: number;
  radius: number;
}

const WALL_THICK = 0.24;
const WALL_HEIGHT = 2.15;
const PILLAR = 0.45;
const GATE_WIDTH = 3.4;

interface Part {
  matKey: string;
  mat: THREE.Material;
  geo: THREE.BufferGeometry;
}

class PartList {
  private parts: Part[] = [];

  box(matKey: string, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0): void {
    const geo = assetCache.getGeometry(boxKey(w, h, d), () => new THREE.BoxGeometry(w, h, d)).clone();
    if (rotY !== 0) geo.rotateY(rotY);
    geo.translate(x, y, z);
    this.parts.push({ matKey, mat, geo });
  }

  custom(matKey: string, mat: THREE.Material, geo: THREE.BufferGeometry): void {
    this.parts.push({ matKey, mat, geo });
  }

  addTo(parent: THREE.Group): void {
    const byMat = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
    for (const p of this.parts) {
      let entry = byMat.get(p.matKey);
      if (!entry) {
        entry = { mat: p.mat, geos: [] };
        byMat.set(p.matKey, entry);
      }
      entry.geos.push(p.geo);
    }
    for (const [key, entry] of byMat) {
      const merged = entry.geos.length === 1 ? entry.geos[0] : mergeGeometries(entry.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, entry.mat);
      mesh.name = 'housepart:' + key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.parts.length = 0;
  }
}

function boxKey(w: number, h: number, d: number): string {
  return `box:${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
}

function hipRoofGeometry(w: number, d: number, h: number): THREE.BufferGeometry {
  // Hip roof with ridge along the longer horizontal axis.
  const flip = d > w;
  const ew = flip ? d : w;
  const ed = flip ? w : d;
  const hw = ew / 2;
  const hd = ed / 2;
  const rx = Math.max(0.001, hw - hd);
  const pos: number[] = [];
  const idx: number[] = [];
  const push = (x: number, y: number, z: number): number => {
    pos.push(x, y, z);
    return pos.length / 3 - 1;
  };
  // Front slope (+Z).
  const a0 = push(-hw, 0, hd);
  const a1 = push(hw, 0, hd);
  const a2 = push(rx, h, 0);
  const a3 = push(-rx, h, 0);
  idx.push(a0, a1, a2, a0, a2, a3);
  // Back slope (-Z).
  const b0 = push(hw, 0, -hd);
  const b1 = push(-hw, 0, -hd);
  const b2 = push(-rx, h, 0);
  const b3 = push(rx, h, 0);
  idx.push(b0, b1, b2, b0, b2, b3);
  // East end triangle.
  const c0 = push(hw, 0, hd);
  const c1 = push(hw, 0, -hd);
  const c2 = push(rx, h, 0);
  idx.push(c0, c1, c2);
  // West end triangle.
  const d0 = push(-hw, 0, -hd);
  const d1 = push(-hw, 0, hd);
  const d2 = push(-rx, h, 0);
  idx.push(d0, d1, d2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    uv[i * 2] = (pos[i * 3] / ew + 0.5) * 1.5;
    uv[i * 2 + 1] = (pos[i * 3 + 2] / ed + 0.5) * 1.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (flip) geo.rotateY(Math.PI / 2);
  return geo;
}

function gableRoofGeometry(w: number, d: number, h: number): THREE.BufferGeometry {
  // Ridge along X, gable ends facing ±X.
  const hw = w / 2;
  const hd = d / 2;
  const pos: number[] = [
    // slopes
    -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
    -hw, 0, -hd, -hw, h, 0, hw, h, 0, -hw, 0, -hd, hw, h, 0, hw, 0, -hd,
    // gable ends
    -hw, 0, hd, -hw, h, 0, -hw, 0, -hd,
    hw, 0, -hd, hw, h, 0, hw, 0, hd,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const idx: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) idx.push(i);
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const uvArr = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    uvArr[i * 2] = (pos[i * 3] / w + 0.5) * 1.6;
    uvArr[i * 2 + 1] = (pos[i * 3 + 2] / d + 0.5) * 1.6;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  return geo;
}

function roofGeometryCache(type: 'hip' | 'gable', w: number, d: number, h: number): THREE.BufferGeometry {
  const key = `roof:${type}:${w.toFixed(2)},${d.toFixed(2)},${h.toFixed(2)}`;
  return assetCache.getGeometry(key, () => (type === 'hip' ? hipRoofGeometry(w, d, h) : gableRoofGeometry(w, d, h)));
}

/** Transform a local AABB into world space for a plot with yaw (multiple of 90°) + centre. */
export function transformAABB(minX: number, minZ: number, maxX: number, maxZ: number, yaw: number, cx: number, cz: number): AABB {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const corners = [
    [minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ],
  ];
  let wminX = Infinity, wminZ = Infinity, wmaxX = -Infinity, wmaxZ = -Infinity;
  for (const [lx, lz] of corners) {
    const wx = lx * cos + lz * sin + cx;
    const wz = -lx * sin + lz * cos + cz;
    wminX = Math.min(wminX, wx);
    wmaxX = Math.max(wmaxX, wx);
    wminZ = Math.min(wminZ, wz);
    wmaxZ = Math.max(wmaxZ, wz);
  }
  return { minX: wminX, minZ: wminZ, maxX: wmaxX, maxZ: wmaxZ };
}

function addWindowsAndDoor(
  parts: PartList,
  spec: HouseSpec,
  bodyW: number,
  bodyD: number,
  height: number,
): void {
  const frame = trimMaterial(spec.trimColor);
  const glass = windowMaterial();
  const door = woodMaterial();
  const frontZ = bodyD / 2;
  const winH = 1.05;
  const winW = 0.95;
  const yBase = spec.storeys === 2 ? height / 2 - 0.2 : 1.65;

  const addWindow = (x: number, y: number, z: number, rotY: number): void => {
    parts.box('trim', frame, winW + 0.18, winH + 0.18, 0.1, x, y, z, rotY);
    parts.box('window', glass, winW, winH, 0.08, x, y, z, rotY);
  };

  // Front facade (door + windows).
  parts.box('trim', frame, 1.15, 2.2, 0.14, bodyW * 0.22, 1.1, frontZ + 0.02);
  parts.box('wood', door, 1.0, 2.05, 0.1, bodyW * 0.22, 1.025, frontZ + 0.05);
  addWindow(-bodyW * 0.28, yBase, frontZ + 0.02, 0);
  if (bodyW > 8) addWindow(-bodyW * 0.05, yBase, frontZ + 0.02, 0);
  if (spec.storeys === 2) {
    addWindow(-bodyW * 0.28, height - 1.35, frontZ + 0.02, 0);
    addWindow(bodyW * 0.15, height - 1.35, frontZ + 0.02, 0);
    addWindow(bodyW * 0.22, 1.65, frontZ + 0.02, 0);
  }

  // Side facades.
  const sideX = bodyW / 2;
  addWindow(sideX + 0.02, 1.7, -bodyD * 0.15, Math.PI / 2);
  addWindow(-sideX - 0.02, 1.7, -bodyD * 0.15, -Math.PI / 2);
  if (bodyD > 7) {
    addWindow(sideX + 0.02, 1.7, bodyD * 0.2, Math.PI / 2);
    addWindow(-sideX - 0.02, 1.7, bodyD * 0.2, -Math.PI / 2);
  }
  if (spec.storeys === 2) {
    addWindow(sideX + 0.02, height - 1.35, -bodyD * 0.1, Math.PI / 2);
    addWindow(-sideX - 0.02, height - 1.35, -bodyD * 0.1, -Math.PI / 2);
  }
  // Back.
  addWindow(-bodyW * 0.2, 1.7, -frontZ - 0.02, Math.PI);
  addWindow(bodyW * 0.2, 1.7, -frontZ - 0.02, Math.PI);
}

export function buildHouse(spec: HouseSpec): HouseModel {
  const lod0 = new THREE.Group();
  const lod1 = new THREE.Group();
  lod0.name = `house${spec.id}:lod0`;
  lod1.name = `house${spec.id}:lod1`;
  lod1.visible = false;

  const parts = new PartList();
  const cheap = new PartList();
  const wallMat = wallMaterial(spec.wallColor);
  const trim = trimMaterial(spec.trimColor);
  const roofMat = roofMaterial(spec.roofColor);
  const block = blockWallMaterial();

  const plotW = spec.plotW;
  const plotD = spec.plotD;
  const halfW = plotW / 2;
  const halfD = plotD / 2;

  // --- Compound perimeter wall ---
  const wallSeg = 0.22;
  const addWallRun = (
    x: number, z: number, w: number, d: number,
  ): void => {
    parts.box('block', block, w, WALL_HEIGHT, d, x, WALL_HEIGHT / 2, z);
    cheap.box('block', block, w, WALL_HEIGHT, d, x, WALL_HEIGHT / 2, z);
  };
  addWallRun(0, -halfD + wallSeg / 2, plotW, wallSeg); // back
  addWallRun(-halfW + wallSeg / 2, 0, wallSeg, plotD); // left
  addWallRun(halfW - wallSeg / 2, 0, wallSeg, plotD); // right
  const southLeftW = (plotW - GATE_WIDTH) / 2;
  addWallRun(-(GATE_WIDTH / 2 + southLeftW / 2), halfD - wallSeg / 2, southLeftW, wallSeg);
  addWallRun(GATE_WIDTH / 2 + southLeftW / 2, halfD - wallSeg / 2, southLeftW, wallSeg);

  // Pillars: corners + gate posts.
  const pillarH = WALL_HEIGHT + 0.35;
  const pillarSpots: [number, number][] = [
    [-halfW + 0.1, -halfD + 0.1], [halfW - 0.1, -halfD + 0.1],
    [-halfW + 0.1, halfD - 0.1], [halfW - 0.1, halfD - 0.1],
    [-GATE_WIDTH / 2 - 0.22, halfD - 0.1], [GATE_WIDTH / 2 + 0.22, halfD - 0.1],
  ];
  for (const [px, pz] of pillarSpots) {
    parts.box('block', block, PILLAR, pillarH, PILLAR, px, pillarH / 2, pz);
    parts.box('trim', trim, PILLAR + 0.12, 0.12, PILLAR + 0.12, px, pillarH + 0.06, pz);
  }
  // Pillar collision (gate posts only; wall segments already collide).
  const localColliders: AABB[] = [
    { minX: -GATE_WIDTH / 2 - 0.45, minZ: halfD - 0.35, maxX: -GATE_WIDTH / 2 + 0.02, maxZ: halfD + 0.25 },
    { minX: GATE_WIDTH / 2 - 0.02, minZ: halfD - 0.35, maxX: GATE_WIDTH / 2 + 0.45, maxZ: halfD + 0.25 },
  ];

  // --- Gate ---
  const gateMat = flatMaterial(0x3e6b4f, 'gate');
  const panelW = GATE_WIDTH / 2 - 0.06;
  if (spec.gateOpen) {
    // Panels swung inward.
    parts.box('gate', gateMat, panelW, 1.9, 0.08, -GATE_WIDTH / 2 + panelW / 2, 0.95, halfD - 0.55, Math.PI / 2.4);
    parts.box('gate', gateMat, panelW, 1.9, 0.08, GATE_WIDTH / 2 - panelW / 2, 0.95, halfD - 0.55, -Math.PI / 2.4);
  } else {
    parts.box('gate', gateMat, panelW, 1.9, 0.08, -GATE_WIDTH / 4, 0.95, halfD - 0.08);
    parts.box('gate', gateMat, panelW, 1.9, 0.08, GATE_WIDTH / 4, 0.95, halfD - 0.08);
    localColliders.push({ minX: -GATE_WIDTH / 2, minZ: halfD - 0.2, maxX: GATE_WIDTH / 2, maxZ: halfD + 0.1 });
  }

  // --- Yard surface + path to the door ---
  parts.box('yard', flatMaterial(0xb7a582, 'yard'), plotW - 0.6, 0.06, plotD - 0.6, 0, 0.03, 0);
  parts.box('path', flatMaterial(0xc4b596, 'path'), 1.6, 0.05, plotD * 0.45, 0, 0.06, halfD - plotD * 0.28 - 1.2);

  // --- House body ---
  const bodyW = spec.bodyW;
  const bodyD = spec.bodyD;
  const storeyH = spec.bodyH;
  const height = storeyH * spec.storeys + (spec.roof === 'flat' ? 0.25 : 0);
  const bodyZ = -plotD * 0.08;
  parts.box('wall', wallMat, bodyW, height, bodyD, 0, height / 2, bodyZ);
  cheap.box('wall', wallMat, bodyW, height, bodyD, 0, height / 2, bodyZ);
  // Plinth.
  parts.box('plinth', flatMaterial(0x8a8378, 'plinth'), bodyW + 0.25, 0.3, bodyD + 0.25, 0, 0.15, bodyZ);
  localColliders.push({ minX: -bodyW / 2, minZ: bodyZ - bodyD / 2, maxX: bodyW / 2, maxZ: bodyZ + bodyD / 2 });

  // --- Roof ---
  const overhang = 0.55;
  if (spec.roof === 'flat') {
    parts.box('roof', roofMat, bodyW + 0.5, 0.18, bodyD + 0.5, 0, height + 0.09, bodyZ);
    // Parapet.
    const ph = 0.5;
    parts.box('roof', roofMat, bodyW + 0.5, ph, 0.16, 0, height + 0.18 + ph / 2, bodyZ + bodyD / 2 + 0.17);
    parts.box('roof', roofMat, bodyW + 0.5, ph, 0.16, 0, height + 0.18 + ph / 2, bodyZ - bodyD / 2 - 0.17);
    parts.box('roof', roofMat, 0.16, ph, bodyD + 0.5, bodyW / 2 + 0.17, height + 0.18 + ph / 2, bodyZ);
    parts.box('roof', roofMat, 0.16, ph, bodyD + 0.5, -bodyW / 2 - 0.17, height + 0.18 + ph / 2, bodyZ);
    cheap.box('roof', roofMat, bodyW + 0.5, 0.5, bodyD + 0.5, 0, height + 0.4, bodyZ);
  } else {
    const rh = spec.roof === 'hip' ? 1.9 : 1.7;
    const geo = roofGeometryCache(spec.roof, bodyW + overhang * 2, bodyD + overhang * 2, rh);
    const roofClone = geo.clone();
    roofClone.translate(0, height, bodyZ);
    parts.custom('roof', roofMat, roofClone);
    cheap.custom('roof', roofMat, roofClone.clone());
    // Fascia board under the eaves.
    parts.box('trim', trim, bodyW + overhang * 2, 0.1, bodyD + overhang * 2, 0, height + 0.02, bodyZ);
  }

  // --- Porch ---
  if (spec.hasPorch) {
    const porchW = 2.8;
    const porchD = 1.6;
    const porchZ = bodyZ + bodyD / 2 + porchD / 2 - 0.05;
    parts.box('yard', flatMaterial(0xbfb094, 'yard'), porchW, 0.12, porchD, bodyW * 0.22, 0.06, porchZ);
    parts.box('trim', trim, 0.16, storeyH - 0.2, 0.16, bodyW * 0.22 - porchW / 2 + 0.2, (storeyH - 0.2) / 2 + 0.12, porchZ + porchD / 2 - 0.2);
    parts.box('trim', trim, 0.16, storeyH - 0.2, 0.16, bodyW * 0.22 + porchW / 2 - 0.2, (storeyH - 0.2) / 2 + 0.12, porchZ + porchD / 2 - 0.2);
    parts.box('roof', roofMat, porchW + 0.3, 0.14, porchD + 0.3, bodyW * 0.22, storeyH - 0.02, porchZ);
  }

  // --- Balcony for two-storey houses ---
  if (spec.storeys === 2) {
    const bz = bodyZ + bodyD / 2 + 0.55;
    parts.box('trim', trim, bodyW * 0.65, 0.12, 1.1, -bodyW * 0.1, storeyH + 0.06, bz);
    const railY = storeyH + 0.55;
    parts.box('metal', metalMaterial(), bodyW * 0.65, 0.06, 0.06, -bodyW * 0.1, railY + 0.35, bz + 0.5);
    for (let i = 0; i <= 4; i++) {
      const px = -bodyW * 0.1 - bodyW * 0.325 + (bodyW * 0.65 * i) / 4;
      parts.box('metal', metalMaterial(), 0.05, 0.7, 0.05, px, railY, bz + 0.5);
    }
    parts.box('metal', metalMaterial(), 0.05, 0.7, 1.05, -bodyW * 0.1 - bodyW * 0.325, railY, bz);
    parts.box('metal', metalMaterial(), 0.05, 0.7, 1.05, -bodyW * 0.1 + bodyW * 0.325, railY, bz);
  }

  addWindowsAndDoor(parts, spec, bodyW, bodyD, height);

  // --- Water tank on a stand ---
  if (spec.hasTank) {
    const tx = bodyW / 2 + 1.2;
    const tz = bodyZ - bodyD / 4;
    const standH = 1.5;
    const tankR = 0.65;
    const tankH = 1.35;
    for (const [lx, lz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]] as const) {
      parts.box('metal', metalMaterial(), 0.09, standH, 0.09, tx + lx, standH / 2, tz + lz);
    }
    parts.box('metal', metalMaterial(), 1.15, 0.08, 1.15, tx, standH + 0.04, tz);
    const tankGeo = assetCache.getGeometry('cyl:tank', () => new THREE.CylinderGeometry(tankR, tankR, tankH, 10)).clone();
    tankGeo.translate(tx, standH + 0.08 + tankH / 2, tz);
    parts.custom('tank', tankMaterial(), tankGeo);
    cheap.custom('tank', tankMaterial(), tankGeo.clone());
    localColliders.push({ minX: tx - 0.6, minZ: tz - 0.6, maxX: tx + 0.6, maxZ: tz + 0.6 });
  }

  // --- Perimeter wall colliders ---
  localColliders.push({ minX: -halfW, minZ: -halfD - WALL_THICK, maxX: halfW, maxZ: -halfD });
  localColliders.push({ minX: -halfW - WALL_THICK, minZ: -halfD, maxX: -halfW, maxZ: halfD });
  localColliders.push({ minX: halfW, minZ: -halfD, maxX: halfW + WALL_THICK, maxZ: halfD });
  localColliders.push({ minX: -halfW, minZ: halfD, maxX: -GATE_WIDTH / 2, maxZ: halfD + WALL_THICK });
  localColliders.push({ minX: GATE_WIDTH / 2, minZ: halfD, maxX: halfW, maxZ: halfD + WALL_THICK });

  // --- Assemble in local space, then place in the world ---
  const root = new THREE.Group();
  root.name = `house${spec.id}`;
  parts.addTo(lod0);
  cheap.addTo(lod1);
  root.add(lod0);
  root.add(lod1);
  root.rotation.y = spec.yaw;
  root.position.set(spec.cx, 0, spec.cz);

  const colliders = localColliders.map((c) => transformAABB(c.minX, c.minZ, c.maxX, c.maxZ, spec.yaw, spec.cx, spec.cz));
  const radius = Math.hypot(plotW, plotD) / 2;

  return { id: spec.id, root, lod0, lod1, colliders, cx: spec.cx, cz: spec.cz, radius };
}
