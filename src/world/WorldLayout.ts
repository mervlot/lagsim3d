/**
 * Deterministic layout of the Phase 1 neighbourhood.
 * Pure data — no three.js — so it can be validated in node tests.
 */

export type RoofType = 'hip' | 'gable' | 'flat';

export interface HouseSpec {
  id: number;
  /** Plot centre in world metres. */
  cx: number;
  cz: number;
  /** Plot footprint. */
  plotW: number;
  plotD: number;
  /** Yaw in radians: rotates the plot; 0 means the gate faces +Z (south). */
  yaw: number;
  bodyW: number;
  bodyD: number;
  bodyH: number;
  storeys: number;
  roof: RoofType;
  wallColor: number;
  trimColor: number;
  roofColor: number;
  gateOpen: boolean;
  hasTank: boolean;
  hasPorch: boolean;
  treeCount: number;
}

/** Palette drawn from typical Lagos residential streets. */
const C = {
  cream: 0xd9c9a3,
  ivory: 0xe8e0cf,
  mint: 0x9fc4a8,
  sky: 0x8fb8d8,
  peach: 0xe0b089,
  ochre: 0xc9a15a,
  terracotta: 0xb5623f,
  seaGreen: 0x7fae9a,
  limeWash: 0xcfd8b2,
  white: 0xf2f2ee,
  roofRust: 0x8a4a34,
  roofBrown: 0x6e4630,
  roofGrey: 0x6b6f72,
  roofGreen: 0x4e6b55,
  gateGreen: 0x3e6b4f,
  gateBlue: 0x39577a,
  gateBrown: 0x5a4433,
};

/**
 * Ten distinct houses. Layout intent:
 *  - A north–south street at x≈0 (the "main road").
 *  - An east–west street at z≈0 (the "cross street").
 *  - Houses sit in walled compounds on both sides of both streets.
 */
export const HOUSE_SPECS: HouseSpec[] = [
  {
    id: 1,
    cx: -17, cz: -14,
    plotW: 15, plotD: 14,
    yaw: Math.PI / 2, // gate faces +X (towards main road)
    bodyW: 9, bodyD: 7.5, bodyH: 3.1,
    storeys: 1,
    roof: 'hip',
    wallColor: C.cream, trimColor: C.white, roofColor: C.roofRust,
    gateOpen: true, hasTank: true, hasPorch: true, treeCount: 2,
  },
  {
    id: 2,
    cx: -18, cz: -40,
    plotW: 16, plotD: 15,
    yaw: Math.PI / 2,
    bodyW: 10.5, bodyD: 8, bodyH: 3.2,
    storeys: 2,
    roof: 'hip',
    wallColor: C.mint, trimColor: C.white, roofColor: C.roofBrown,
    gateOpen: false, hasTank: true, hasPorch: true, treeCount: 3,
  },
  {
    id: 3,
    cx: 17, cz: -12,
    plotW: 14, plotD: 13,
    yaw: -Math.PI / 2, // gate faces -X
    bodyW: 8.5, bodyD: 7, bodyH: 3,
    storeys: 1,
    roof: 'gable',
    wallColor: C.sky, trimColor: C.white, roofColor: C.roofGrey,
    gateOpen: false, hasTank: true, hasPorch: false, treeCount: 2,
  },
  {
    id: 4,
    cx: 19, cz: -38,
    plotW: 17, plotD: 15,
    yaw: -Math.PI / 2,
    bodyW: 11, bodyD: 8.5, bodyH: 3.3,
    storeys: 2,
    roof: 'hip',
    wallColor: C.peach, trimColor: C.ivory, roofColor: C.roofBrown,
    gateOpen: true, hasTank: true, hasPorch: true, treeCount: 2,
  },
  {
    id: 5,
    cx: -17, cz: 15,
    plotW: 14.5, plotD: 14,
    yaw: Math.PI / 2,
    bodyW: 9.4, bodyD: 8.2, bodyH: 3.1,
    storeys: 1,
    roof: 'flat',
    wallColor: C.ochre, trimColor: C.white, roofColor: C.roofGrey,
    gateOpen: false, hasTank: true, hasPorch: true, treeCount: 2,
  },
  {
    id: 6,
    cx: -18, cz: 40,
    plotW: 16, plotD: 15,
    yaw: Math.PI / 2,
    bodyW: 10, bodyD: 8, bodyH: 3.2,
    storeys: 1,
    roof: 'gable',
    wallColor: C.seaGreen, trimColor: C.white, roofColor: C.roofGreen,
    gateOpen: true, hasTank: true, hasPorch: true, treeCount: 3,
  },
  {
    id: 7,
    cx: 17, cz: 16,
    plotW: 15, plotD: 14,
    yaw: -Math.PI / 2,
    bodyW: 9.5, bodyD: 7.5, bodyH: 3.1,
    storeys: 1,
    roof: 'hip',
    wallColor: C.limeWash, trimColor: C.white, roofColor: C.roofRust,
    gateOpen: false, hasTank: false, hasPorch: true, treeCount: 2,
  },
  {
    id: 8,
    cx: 19, cz: 42,
    plotW: 16, plotD: 15,
    yaw: -Math.PI / 2,
    bodyW: 10.8, bodyD: 7.8, bodyH: 3.2,
    storeys: 2,
    roof: 'hip',
    wallColor: C.ivory, trimColor: C.white, roofColor: C.roofBrown,
    gateOpen: true, hasTank: true, hasPorch: false, treeCount: 2,
  },
  {
    id: 9,
    cx: -36, cz: -22,
    plotW: 15, plotD: 14,
    yaw: 0, // gate faces +Z (towards cross street)
    bodyW: 9, bodyD: 8, bodyH: 3.1,
    storeys: 1,
    roof: 'hip',
    wallColor: C.terracotta, trimColor: C.ivory, roofColor: C.roofGrey,
    gateOpen: true, hasTank: true, hasPorch: true, treeCount: 3,
  },
  {
    id: 10,
    cx: 36, cz: -22,
    plotW: 14, plotD: 14,
    yaw: 0,
    bodyW: 8.2, bodyD: 7.4, bodyH: 3,
    storeys: 1,
    roof: 'gable',
    wallColor: C.cream, trimColor: C.white, roofColor: C.roofGreen,
    gateOpen: false, hasTank: true, hasPorch: true, treeCount: 2,
  },
];

