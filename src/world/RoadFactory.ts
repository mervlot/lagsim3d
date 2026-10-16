/**
 * Road pieces: asphalt strips with concrete gutters and sandy verges.
 * Roads are pre-split into segments (see WorldLayout.buildRoadSegments) so each
 * mesh belongs to exactly one chunk and can be culled/unloaded with it.
 */
import * as THREE from 'three';
import type { RoadSegment } from './WorldLayout';
import { assetCache } from '../performance/AssetCache';
import { asphaltTexture } from '../rendering/Textures';
import { flatMaterial } from '../rendering/Materials';

export function buildRoadSegmentMesh(segment: RoadSegment): THREE.Group {
  const group = new THREE.Group();
  group.name = 'roadseg';

  const asphaltMat = assetCache.getMaterial('mat:asphalt', () => {
    const tex = asphaltTexture().clone();
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(3, 3);
    return new THREE.MeshLambertMaterial({ map: tex, color: 0xbdbdbd });
  });
  const gutterMat = flatMaterial(0x9a958c, 'gutter');
  const vergeMat = flatMaterial(0xa89877, 'verge');

  const lenW = segment.halfW * 2;
  const lenD = segment.halfD * 2;

  // Sandy verge underneath, slightly wider than the asphalt.
  const verge = new THREE.Mesh(
    assetCache.getGeometry(`box:${(lenW + 3.2).toFixed(2)},0.08,${(lenD + 3.2).toFixed(2)}`, () =>
      new THREE.BoxGeometry(lenW + 3.2, 0.08, lenD + 3.2)),
    vergeMat
  );
  verge.position.set(segment.cx, 0.02, segment.cz);
  verge.receiveShadow = true;
  group.add(verge);

  // Asphalt on top.
  const road = new THREE.Mesh(
    assetCache.getGeometry(`box:${lenW.toFixed(2)},0.1,${lenD.toFixed(2)}`, () =>
      new THREE.BoxGeometry(lenW, 0.1, lenD)),
    asphaltMat
  );
  road.position.set(segment.cx, 0.05, segment.cz);
  road.receiveShadow = true;
  group.add(road);

  // Concrete gutters along the long edges.
  const gutterGeoH = assetCache.getGeometry('box:0.35,0.22,1', () => new THREE.BoxGeometry(0.35, 0.22, 1));
  const gutterGeoV = assetCache.getGeometry('box:1,0.22,0.35', () => new THREE.BoxGeometry(1, 0.22, 0.35));
  const gutterOffset = segment.orientation === 'ns' ? segment.halfW + 0.25 : segment.halfD + 0.25;
  const count = Math.floor((segment.orientation === 'ns' ? lenD : lenW) / 2);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count - 0.5;
    for (const side of [-1, 1]) {
      const gutter = new THREE.Mesh(segment.orientation === 'ns' ? gutterGeoH : gutterGeoV, gutterMat);
      if (segment.orientation === 'ns') {
        gutter.position.set(segment.cx + side * gutterOffset, 0.11, segment.cz + t * lenD);
      } else {
        gutter.position.set(segment.cx + t * lenW, 0.11, segment.cz + side * gutterOffset);
      }
      gutter.receiveShadow = true;
      group.add(gutter);
    }
  }

  return group;
}
