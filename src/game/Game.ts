/**
 * Game — top-level orchestrator: scene, loop, state machine, UI, persistence.
 */
import * as THREE from 'three';
import { Renderer } from '../rendering/Renderer';
import { CameraRig } from '../rendering/Camera';
import { Lighting } from '../rendering/Lighting';
import { QualityManager } from '../rendering/QualityManager';
import { WorldManager } from '../world/WorldManager';
import { PlayerController } from '../player/PlayerController';
import { PlayerCollision } from '../player/PlayerCollision';
import { InputManager } from '../input/InputManager';
import { GameLoop } from './GameLoop';
import { clampSettings, IS_TOUCH, type GameSettings } from './GameConfig';
import { MainMenu } from '../ui/MainMenu';
import { PauseMenu } from '../ui/PauseMenu';
import { MobileHUD } from '../ui/MobileHUD';
import { OrientationOverlay } from '../ui/OrientationOverlay';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { DebugHUD } from '../ui/DebugHUD';
import { SaveManager } from '../storage/SaveManager';
import { MemoryManager } from '../performance/MemoryManager';
import { assetCache } from '../performance/AssetCache';

type GameState = 'menu' | 'loading' | 'playing' | 'paused';

export class Game {
  private scene = new THREE.Scene();
  private renderer: Renderer;
  private camera: CameraRig;
  private lighting: Lighting;
  private quality: QualityManager;
  private world: WorldManager;
  private player: PlayerController;
  private input: InputManager;
  private loop = new GameLoop((dt, now) => this.tick(dt, now));
  private save = new SaveManager();
  private memory = new MemoryManager();
  private state: GameState = 'menu';
  private settings: GameSettings;
  private mainMenu: MainMenu;
  private pauseMenu: PauseMenu;
  private hud: MobileHUD | null = null;
  private orientation: OrientationOverlay;
  private loading: LoadingOverlay;
  private debug: DebugHUD;
  private saveTimer = 0;
  private disposed = false;
  private orientationSuspended = false;
  private disposedListenerFns: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.settings = clampSettings(undefined);

    // Renderer + camera.
    this.quality = new QualityManager(this.settings.quality);
    const profile = this.quality.getProfile();
    this.renderer = new Renderer(canvas, profile);
    this.camera = new CameraRig(16 / 9);

    // World.
    this.world = new WorldManager(this.scene, profile);
    this.camera.setCollision(this.world.collision);
    this.lighting = new Lighting(this.scene, profile);

    // Player.
    const playerCollision = new PlayerCollision(this.world.collision);
    this.player = new PlayerController(playerCollision, this.camera);
    this.scene.add(this.player.player.group);
    const spawn = this.world.getSpawn();
    this.player.spawnAt(spawn.x, spawn.z, spawn.yaw);

    // Input.
    this.input = new InputManager(() => this.togglePause());
    this.input.attachKeyboard(window, () => this.settings.cameraSensitivity);
    if (IS_TOUCH) {
      this.hud = new MobileHUD(uiRoot, this.settings, () => this.togglePause());
      this.input.attachTouch(canvas, {
        joystickZone: this.hud.joystickZone,
        runButton: this.hud.runButton,
        sensitivityProvider: () => this.settings.cameraSensitivity,
        runToggleProvider: () => this.settings.runToggle,
      });
    }

    // UI.
    this.mainMenu = new MainMenu(uiRoot, this.settings, {
      onStart: () => void this.start(),
      onSettingsChange: (s) => this.applySettings(s),
    });
    this.pauseMenu = new PauseMenu(uiRoot, this.settings, {
      onResume: () => this.resume(),
      onRespawn: () => this.respawn(),
      onQuit: () => this.quitToMenu(),
      onSettingsChange: (s) => this.applySettings(s),
    });
    this.orientation = new OrientationOverlay(uiRoot, (s) => this.setOrientationSuspended(s), () => this.requestLandscapeLock());
    this.loading = new LoadingOverlay(uiRoot);
    this.debug = new DebugHUD(uiRoot);
    this.memory.watch(this.scene);

    // Adaptive quality hook.
    this.quality.onChange((change) => {
      this.renderer.applyProfile(change.profile);
      this.renderer.setAdaptiveScale(change.adaptiveScale, change.profile);
      this.lighting.applyProfile(this.scene, change.profile);
    });

