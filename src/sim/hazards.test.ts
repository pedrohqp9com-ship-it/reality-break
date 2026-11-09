import { describe, expect, it } from 'vitest';
import type { HazardDef } from '../levels/types';
import { hazardActive, hazardCenter, hazardHits, hazardWarning, sphereTouchesBox } from './hazards';

const moving: HazardDef = {
  id: 'm',
  center: [0, 1, 0],
  size: [1, 2, 0.4],
  motion: { axis: 0, amplitude: 4, period: 4 },
};
const blinking: HazardDef = { id: 'b', center: [0, 1, 0], size: [4, 2, 0.4], blink: { period: 2, on: 0.5 } };

describe('feixes de energia', () => {
  it('vaivém senoidal pelo tempo de jogo', () => {
    expect(hazardCenter(moving, 0)).toEqual([0, 1, 0]);
    expect(hazardCenter(moving, 1)[0]).toBeCloseTo(4);
    expect(hazardCenter(moving, 3)[0]).toBeCloseTo(-4);
    expect(hazardCenter(moving, 4)[0]).toBeCloseTo(0);
    expect(hazardActive(moving, 123)).toBe(true);
  });

  it('pisca: aceso na primeira parte do ciclo, com aviso antes de acender', () => {
    expect(hazardActive(blinking, 0.2)).toBe(true);
    expect(hazardActive(blinking, 1.5)).toBe(false);
    expect(hazardWarning(blinking, 1.2)).toBe(false);
    expect(hazardWarning(blinking, 1.8)).toBe(true);
    expect(hazardWarning(blinking, 0.2)).toBe(false); // já aceso
  });

  it('colisão esfera × caixa', () => {
    expect(sphereTouchesBox({ x: 0, y: 1, z: 0.6 }, 0.5, [0, 1, 0], [1, 2, 0.4])).toBe(true);
    expect(sphereTouchesBox({ x: 0, y: 1, z: 0.75 }, 0.5, [0, 1, 0], [1, 2, 0.4])).toBe(false);
    expect(hazardHits(moving, 1, { x: 4, y: 1, z: 0 }, 0.5)).toBe(true);
    expect(hazardHits(moving, 1, { x: 0, y: 1, z: 0 }, 0.5)).toBe(false);
    expect(hazardHits(blinking, 1.5, { x: 0, y: 1, z: 0 }, 0.5)).toBe(false); // apagado
  });
});
