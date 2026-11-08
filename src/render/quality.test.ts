import { describe, expect, it } from 'vitest';
import { FrameTimer, nextResolutionScale, qualityProfile } from './quality';

describe('qualidade gráfica', () => {
  it('perfis respeitam a densidade de pixels do aparelho', () => {
    expect(qualityProfile('baixa', 3, true).maxPixelRatio).toBe(1);
    expect(qualityProfile('alta', 3, true).maxPixelRatio).toBe(2);
    expect(qualityProfile('auto', 3, true)).toMatchObject({ maxPixelRatio: 1.5, adaptive: true });
    expect(qualityProfile('auto', 1, false).maxPixelRatio).toBe(1);
    expect(qualityProfile('baixa', 2, false).particles).toBeLessThan(qualityProfile('alta', 2, false).particles);
  });

  it('resolução cai quando o quadro passa de ~22 ms e sobe quando sobra folga', () => {
    expect(nextResolutionScale(1, 30)).toBe(0.9);
    expect(nextResolutionScale(0.9, 12)).toBe(0.945);
    expect(nextResolutionScale(1, 12)).toBe(1);
    expect(nextResolutionScale(0.56, 40)).toBe(0.55);
    expect(nextResolutionScale(0.8, 19)).toBe(0.8);
    expect(nextResolutionScale(0.8, Number.NaN)).toBe(0.8);
  });

  it('média de quadros por janela', () => {
    const timer = new FrameTimer(0.1);
    expect(timer.add(0.05)).toBeNull();
    expect(timer.add(0.05)).toBeCloseTo(50);
    expect(timer.add(2)).toBeNull(); // pausas longas não contam
  });
});
