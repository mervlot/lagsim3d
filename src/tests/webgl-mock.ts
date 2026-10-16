/**
 * Fake WebGL2 context for headless integration testing.
 *
 * This is NOT a renderer — it only satisfies the WebGL API surface three.js
 * touches while compiling programs and issuing draw calls, so the full Game
 * wiring (scene graph, chunk streaming, input, UI, loop) can run in node and
 * we can assert on draw-call counts and state transitions.
 */

const ids = new Map<string, number>();
let nextId = 1;
function constId(name: string): number {
  let id = ids.get(name);
  if (id === undefined) {
    id = nextId++;
    ids.set(name, id);
  }
  return id;
}
function nameOf(id: number): string | null {
  for (const [n, i] of ids) if (i === id) return n;
  return null;
}

export interface MockCanvas {
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  style: Record<string, unknown>;
  addEventListener(): void;
  removeEventListener(): void;
  getContext(name: string): unknown;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

export interface MockGLStats {
  drawCalls: number;
  programs: number;
}

export function makeMockCanvas(width = 960, height = 540): { canvas: MockCanvas; stats: MockGLStats } {
  const stats: MockGLStats = { drawCalls: 0, programs: 0 };
  const canvas: MockCanvas = {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext(name: string) {
      if (name !== 'webgl2' && name !== 'webgl') return null;
      return makeGL(canvas, stats);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width, height };
    },
  };
  return { canvas, stats };
}

function makeGL(canvas: MockCanvas, stats: MockGLStats): unknown {
  const target: Record<string, unknown> = {
    canvas,
    drawingBufferWidth: canvas.width,
    drawingBufferHeight: canvas.height,
    getParameter(p: number) {
      const n = nameOf(p);
      if (n === 'VERSION') return 'WebGL 2.0 (mock)';
      if (n === 'SHADING_LANGUAGE_VERSION') return 'WebGL GLSL ES 3.00 (mock)';
      if (n === 'VENDOR' || n === 'RENDERER') return 'lagos-sim-mock';
      if (n === 'MAX_TEXTURE_SIZE' || n === 'MAX_CUBE_MAP_TEXTURE_SIZE') return 8192;
      if (n === 'MAX_VERTEX_ATTRIBS') return 16;
      if (n === 'MAX_SAMPLES') return 4;
      if (n === 'MAX_VERTEX_UNIFORM_VECTORS' || n === 'MAX_FRAGMENT_UNIFORM_VECTORS') return 1024;
      if (n === 'MAX_TEXTURE_IMAGE_UNITS' || n === 'MAX_COMBINED_TEXTURE_IMAGE_UNITS' || n === 'MAX_VERTEX_TEXTURE_IMAGE_UNITS') return 16;
      if (n === 'MAX_VARYING_VECTORS') return 15;
      return 0;
    },
    getExtension() {
      return null;
    },
    getSupportedExtensions() {
      return [];
    },
    getShaderPrecisionFormat() {
      return { precision: 23, rangeMin: 127, rangeMax: 127 };
    },
    getProgramParameter() {
      return true;
    },
    getShaderParameter() {
      return true;
    },
    getProgramInfoLog() {
      return '';
    },
    getShaderInfoLog() {
      return '';
    },
    getUniformLocation() {
      return {};
    },
    getAttribLocation() {
      return 0;
    },
    getActiveUniform() {
      return { name: 'u', size: 1, type: constId('FLOAT_VEC4') };
    },
    getActiveAttrib() {
      return { name: 'a', size: 1, type: constId('FLOAT_VEC3') };
    },
    createProgram() {
      stats.programs++;
      return {};
    },
    createShader() {
      return {};
    },
    createBuffer() {
      return {};
    },
    createTexture() {
      return {};
    },
    createFramebuffer() {
      return {};
    },
    createRenderbuffer() {
      return {};
    },
    createVertexArray() {
      return {};
    },
    createSampler() {
      return {};
    },
    checkFramebufferStatus() {
      return constId('FRAMEBUFFER_COMPLETE');
    },
    getError() {
      return 0;
    },
    isContextLost() {
      return false;
    },
    drawElements() {
      stats.drawCalls++;
    },
    drawArrays() {
      stats.drawCalls++;
    },
    drawElementsInstanced() {
      stats.drawCalls++;
    },
    drawArraysInstanced() {
      stats.drawCalls++;
    },
  };

  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string];
      if (typeof prop === 'string' && /^[A-Z][A-Z0-9_]*$/.test(prop)) return constId(prop);
      return () => {};
    },
  });
}

export function installWebGLGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  g.WebGL2RenderingContext = class WebGL2RenderingContext {};
  g.WebGLRenderingContext = class WebGLRenderingContext {};
}
