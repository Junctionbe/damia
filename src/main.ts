import { Application } from 'pixi.js';

async function bootstrap(): Promise<void> {
  const app = new Application();

  await app.init({
    background: '#1a2820',
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    preference: 'webgpu',
  });

  const container = document.getElementById('app');
  if (!container) {
    throw new Error('Missing #app root element in index.html');
  }
  container.appendChild(app.canvas);

  // M0 placeholder: just confirm Pixi is alive.
  // M1 will introduce SceneManager, Camera, TileMap.
  console.info('[Damia] Pixi v8 ready — renderer:', app.renderer.type);
}

bootstrap().catch((err) => {
  console.error('[Damia] Bootstrap failed:', err);
});
