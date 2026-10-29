// ESLint do monorepo (PLANO §9.4). Regras recomendadas de TypeScript, mais as que protegem
// a arquitetura: o motor de leitura não acessa app, banco, rede nem ambiente (ARCHITECTURE §5).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/api/src/dados/**', '.stryker-tmp/**', 'reports/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': ['error', { allow: ['error', 'log'] }],
      eqeqeq: 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['packages/motor-leitura/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@minhapesquisa/api*', '@minhapesquisa/db*', 'pg', 'node:http*', 'node:net'] }],
      'no-restricted-properties': ['error', { object: 'process', property: 'env' }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
