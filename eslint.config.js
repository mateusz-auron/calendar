// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Clean Architecture dependency rule: a layer may not import the listed layers.
 * @param {string} files glob of the layer
 * @param {string[]} forbidden layer folder names it must not depend on
 */
const layer = (files, forbidden) => ({
  files: [files],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: forbidden.map((name) => ({
          group: [`**/${name}`, `**/${name}/**`],
          message: `This layer must not depend on "${name}" (see CLAUDE.md, Architecture).`,
        })),
      },
    ],
  },
});

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
    },
  },
  // Dependencies point inwards only:
  // domain <- application <- presentation | infrastructure | embed | config <- main.ts
  layer('src/domain/**', ['application', 'infrastructure', 'presentation', 'embed', 'config']),
  layer('src/application/**', ['infrastructure', 'presentation', 'embed', 'config']),
  layer('src/infrastructure/**', ['application', 'presentation', 'embed', 'config']),
  layer('src/presentation/**', ['infrastructure', 'embed', 'config']),
  layer('src/embed/**', ['application', 'infrastructure', 'presentation', 'config']),
  layer('src/config/**', ['application', 'infrastructure', 'presentation', 'embed']),
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  prettier,
);