export interface RoadSegment {
  /** Centre of the segment. */
  cx: number;
  cz: number;
  /** Axis-aligned strip half-extents. */
  halfW: number;
  halfD: number;
  orientation: 'ns' | 'ew';
}

/**
 * Roads are pre-split into 20 m segments so each piece can live in exactly one chunk.
 */
export function buildRoadSegments(): RoadSegment[] {
  const segments: RoadSegment[] = [];
  const segLen = 20;
  // Main road: north–south strip centred on x = 0, from z = -90 to z = 90.
  for (let z = -80; z <= 80; z += segLen) {
    segments.push({ cx: 0, cz: z, halfW: 3.2, halfD: segLen / 2, orientation: 'ns' });
  }
  // Cross road: east–west strip centred on z = 2, from x = -70 to x = 70.
  for (let x = -60; x <= 60; x += segLen) {
    segments.push({ cx: x, cz: 2, halfW: segLen / 2, halfD: 3.2, orientation: 'ew' });
  }
  return segments;
}

export const SPAWN_POINT = { x: 0, z: 14, yaw: Math.PI }; // facing -Z up the main road

/** Deterministic tiny PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PropPlacement {
  x: number;
  z: number;
  rot: number;
  scale: number;
  kind: 'tree' | 'bush' | 'palm';
}

/**
 * Vegetation placements scattered deterministically along verges and in compounds.
 */
export function buildVegetation(houses: HouseSpec[]): PropPlacement[] {
  const rng = makeRng(20261016);
  const props: PropPlacement[] = [];
  for (const h of houses) {
    // Trees inside each compound, away from the house body.
    for (let i = 0; i < h.treeCount; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const x = h.cx + side * (h.bodyW * 0.5 + 1.4 + rng() * 1.6);
      const z = h.cz + (rng() - 0.5) * (h.plotD * 0.6);
      props.push({ x, z, rot: rng() * Math.PI * 2, scale: 0.85 + rng() * 0.5, kind: rng() < 0.35 ? 'palm' : 'tree' });
    }
    // A couple of bushes near the gate.
    for (let i = 0; i < 2; i++) {
      props.push({
        x: h.cx + (rng() - 0.5) * h.plotW * 0.5,
        z: h.cz + (rng() < 0.5 ? -1 : 1) * h.plotD * 0.42,
        rot: rng() * Math.PI * 2,
        scale: 0.7 + rng() * 0.5,
        kind: 'bush',
      });
    }
  }
  // Street-side trees along the main road verges.
  for (let z = -75; z <= 75; z += 9) {
    if (Math.abs(z - 2) < 7) continue; // keep the junction clear
    const side = (Math.floor((z + 75) / 9) % 2 === 0) ? -1 : 1;
    props.push({
      x: side * (5.6 + rng() * 1.2),
      z: z + (rng() - 0.5) * 2,
      rot: rng() * Math.PI * 2,
      scale: 0.9 + rng() * 0.4,
      kind: rng() < 0.3 ? 'palm' : 'tree',
    });
  }
  // Scattered bushes along the cross street.
  for (let x = -62; x <= 62; x += 11) {
    if (Math.abs(x) < 7) continue;
    const side = (Math.floor((x + 62) / 11) % 2 === 0) ? -1 : 1;
    props.push({
      x: x + (rng() - 0.5) * 2,
      z: 2 + side * (5.6 + rng()),
      rot: rng() * Math.PI * 2,
      scale: 0.8 + rng() * 0.5,
      kind: 'bush',
    });
  }
  return props;
}

export interface DrumPlacement {
  x: number;
  z: number;
  rot: number;
}

/** Refuse drums and utility poles along the streets. */
export function buildStreetProps(houses: HouseSpec[]): { drums: DrumPlacement[]; poles: DrumPlacement[] } {
  const rng = makeRng(777);
  const drums: DrumPlacement[] = [];
  const poles: DrumPlacement[] = [];
  for (const h of houses) {
    if (rng() < 0.6) {
      const side = h.cx < 0 ? 1 : -1;
      drums.push({ x: h.cx + side * (h.plotW * 0.5 + 1.1), z: h.cz + (rng() - 0.5) * 4, rot: rng() * Math.PI });
    }
  }
  for (let z = -70; z <= 70; z += 24) {
    poles.push({ x: -5.2, z, rot: 0 });
  }
  for (let x = -54; x <= 54; x += 24) {
    poles.push({ x, z: 7.2, rot: Math.PI / 2 });
  }
  return { drums, poles };
}

export function chunkIndexOf(x: number, z: number, chunkSize: number): { cx: number; cz: number; key: string } {
  const cx = Math.floor(x / chunkSize);
  const cz = Math.floor(z / chunkSize);
  return { cx, cz, key: cx + ':' + cz };
}
