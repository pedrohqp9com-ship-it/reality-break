import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

/**
 * Testes de ponta a ponta no build de produção (o mesmo que é publicado),
 * em um navegador de PC e em emulações de Android.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 90_000,
  use: {
    baseURL: `http://localhost:${PORT}/`,
    locale: 'pt-BR',
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    // Android em paisagem (a orientação recomendada para jogar).
    {
      name: 'android',
      use: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } },
    },
    // Android de entrada, em pé (360 px de largura).
    {
      name: 'android-small',
      use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
