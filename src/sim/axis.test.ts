import { describe, expect, it } from 'vitest';
import { AXES, axisVector, isAxis, nearestAxis, oppositeAxis } from './axis';

describe('eixos', () => {
  it('seis eixos, cada um com o oposto correto', () => {
    expect(AXES).toHaveLength(6);
    expect(new Set(AXES).size).toBe(6);
    for (const axis of AXES) {
      expect(oppositeAxis(oppositeAxis(axis))).toBe(axis);
      const v = axisVector(axis);
      const o = axisVector(oppositeAxis(axis));
      expect(v.dot(o)).toBe(-1);
      expect(v.length()).toBe(1);
    }
  });

  it('eixo mais próximo de uma direção', () => {
    expect(nearestAxis({ x: 0.1, y: -0.9, z: 0.2 })).toBe('-y');
    expect(nearestAxis({ x: 0, y: 0.2, z: -1 })).toBe('-z');
    expect(nearestAxis({ x: -0.7, y: 0.69, z: 0 })).toBe('-x');
    expect(nearestAxis({ x: 0, y: 1, z: 0 })).toBe('+y');
  });

  it('isAxis valida textos', () => {
    expect(isAxis('+x')).toBe(true);
    expect(isAxis('x')).toBe(false);
    expect(isAxis(3)).toBe(false);
  });
});
