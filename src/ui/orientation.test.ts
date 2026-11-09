import { describe, expect, it } from 'vitest';
import { detectTouchDevice, isPortraitBlocked } from './orientation';

describe('tela horizontal', () => {
  it('bloqueia só aparelhos de toque em pé', () => {
    expect(isPortraitBlocked(412, 915, true)).toBe(true);
    expect(isPortraitBlocked(915, 412, true)).toBe(false);
    expect(isPortraitBlocked(500, 900, false)).toBe(false); // janela estreita no PC
    expect(isPortraitBlocked(600, 600, true)).toBe(false); // quadrada: deixa jogar
  });

  it('detecta aparelho de toque', () => {
    const media = (coarse: boolean, fine: boolean) => (query: string) =>
      ({ matches: query.includes('coarse') ? coarse : fine }) as MediaQueryList;
    const win = (coarse: boolean, fine: boolean, touchPoints: number) =>
      ({ matchMedia: media(coarse, fine), navigator: { maxTouchPoints: touchPoints } }) as never;
    expect(detectTouchDevice(win(true, false, 5))).toBe(true);
    expect(detectTouchDevice(win(false, true, 0))).toBe(false);
    expect(detectTouchDevice(win(false, false, 5))).toBe(true);
    expect(detectTouchDevice(win(false, true, 10))).toBe(false); // notebook com tela de toque
  });
});
