import { expect, type Page } from '@playwright/test';

// Ganchos expostos pelo jogo quando a URL tem ?debug (veja src/game/debug.ts).
declare global {
  interface Window {
    __REALITY_BREAK__?: {
      state: () => unknown;
      teleport: (x: number, y: number, z: number) => void;
      setView: (yaw: number, pitch: number) => void;
    };
  }
}

export type DebugState = {
  state: string;
  screen: string | null;
  portraitBlocked: boolean;
  fullscreen: boolean;
  mode: 'keyboard' | 'touch';
  level: string | null;
  player: { x: number; y: number; z: number } | null;
  grounded: boolean;
  gravity: { axis: string; level: string } | null;
  plates: { id: string; force: number; active: boolean }[];
  gates: { id: string; open: boolean }[];
  time: number;
  completed: boolean;
  progress: { completed: string[]; bestTimes: Record<string, number> };
};

export async function gameState(page: Page): Promise<DebugState> {
  return page.evaluate(() => window.__REALITY_BREAK__!.state() as never);
}

/** Abre o jogo com os ganchos de teste e guarda os erros do console. */
export async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('./?debug');
  await expect(page.getByTestId('screen-menu')).toBeVisible();
  return errors;
}

/** Menu → briefing → começar o desafio. */
export async function startLevel(page: Page, levelTestId?: string): Promise<void> {
  if (levelTestId) {
    await page.getByTestId('levels').click();
    await page.getByTestId(levelTestId).click();
  } else {
    await page.getByTestId('play').click();
  }
  await expect(page.getByTestId('screen-briefing')).toBeVisible();
  await page.getByTestId('begin').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  await expect.poll(async () => (await gameState(page)).state).toBe('playing');
  // Espera a sonda pousar.
  await expect.poll(async () => (await gameState(page)).grounded, { timeout: 30_000 }).toBe(true);
}

/** Progresso salvo antes de abrir a página (libera desafios). */
export async function seedProgress(page: Page, completed: string[]): Promise<void> {
  await page.addInitScript((list) => {
    localStorage.setItem(
      'reality-break:v1',
      JSON.stringify({ version: 1, progress: { completed: list, bestTimes: {} } }),
    );
  }, completed);
}

/**
 * Segura uma tecla por um tempo de JOGO (não de relógio): sem GPU, o navegador
 * de teste desenha poucos quadros por segundo e a física anda mais devagar.
 */
export async function holdKey(page: Page, key: string, gameSeconds: number): Promise<void> {
  const start = (await gameState(page)).time;
  await page.keyboard.down(key);
  await expect
    .poll(async () => (await gameState(page)).time, { timeout: 30_000, intervals: [50] })
    .toBeGreaterThan(start + gameSeconds);
  await page.keyboard.up(key);
}

/** Espera passar um tempo de jogo. */
export async function waitGameTime(page: Page, gameSeconds: number): Promise<void> {
  const start = (await gameState(page)).time;
  await expect
    .poll(async () => (await gameState(page)).time, { timeout: 30_000, intervals: [50] })
    .toBeGreaterThan(start + gameSeconds);
}

/** Pausa: Esc no PC (o mouse fica capturado pelo jogo), botão ❙❙ no celular. */
export async function pauseGame(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await page.getByTestId('pause-button').tap();
  else await page.keyboard.press('Escape');
  await expect(page.getByTestId('screen-pause')).toBeVisible();
}