    // Resize / visibility.
    const onResize = (): void => {
      this.renderer.resize();
      const size = this.renderer.getSize();
      this.camera.setAspect(size.width / Math.max(1, size.height));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const onVisibility = (): void => {
      if (document.hidden && this.state === 'playing') this.pause();
      this.loop.resetClock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.disposedListenerFns.push(() => window.removeEventListener('resize', onResize));
    this.disposedListenerFns.push(() => window.removeEventListener('orientationchange', onResize));
    this.disposedListenerFns.push(() => document.removeEventListener('visibilitychange', onVisibility));

    onResize();
    this.memory.check(performance.now());
    this.loop.start();
  }

  /** Load saved settings + position, warm the world, then show the menu. */
  async init(): Promise<void> {
    await this.save.whenReady();
    this.settings = await this.save.loadSettings();
    this.quality.setLevel(this.settings.quality, 'initial');
    this.mainMenu.setSettings(this.settings);
    this.pauseMenu.setSettings(this.settings);
    this.hud?.setHandedness(this.settings.handedness);

    this.state = 'loading';
    this.loading.show('Loading the neighbourhood…');
    // Let the loading overlay paint before the (short) synchronous build.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const spawn = this.world.getSpawn();
    const savedPos = await this.save.loadLastPosition(spawn);
    // Blocking world build: the world is small (~10 houses) so this is quick.
    this.world.loadBlocking();
    if (savedPos) {
      this.player.spawnAt(savedPos.x, savedPos.z, savedPos.yaw);
    }
    this.loading.setProgress(1, 'Ready');
    this.loading.hide();
    this.state = 'menu';
    this.mainMenu.setStartLabel(savedPos ? 'Resume' : 'Start');
    this.mainMenu.show();
  }

  private async start(): Promise<void> {
    if (IS_TOUCH) {
      this.requestLandscapeLock();
    }
    this.mainMenu.hide();
    this.pauseMenu.hide();
    this.state = 'playing';
    if (this.hud) this.hud.show();
    this.input.setTouchUiVisible(IS_TOUCH);
    this.loop.resetClock();
  }

  private togglePause(): void {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.reset();
    this.pauseMenu.show();
    void this.persistPosition();
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.pauseMenu.hide();
    this.state = 'playing';
    this.loop.resetClock();
  }

  private respawn(): void {
    const spawn = this.world.getSpawn();
    this.player.spawnAt(spawn.x, spawn.z, spawn.yaw);
    this.resume();
  }

  private async quitToMenu(): Promise<void> {
    await this.persistPosition();
    this.pauseMenu.hide();
    this.hud?.hide();
    this.input.setTouchUiVisible(false);
    this.input.reset();
    this.state = 'menu';
    this.mainMenu.show();
  }

  private setOrientationSuspended(suspended: boolean): void {
    this.orientationSuspended = suspended;
    if (suspended && this.state === 'playing') this.pause();
  }

  private async requestLandscapeLock(): Promise<void> {
    try {
      const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
      }
    } catch {
      /* browsers may refuse; the overlay handles portrait gracefully */
    }
  }

  private applySettings(settings: GameSettings): void {
    this.settings = clampSettings(settings);
    this.quality.setLevel(this.settings.quality);
    this.pauseMenu.setSettings(this.settings);
    this.mainMenu.setSettings(this.settings);
    this.hud?.setHandedness(this.settings.handedness);
    void this.save.saveSettings(this.settings);
  }

  private async persistPosition(): Promise<void> {
    const yaw = this.camera.getYaw();
    await this.save.savePosition(this.player.position.x, this.player.position.z, yaw);
  }

  private tick(dt: number, now: number): void {
    if (this.disposed) return;

    // Always sample frame time for adaptive quality (even in menus).
    this.quality.sample(dt * 1000, dt);

    if (this.state === 'playing' && !this.orientationSuspended) {
      const profile = this.quality.getProfile();
      const camInput = this.input.consumeCamera(dt, this.settings.cameraSensitivity);
      if (camInput.yawDelta !== 0 || camInput.pitchDelta !== 0) {
        this.camera.rotate(camInput.yawDelta, camInput.pitchDelta, this.settings.invertCameraY);
      }
      if (camInput.zoomDelta !== 0) this.camera.zoom(camInput.zoomDelta);

      this.player.update(dt, this.input.state);

      const camDir = this.camera.getForwardXZ(this.scratchVec2);
      const vel = this.player.getVelocity(this.scratchVec2B);
      this.world.update(
        dt,
        this.player.position.x, this.player.position.z,
        vel.x, vel.y,
        this.player.getSpeed(),
        camDir.x, camDir.y,
        profile,
      );
      this.lighting.follow(this.player.position.x, this.player.position.z);

      this.saveTimer += dt;
      if (this.saveTimer > 5) {
        this.saveTimer = 0;
        void this.persistPosition();
      }
    } else {
      // Keep the camera framed on the player behind menus.
      this.camera.update(this.player.position, dt);
    }

    this.renderer.render(this.scene, this.camera.camera);
    this.memory.check(now);
    this.debug.frame(now, () => {
      const info = this.renderer.getInfo();
      const mem = this.memory.snapshot();
      return `${info.calls} calls · ${info.triangles} tris · ${mem.sceneObjects} objs · q:${this.settings.quality}`;
    });
  }

  private scratchVec2 = new THREE.Vector2();
  private scratchVec2B = new THREE.Vector2();

  getState(): GameState {
    return this.state;
  }

  destroy(): void {
    this.disposed = true;
    this.loop.stop();
    for (const fn of this.disposedListenerFns) fn();
    this.input.dispose();
    this.mainMenu.dispose();
    this.pauseMenu.dispose();
    this.hud?.dispose();
    this.orientation.dispose();
    this.loading.dispose();
    this.debug.dispose();
    this.world.dispose();
    this.lighting.dispose(this.scene);
    assetCache.dispose();
    this.renderer.dispose();
  }
}
