// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '.tools/**',
      'mobile/.expo/**',
      'mobile/babel.config.js',
      'mobile/metro.config.js',
      'mobile/jest.setup.js',
      'supabase/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/test/**', '**/*.test.ts', '**/*.test.tsx', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
