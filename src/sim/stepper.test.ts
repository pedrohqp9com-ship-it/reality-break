import { describe, expect, it } from 'vitest';
import { FixedStepper } from './stepper';

describe('passo fixo', () => {
  it('acumula quadros curtos e devolve a fração para interpolar', () => {
    const s = new FixedStepper(1 / 60, 5);
    expect(s.advance(1 / 120)).toEqual({ steps: 0, alpha: 0.5 });
    const r = s.advance(1 / 120);
    expect(r.steps).toBe(1);
    expect(r.alpha).toBeCloseTo(0, 6);
  });

  it('limita passos depois de uma pausa longa', () => {
    const s = new FixedStepper(1 / 60, 5);
    const r = s.advance(3);
    expect(r.steps).toBe(5);
    expect(r.alpha).toBeLessThanOrEqual(1);
  });

  it('ignora valores inválidos', () => {
    const s = new FixedStepper(1 / 60, 5);
    expect(s.advance(Number.NaN).steps).toBe(0);
    expect(s.advance(-1).steps).toBe(0);
  });
});
