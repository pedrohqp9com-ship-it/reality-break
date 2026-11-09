import { expect, test } from '@playwright/test';
import { gameState, holdKey, openGame, pauseGame, seedProgress, startLevel, waitGameTime } from './helpers';

test.describe('menu e páginas', () => {
  test('menu principal sem erros e sem rolagem horizontal', async ({ page }) => {
    const errors = await openGame(page);
    await expect(page.getByRole('heading', { name: 'Reality Break' })).toBeVisible();
    await expect(page.getByTestId('play')).toHaveText(/jogar/i);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('desafios 2 e 3 começam bloqueados', async ({ page }) => {
    await openGame(page);
    await page.getByTestId('levels').click();
    await expect(page.getByTestId('level-leveza')).toBeEnabled();
    await expect(page.getByTestId('level-inversao')).toBeDisabled();
    await expect(page.getByTestId('level-orientacao')).toBeDisabled();
  });

  test('manifesto válido para instalar na tela inicial', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
    expect(manifest.name).toBe('REALITY BREAK');
    expect(manifest.orientation).toBe('landscape');
    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(new URL(icon.src, page.url()).toString());
      expect(response.ok(), icon.src).toBe(true);
    }
  });
});

test.describe('jogo (física real no navegador)', () => {
  test('3D ativo e a sonda pousa no chão', async ({ page }) => {
    const errors = await openGame(page);
    await startLevel(page);
    const hasContext = await page.evaluate(() => {
      const canvas = document.getElementById('scene') as HTMLCanvasElement;
      return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    });
    expect(hasContext).toBe(true);
    const state = await gameState(page);
    expect(state.level).toBe('leveza');
    expect(state.player!.y).toBeCloseTo(0.5, 1);
    await expect(page.getByTestId('gravity-level')).toHaveText('Normal · 1 g');
    expect(errors).toEqual([]);
  });

  test('a conclusão do desafio salva o progresso e libera o próximo', async ({ page }) => {
    await openGame(page);
    await startLevel(page);
    // Leva a sonda direto ao portal (gancho de teste) para validar o fluxo de conclusão.
    await page.evaluate(() => window.__REALITY_BREAK__!.teleport(0, 4.6, -34));
    await expect(page.getByTestId('screen-complete')).toBeVisible();
    await expect(page.getByTestId('result-time')).toHaveText(/^\d+:\d{2}\.\d$/);
    expect((await gameState(page)).progress.completed).toEqual(['leveza']);

    await page.reload();
    await page.getByTestId('levels').click();
    await expect(page.getByTestId('level-inversao')).toBeEnabled();
  });

  test('reiniciar volta ao início com a gravidade normal', async ({ page, isMobile }) => {
    await seedProgress(page, ['leveza', 'inversao']);
    await openGame(page);
    await startLevel(page, 'level-orientacao');
    await page.evaluate(() => window.__REALITY_BREAK__!.teleport(5, 0.6, 0));
    await pauseGame(page, isMobile);
    await page.getByTestId('restart').click();
    const state = await gameState(page);
    expect(state.state).toBe('playing');
    expect(state.player!.x).toBeCloseTo(0, 1);
    expect(state.gravity).toEqual({ axis: '-y', level: 'normal' });
  });
});

