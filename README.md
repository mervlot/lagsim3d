# Lagos Sim 3D — Phase 1

A mobile-first, browser-based 3D residential neighbourhood prototype inspired by Lagos.
One playable character walks a closed neighbourhood of **exactly 10 houses** with a
third-person camera, streamed/cached content, and quality scaling for low-end Android.

This is a foundation, not a full game. NPCs, traffic (cars/okada/keke), jobs, missions,
money, interiors and multiplayer are intentionally out of scope for Phase 1.

## Stack

- [three.js](https://threejs.org/) `0.186` for WebGL rendering
- TypeScript `5.9`
- Vite `7` for dev server and production build
- No runtime dependencies beyond three

## Requirements

- Node.js 20+ and npm 9+

## Commands

```bash
npm install      # install dependencies
npm run dev      # dev server, bound to 0.0.0.0 (prints a LAN URL for phones)
npm run build    # production build to dist/ (includes PWA precache manifest)
npm run preview  # serve the production build
npm run typecheck # tsc --noEmit
npm test         # headless logic + integration tests
```

### Playing on a phone

1. `npm run dev` on a machine on the same Wi‑Fi.
2. Open the printed `http://<your-lan-ip>:5173/` URL on the phone.
3. Tap **Start**. Rotate to landscape when prompted.

For the installable/offline experience, use `npm run build && npm run preview` and open
the preview URL (the service worker is registered only in production builds).

## Controls

Desktop:

- `W A S D` / arrow keys — move
- `Shift` — run
- Mouse drag — orbit the camera; mouse wheel — zoom
- `Escape` — pause/resume
- `` ` `` (backquote) — toggle the debug overlay
- `J K L I` — optionally nudge the camera with the keyboard

Touch:

- Left (or right, per handedness setting) virtual joystick — move; push fully to run
- Drag on the world — orbit the camera; pinch — zoom
- On-screen buttons — run toggle (if enabled) and pause

## Project structure

```
src/
  main.ts                 App entry: creates canvas + UI root, boots Game, registers SW
  styles.css              Global + UI styles (safe-area aware)
  game/
    Game.ts               Top-level orchestrator: state machine, loop, UI, persistence
    GameLoop.ts           rAF loop with clamped delta time and pause support
    GameConfig.ts         Tunables: world/player/camera constants, quality profiles, settings
  rendering/
    Renderer.ts           WebGLRenderer wrapper: sizing, pixel ratio, adaptive resolution
    Camera.ts             Third-person orbit rig with collision-aware follow
    Lighting.ts           Hemisphere + directional light with shadows per quality profile
    QualityManager.ts     FPS sampling -> quality level + adaptive resolution scale
    Textures.ts           Procedural canvas textures (with graceful no-DOM fallback)
    Materials.ts          Shared PBR materials built from the textures
  world/
    WorldLayout.ts        House specs, road segments, vegetation, props, spawn point, RNG
    HouseFactory.ts       Procedural house meshes with LODs and collision volumes
    RoadFactory.ts        Road/kerb meshes
    EnvironmentFactory.ts Ground, sky dome, foliage, street props
    WorldCollision.ts     Circle resolution + ray queries over a uniform grid
    ChunkManager.ts       Chunk lifecycle (Unloaded -> Loading -> Ready -> Active/Inactive)
    WorldManager.ts       Wires layout + chunks + streaming + collision together
  player/
    Player.ts             Character mesh + animation state
    PlayerController.ts   Movement, run, turn, animation blending
    PlayerCollision.ts    Player-vs-world collision adapter
  input/
    InputManager.ts       Unified input state (move/run/camera) for all devices
    KeyboardControls.ts   Desktop keyboard + mouse
    TouchControls.ts      Touch camera + gesture handling
    VirtualJoystick.ts    Analog joystick with analog run
  performance/
    AssetCache.ts         Shared geometry/material/texture cache (GPU-safe dispose)
    VisibilityManager.ts  Distance culling + LOD hysteresis per chunk/object
    PredictiveLoader.ts   Prioritised chunk load queue based on player velocity
    MemoryManager.ts      Object/GPU memory tracking for the debug overlay
  ui/
    MainMenu.ts           Start + settings
    PauseMenu.ts          Resume/respawn/quit + settings
    MobileHUD.ts          Joystick zone, run and pause buttons, handedness
    OrientationOverlay.ts Portrait warning + landscape lock
    LoadingOverlay.ts     Loading progress
    DebugHUD.ts           Toggleable perf overlay
    dom.ts                Tiny element helpers
  storage/
    SaveManager.ts        IndexedDB -> localStorage -> memory fallback for settings/position
  tests/
    *.test.ts             Node test suites (logic + UI + integration)
    dom-shim.ts           Minimal DOM for headless tests
    webgl-mock.ts         Fake WebGL2 context for headless integration tests
scripts/
  run-tests.mjs           Bundles tests with esbuild and runs node --test
  postbuild.mjs           Validates dist/ and reports precache manifest
  make-icons.mjs          Generates PWA icons (pure Node PNG writer)
public/
  sw.js                   Service worker (cache-first shell + runtime cache)
  manifest.webmanifest    PWA manifest
```

## How it works

### World and streaming

The world is a fixed 220×220 unit neighbourhood with 10 hand-placed houses, a road
network, fences, trees and street props. Content is authored in `WorldLayout.ts` and
split into 40-unit chunks. `ChunkManager` builds chunks on a budget (a few per frame)
and `PredictiveLoader` orders the queue using the player's velocity so chunks ahead are
prioritised. Chunks far away are unloaded, but their collision volumes stay resident so
the player never clips through a house that is temporarily not rendered (Phase 1 keeps
collision memory small — there are only 10 houses).

### Visibility and quality

`VisibilityManager` applies frustum culling, distance culling, and LOD selection with
hysteresis so objects do not pop. Three quality profiles (`low`/`medium`/`high`) control
resolution scale, pixel-ratio cap, shadows, and draw distances. `QualityManager` samples
frame time and can drop the render scale (and level) automatically on slow devices, so a
Redmi 10C-class phone degrades gracefully instead of stuttering.

### Rendering and caching

All geometry, materials and procedural textures are shared through `AssetCache`. Repeated
houses/fences/trees reuse the same GPU buffers; disposing checks `isShared()` before
freeing. The service worker precaches the built shell (from `dist/sw-manifest.json`) and
swaps to a cache-first strategy for same-origin assets, giving repeat loads and offline
play after the first visit.

### Persistence

`SaveManager` prefers IndexedDB, falls back to `localStorage`, then to memory. Settings
and the last player position are stored; positions outside the world or non-finite values
are rejected.

## Testing

`npm test` runs 36 headless tests via Node's test runner (bundled with esbuild, no
jsdom/vitest needed):

- collision math (circle resolution, ray/AABB, grid lookups)
- world layout (exactly 10 distinct houses, roads, spawn, chunking)
- streaming behaviour (chunks build, unload when far, never rebuild duplicates, spawn
  chunks are visible)
- predictive loading priorities
- settings/save clamping and validation
- UI construction and wiring (menus, HUD, overlays, debug toggle)
- **integration**: boots the full `Game` against a mock WebGL2 context and DOM shim,
  runs real frames, verifies draw calls/programs are issued, exercises start/pause/
  resume, and tears down cleanly

`npm run build` also validates the output and writes the precache manifest.

## Known limitations (Phase 1)

- **No real-browser verification in this environment.** Development happened in a
  CLI-only sandbox with no display, GPU, or browser. Rendering, touch input, orientation
  handling and offline behaviour are covered by a mock-WebGL integration test and by
  inspection, but have **not** been run on actual hardware/browsers here. Please verify
  on a real phone and desktop browser.
- Houses have no interiors. Collision treats each house as a solid body inside a walled
  compound; the compound gate is open so you can walk into the yards, but not into
  buildings.
- There are no NPCs, vehicles, traffic, jobs or economy (intentional for Phase 1).
- Collision stays resident for all houses rather than streaming with chunks; fine at 10
  houses, would need revisiting at city scale.
- Adaptive quality is a simple frame-time controller, not a full profiler.

## License

Prototype / internal. Add a license before distributing.
