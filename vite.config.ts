import { existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

import { parsePosterSlug, posterFileName } from './scripts/poster/poster-slug.ts';

/**
 * The poster page (poster.html) is an unlisted staff tool. A production build
 * includes it only when `POSTER_SLUG` is set, and publishes it as `<slug>.html`
 * so the address cannot be guessed. `npm run dev` always serves `/poster.html`.
 */
function posterPage(slug: string | undefined): Plugin {
  let outDir = 'dist';
  return {
    name: 'poster-page',
    apply: 'build',
    config: () => ({
      build: {
        rolldownOptions: {
          input: slug ? { main: 'index.html', poster: 'poster.html' } : { main: 'index.html' },
        },
      },
    }),
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const built = resolve(outDir, 'poster.html');
      if (slug && existsSync(built)) renameSync(built, resolve(outDir, posterFileName(slug)));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'POSTER_');
  const slug = parsePosterSlug(process.env.POSTER_SLUG ?? env.POSTER_SLUG);
  return {
    // Relative base so the build works under any GitHub Pages sub-path
    // (https://<user>.github.io/<repo>/) and when embedded in an iframe.
    base: './',
    plugins: [posterPage(slug)],
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts', 'scripts/**/*.ts'],
        exclude: [
          '**/*.test.ts',
          'src/main.ts',
          'src/poster-main.ts',
          'src/wiring.ts',
          'scripts/sync-ical.ts',
        ],
      },
    },
  };
});