test.describe('PC: teclado', () => {
  test.skip(({ isMobile }) => isMobile, 'somente no PC');

  test('andar, mudar a intensidade e tentar um poder bloqueado', async ({ page }) => {
    await openGame(page);
    await startLevel(page);
    const before = (await gameState(page)).player!;
    await holdKey(page, 'KeyW', 0.7);
    const after = (await gameState(page)).player!;
    // Distância no plano do chão (a câmera pode ter girado com o mouse).
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(2);

    await page.keyboard.press('Digit1');
    await expect(page.getByTestId('gravity-level')).toHaveText('Leve · 0,35 g');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await gameState(page)).player!.y, { timeout: 30_000 }).toBeGreaterThan(2.5);

    // Inverter só é liberado no Desafio 2: aqui a tecla F não faz nada.
    await page.keyboard.press('KeyF');
    expect((await gameState(page)).gravity!.axis).toBe('-y');
  });

  test('inverter a gravidade no Desafio 2 leva a sonda ao teto', async ({ page }) => {
    await seedProgress(page, ['leveza']);
    await openGame(page);
    await startLevel(page, 'level-inversao');
    await page.keyboard.press('KeyF');
    await expect(page.getByTestId('gravity')).toContainText('Gravidade: Teto');
    await expect.poll(async () => (await gameState(page)).player!.y, { timeout: 30_000 }).toBeGreaterThan(8);
    await expect.poll(async () => (await gameState(page)).grounded, { timeout: 30_000 }).toBe(true);
  });

  test('apontar no Desafio 3 faz da parede norte o chão', async ({ page }) => {
    await seedProgress(page, ['leveza', 'inversao']);
    await openGame(page);
    await startLevel(page, 'level-orientacao');
    // Câmera olhando para a parede norte (o teste não depende do mouse).
    await page.evaluate(() => window.__REALITY_BREAK__!.setView(0, -0.2));
    await expect(page.getByTestId('aim-preview')).toHaveText('Apontar → Parede norte');
    await page.keyboard.press('KeyG');
    await expect.poll(async () => (await gameState(page)).player!.z, { timeout: 30_000 }).toBeLessThan(-7);
    expect((await gameState(page)).gravity!.axis).toBe('-z');
    // A queda bate na placa, mas a sonda sozinha não sustenta 1500 N.
    await waitGameTime(page, 1);
    expect((await gameState(page)).gates[0]!.open).toBe(false);
  });

  test('Esc pausa (o tempo para) e continua', async ({ page }) => {
    await openGame(page);
    await startLevel(page);
    await pauseGame(page, false);
    const t = (await gameState(page)).time;
    await page.waitForTimeout(400);
    expect((await gameState(page)).time).toBe(t);
    await page.getByTestId('resume').click();
    await expect.poll(async () => (await gameState(page)).time).toBeGreaterThan(t);
  });
});

