/**
 * Minimal DOM shim so UI modules can be exercised in node.
 * Only implements what the UI code actually uses.
 */

class FakeClassList {
  private set = new Set<string>();
  private owner: FakeElement | null = null;
  constructor(initial: string) {
    for (const c of initial.split(/\s+/)) if (c) this.set.add(c);
  }
  attach(owner: FakeElement): void {
    this.owner = owner;
  }
  private sync(): void {
    if (this.owner) this.owner.syncClassName(this.value);
  }
  add(...names: string[]): void {
    for (const n of names) this.set.add(n);
    this.sync();
  }
  remove(...names: string[]): void {
    for (const n of names) this.set.delete(n);
    this.sync();
  }
  toggle(name: string, force?: boolean): boolean {
    const want = force === undefined ? !this.set.has(name) : force;
    if (want) this.set.add(name);
    else this.set.delete(name);
    this.sync();
    return want;
  }
  contains(name: string): boolean {
    return this.set.has(name);
  }
  get value(): string {
    return [...this.set].join(' ');
  }
}

export class FakeElement {
  tagName: string;
  private _className = '';
  classList: FakeClassList;
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  private listeners = new Map<string, ((e: unknown) => void)[]>();
  private text = '';
  value = '';
  checked = false;
  type = '';
  disabled = false;

  constructor(tagName: string, className = '') {
    this.tagName = tagName.toLowerCase();
    this.classList = new FakeClassList(className);
    this.classList.attach(this);
    this._className = className;
  }

  get className(): string {
    return this._className;
  }

  set className(value: string) {
    this._className = value;
    this.classList = new FakeClassList(value);
    this.classList.attach(this);
  }

  /** Called by classList to keep className in sync (without rebuilding the set). */
  syncClassName(value: string): void {
    this._className = value;
  }

  get textContent(): string {
    return this.text;
  }

  set textContent(value: string) {
    this.text = value;
  }

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeElement): FakeElement {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentElement = null;
    return child;
  }

  remove(): void {
    this.parentElement?.removeChild(this);
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (name === 'class') {
      this.className = value;
      this.classList = new FakeClassList(value);
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  addEventListener(type: string, fn: (e: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: (e: unknown) => void): void {
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter((f) => f !== fn));
  }

  dispatch(type: string, event: Record<string, unknown> = {}): void {
    for (const fn of this.listeners.get(type) ?? []) {
      fn({
        type,
        preventDefault() {},
        stopPropagation() {},
        target: this,
        ...event,
      });
    }
  }

  closest(selector: string): FakeElement | null {
    let node: FakeElement | null = this;
    while (node) {
      if (selector.startsWith('.') && node.classList.contains(selector.slice(1))) return node;
      if (selector === '[data-ui]' && node.attributes['data-ui'] !== undefined) return node;
      if (selector === node.tagName) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: 100, height: 100 };
  }

  setPointerCapture(): void {}
  releasePointerCapture(): void {}
}

interface MockWindow {
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  listeners: Map<string, ((e: unknown) => void)[]>;
  addEventListener(type: string, fn: (e: unknown) => void): void;
  removeEventListener(type: string, fn: (e: unknown) => void): void;
  dispatch(type: string, event?: Record<string, unknown>): void;
  matchMedia(q: string): { matches: boolean; addEventListener(): void; removeEventListener(): void };
  requestAnimationFrame(cb: (t: number) => void): number;
  cancelAnimationFrame(id: number): void;
}

let cached: { document: unknown; window: MockWindow } | null = null;

export function installDomShim(): { document: unknown; window: MockWindow } {
  if (cached) return cached;
  const body = new FakeElement('body');
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  const doc = {
    body,
    hidden: false,
    createElement: (tag: string) => new FakeElement(tag),
    getElementById: () => null,
    addEventListener(type: string, fn: (e: unknown) => void) {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type: string, fn: (e: unknown) => void) {
      const list = listeners.get(type);
      if (list) listeners.set(type, list.filter((f) => f !== fn));
    },
    dispatch(type: string, event: Record<string, unknown> = {}) {
      for (const fn of listeners.get(type) ?? []) fn({ type, ...event });
    },
  };

  const win: MockWindow = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    listeners,
    addEventListener(type, fn) {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type);
      if (list) listeners.set(type, list.filter((f) => f !== fn));
    },
    dispatch(type, event = {}) {
      for (const fn of listeners.get(type) ?? []) {
        fn({ type, preventDefault() {}, stopPropagation() {}, ...event });
      }
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (cb) => {
      const timer = setTimeout(() => cb(performance.now()), 0);
      // Do not keep the process alive for animation frames.
      (timer as unknown as { unref?: () => void }).unref?.();
      return timer as unknown as number;
    },
    cancelAnimationFrame: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
  };

  const g = globalThis as Record<string, unknown>;
  g.document = doc;
  g.window = win;
  g.requestAnimationFrame = win.requestAnimationFrame.bind(win);
  g.cancelAnimationFrame = win.cancelAnimationFrame.bind(win);
  g.ScreenOrientation = class {};
  g.screen = {
    orientation: {
      addEventListener() {},
      removeEventListener() {},
      lock: () => Promise.reject(new Error('not allowed')),
    },
  };
  g.navigator = { serviceWorker: undefined };
  cached = { document: doc, window: win };
  return cached;
}

export function makeRoot(): FakeElement {
  return new FakeElement('div');
}
