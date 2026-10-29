import { defineConfig } from 'vitest/config';

// Teste de mutação (DEC-052): só os testes unitários, rápidos; a integração com banco fica
// no vitest.config.ts.
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'] },
});
