/**
 * Entry point: boots the game, registers the service worker in production.
 */
import './styles.css';
import { Game } from './game/Game';

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root');
  if (!canvas || !uiRoot) {
    throw new Error('Missing #game-canvas or #ui-root in the document');
  }

  // Stop the browser from pulling to refresh / scrolling the page.
  document.body.style.overflow = 'hidden';

  const game = new Game(canvas, uiRoot);
  await game.init();
  registerServiceWorker();

  // Expose for debugging in the console (and manual smoke tests).
  (window as unknown as { __lagosGame?: Game }).__lagosGame = game;
}

boot().catch((err) => {
  console.error('Failed to start Lagos Sim 3D:', err);
  const uiRoot = document.getElementById('ui-root');
  if (uiRoot) {
    const banner = document.createElement('div');
    banner.className = 'overlay';
    banner.innerHTML =
      '<div class="menu-card"><h2>Could not start the game</h2><p>' +
      (err instanceof Error ? err.message : String(err)) +
      '</p><p>Try reloading, or use a browser with WebGL 2 support.</p></div>';
    uiRoot.appendChild(banner);
  }
});
