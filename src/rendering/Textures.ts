/**
 * Procedural textures built on a canvas. In non-DOM environments (node tests)
 * a 1×1 fallback texture is returned so world building still succeeds.
 */
import * as THREE from 'three';
import { assetCache } from '../performance/AssetCache';

function hasDOM(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

function canvasTexture(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.Texture {
  return assetCache.getTexture(key, () => {
    const fallback = (): THREE.Texture => {
      const data = new Uint8Array([200, 200, 200, 255]);
      const t = new THREE.DataTexture(data, 1, 1);
      t.needsUpdate = true;
      return t;
    };
    if (!hasDOM()) return fallback();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Some environments (including our test shim) lack a 2D context.
      if (!ctx) return fallback();
      draw(ctx, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    } catch {
      return fallback();
    }
  });
}

export function asphaltTexture(): THREE.Texture {
  return canvasTexture('tex:asphalt', 256, (ctx, s) => {
    ctx.fillStyle = '#3a3d40';
    ctx.fillRect(0, 0, s, s);
    // Speckle.
    for (let i = 0; i < 900; i++) {
      const v = 40 + Math.random() * 45;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    // Patchy wear.
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(90,88,82,${0.05 + Math.random() * 0.12})`;
      const r = 12 + Math.random() * 34;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function groundTexture(): THREE.Texture {
  const tex = canvasTexture('tex:ground', 256, (ctx, s) => {
    ctx.fillStyle = '#8a7a5c';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i++) {
      const v = 90 + Math.random() * 70;
      ctx.fillStyle = `rgba(${v + 30},${v + 12},${v - 20},0.35)`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(60,110,60,${0.06 + Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, 6 + Math.random() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return tex;
}

export function plasterTexture(): THREE.Texture {
  return canvasTexture('tex:plaster', 128, (ctx, s) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) {
      const a = 0.03 + Math.random() * 0.06;
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    // Faint weathering streaks.
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgba(70,60,45,${0.03 + Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * s, 0, 2 + Math.random() * 4, s);
    }
  });
}

export function roofTexture(): THREE.Texture {
  return canvasTexture('tex:roof', 128, (ctx, s) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    // Corrugation stripes.
    for (let x = 0; x < s; x += 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(x, 0, 3, s);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 4, 0, 2, s);
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
}

export function blockWallTexture(): THREE.Texture {
  return canvasTexture('tex:blockwall', 128, (ctx, s) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    // Concrete block courses.
    const course = 16;
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y <= s; y += course) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
      const offset = (y / course) % 2 === 0 ? 0 : 16;
      for (let x = offset; x <= s; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + course);
        ctx.stroke();
      }
    }
  });
}

export function dirtPathTexture(): THREE.Texture {
  return canvasTexture('tex:path', 128, (ctx, s) => {
    ctx.fillStyle = '#a08b66';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
      const v = 120 + Math.random() * 60;
      ctx.fillStyle = `rgba(${v},${v - 20},${v - 50},0.4)`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 3, 2);
    }
  });
}
