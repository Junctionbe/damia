import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
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
});
