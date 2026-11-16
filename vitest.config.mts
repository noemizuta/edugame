import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `server-only` lanza un error fuera de Next; en las pruebas se sustituye por un módulo vacío.
const alias = { 'server-only': fileURLToPath(new URL('./tests/vacio.ts', import.meta.url)) };

export default defineConfig({
  resolve: { tsconfigPaths: true, alias },
  test: {
    environment: 'node',
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      {
        extends: true,
        test: { name: 'api', include: ['tests/api/**/*.test.ts'], passWithNoTests: true, fileParallelism: false, testTimeout: 20_000 },
      },
    ],
  },
});
