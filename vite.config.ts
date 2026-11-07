import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works under any GitHub Pages sub-path
  // (https://<user>.github.io/<repo>/) and when embedded in an iframe.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
    },
  },
});
