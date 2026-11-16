import { defineConfig } from '@playwright/test';

/**
 * E2E contra los emuladores (npm run test:e2e los enciende con emulators:exec).
 * Usa el Chrome instalado en el equipo (channel: 'chrome'): no descarga navegadores.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3200',
    channel: 'chrome',
    locale: 'es-PE',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx next build && npx next start -p 3200',
    url: 'http://localhost:3200',
    reuseExistingServer: true,
    timeout: 300_000,
    env: { USE_FIREBASE_EMULATOR: 'true', NEXT_PUBLIC_URL_SITIO: 'http://localhost:3200' },
  },
});
