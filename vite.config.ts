import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Production builds are served from `https://<user>.github.io/damia/`, so all
// asset URLs need the `/damia/` prefix. Dev mode stays at `/` so localhost
// works without the prefix in the path. AssetManager reads `import.meta.env.
// BASE_URL` to prepend the same base to runtime asset fetches.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/damia/' : '/',
  plugins: [tsconfigPaths()],
  server: {
    port: 5173,
    strictPort: true, // fail loudly if 5173 is busy instead of silently reallocating
    open: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
}));
