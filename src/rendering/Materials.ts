/** Shared material factory — one material per colour/role across the whole world. */
import * as THREE from 'three';
import { assetCache } from '../performance/AssetCache';
import { plasterTexture, roofTexture, blockWallTexture } from './Textures';

function lambert(color: number, opts: { map?: THREE.Texture; emissive?: number } = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color,
    map: opts.map ?? null,
    emissive: opts.emissive ?? 0x000000,
  });
}

export function wallMaterial(color: number): THREE.Material {
  const key = 'mat:wall:' + color.toString(16);
  return assetCache.getMaterial(key, () => {
    const map = plasterTexture().clone();
    map.needsUpdate = true;
    map.colorSpace = THREE.SRGBColorSpace;
    return lambert(color, { map });
  });
}

export function trimMaterial(color: number): THREE.Material {
  return assetCache.getMaterial('mat:trim:' + color.toString(16), () => lambert(color));
}

export function roofMaterial(color: number): THREE.Material {
  const key = 'mat:roof:' + color.toString(16);
  return assetCache.getMaterial(key, () => {
    const map = roofTexture().clone();
    map.needsUpdate = true;
    map.colorSpace = THREE.SRGBColorSpace;
    return lambert(color, { map });
  });
}

export function blockWallMaterial(): THREE.Material {
  return assetCache.getMaterial('mat:blockwall', () => {
    const map = blockWallTexture().clone();
    map.needsUpdate = true;
    map.colorSpace = THREE.SRGBColorSpace;
    return lambert(0xcfc6ae, { map });
  });
}

export function flatMaterial(color: number, key: string): THREE.Material {
  return assetCache.getMaterial('mat:flat:' + key + ':' + color.toString(16), () => lambert(color));
}

export function windowMaterial(): THREE.Material {
  return assetCache.getMaterial('mat:window', () =>
    new THREE.MeshLambertMaterial({ color: 0x2a3a4a, emissive: 0x0a1520 })
  );
}

export function tankMaterial(): THREE.Material {
  return assetCache.getMaterial('mat:tank', () => lambert(0x1c1c1e));
}

export function metalMaterial(): THREE.Material {
  return assetCache.getMaterial('mat:metal', () => lambert(0x6a6f74));
}

export function woodMaterial(): THREE.Material {
  return assetCache.getMaterial('mat:wood', () => lambert(0x6e5340));
}

export function leafMaterial(): THREE.Material {
  return assetCache.getMaterial('mat:leaf', () => lambert(0x3f7a42));
}

export function leafMaterial2(): THREE.Material {
  return assetCache.getMaterial('mat:leaf2', () => lambert(0x558c47));
}

export function trunkMaterial(): THREE.Material {
  return assetCache.getMaterial('mat:trunk', () => lambert(0x5a4632));
}