test.describe('Android: toque', () => {
  test.skip(({ isMobile }) => !isMobile, 'somente em celular');

  test('controles de toque mostram só os poderes liberados', async ({ page }) => {
    await openGame(page);
    await startLevel(page);
    await expect(page.getByTestId('touch-controls')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pular' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gravidade leve' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inverter a gravidade' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Apontar/ })).toHaveCount(0);
  });

  test('botões LEVE e PULAR agem na física', async ({ page }) => {
    await openGame(page);
    await startLevel(page);
    await page.getByRole('button', { name: 'Gravidade leve' }).tap();
    await expect(page.getByRole('button', { name: 'Gravidade leve' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Pular' }).tap();
    await expect.poll(async () => (await gameState(page)).player!.y, { timeout: 30_000 }).toBeGreaterThan(2.5);
  });

  test('direcional virtual move a sonda', async ({ page }) => {
    await openGame(page);
    await startLevel(page);
    const before = (await gameState(page)).player!;
    const zone = page.locator('.touch-zone-move');
    const box = (await zone.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.6;
    const init = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true };
    await zone.dispatchEvent('pointerdown', { ...init, clientX: x, clientY: y });
    await page.locator('.touch-layer').dispatchEvent('pointermove', { ...init, clientX: x, clientY: y - 60 });
    await waitGameTime(page, 0.7);
    await page.locator('.touch-layer').dispatchEvent('pointerup', { ...init, clientX: x, clientY: y - 60 });
    const after = (await gameState(page)).player!;
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(2);
    expect(after.z).toBeLessThan(before.z); // arrastar para cima = para a frente
  });

  test('alvos de toque têm pelo menos 44 px', async ({ page }) => {
    await openGame(page);
    await startLevel(page);
    const buttons = page.locator('.touch-btn, .hud-pause');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box!.height, `alvo ${i}`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `alvo ${i}`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('tela horizontal', () => {
  test.skip(({ isMobile }) => !isMobile, 'somente em celular');

  test('em pé, um aviso pede para girar; deitado, o aviso some', async ({ page }) => {
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.height, height: size.width });
    await openGame(page);
    await expect(page.getByTestId('rotate-overlay')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gire o aparelho' })).toBeVisible();
    await page.setViewportSize(size);
    await expect(page.getByTestId('rotate-overlay')).toBeHidden();
  });

  test('girar para a vertical no meio do jogo pausa; ao voltar, dá para continuar', async ({ page }) => {
    const size = page.viewportSize()!;
    await openGame(page);
    await startLevel(page);
    await page.setViewportSize({ width: size.height, height: size.width });
    await expect(page.getByTestId('rotate-overlay')).toBeVisible();
    expect((await gameState(page)).state).toBe('paused');
    const t = (await gameState(page)).time;
    await page.setViewportSize(size);
    await expect(page.getByTestId('rotate-overlay')).toBeHidden();
    await expect(page.getByTestId('screen-pause')).toBeVisible();
    expect((await gameState(page)).time).toBe(t);
    await page.getByTestId('resume').tap();
    await expect.poll(async () => (await gameState(page)).time).toBeGreaterThan(t);
  });

  test('menus e briefing cabem na tela deitada (botões visíveis sem rolar)', async ({ page }) => {
    await seedProgress(page, ['leveza', 'inversao']);
    await openGame(page);
    const viewport = page.viewportSize()!;
    const fits = async (screen: string) => {
      const buttons = page.getByTestId(`screen-${screen}`).locator('button');
      const count = await buttons.count();
      expect(count, screen).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const box = (await buttons.nth(i).boundingBox())!;
        expect(box.y + box.height, `${screen}: botão ${i}`).toBeLessThanOrEqual(viewport.height);
        expect(box.y, `${screen}: botão ${i}`).toBeGreaterThanOrEqual(0);
      }
    };
    await fits('menu');
    await page.getByTestId('levels').tap();
    await fits('levels');
    await page.getByTestId('level-orientacao').tap();
    await fits('briefing');
    await page.getByTestId('begin').tap();
    await expect.poll(async () => (await gameState(page)).state).toBe('playing');
    await page.getByTestId('pause-button').tap();
    await fits('pause');
  });

  test('a interface cabe na tela deitada, sem cortes', async ({ page }) => {
    await openGame(page);
    await startLevel(page);
    const viewport = page.viewportSize()!;
    const boxes = page.locator('.hud-icon-btn:visible, .hud-pause, .touch-btn, .hud-gravity, .hud-title');
    const count = await boxes.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const box = (await boxes.nth(i).boundingBox())!;
      expect(box.x, `elemento ${i}`).toBeGreaterThanOrEqual(0);
      expect(box.y, `elemento ${i}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `elemento ${i}`).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height, `elemento ${i}`).toBeLessThanOrEqual(viewport.height);
    }
  });
});

test.describe('tela cheia', () => {
  test('entra e sai da tela cheia (botão do HUD no celular, menu de pausa no PC)', async ({ page, isMobile }) => {
    await openGame(page);
    await startLevel(page);
    test.skip(!(await page.evaluate(() => document.fullscreenEnabled)), 'navegador sem tela cheia');
    if (isMobile) {
      await page.getByTestId('fullscreen-button').tap();
    } else {
      // No PC o cursor fica capturado durante o jogo: a tela cheia fica no menu de pausa.
      await pauseGame(page, false);
      await page.getByTestId('pause-fullscreen').click();
      await expect(page.getByTestId('pause-fullscreen')).toHaveText('Sair da tela cheia');
    }
    await expect.poll(async () => (await gameState(page)).fullscreen).toBe(true);
    await expect(page.getByTestId('fullscreen-button')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(async () => (await gameState(page)).fullscreen).toBe(false);
  });
});
