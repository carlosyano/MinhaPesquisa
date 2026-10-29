import { defineConfig } from 'vitest/config';

// Testes do IMP-001 (IA-TEST, DEC-053). Integração contra PostgreSQL real: cada arquivo
// sobe o próprio harness, então os arquivos não rodam em paralelo.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
