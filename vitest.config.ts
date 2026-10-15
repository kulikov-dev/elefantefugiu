import { defineConfig } from 'vitest/config';

// Vitest runs only tests/vitest/*.spec.ts. The older tests (tests/*.test.ts) stay on node:test.
export default defineConfig({
  test: { include: ['tests/vitest/**/*.spec.ts'], environment: 'node' },
});
