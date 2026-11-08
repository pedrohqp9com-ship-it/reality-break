import { describe, expect, it } from 'vitest';
import { JOYSTICK_DEAD_ZONE, joystickVector, knobOffset } from './joystick';

describe('direcional virtual', () => {
  it('arrastar para cima na tela é "frente"', () => {
    const v = joystickVector(100, 100, 100, 44, 56);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  it('zona morta ignora tremidas do polegar', () => {
    const tiny = 56 * JOYSTICK_DEAD_ZONE * 0.9;
    expect(joystickVector(0, 0, tiny, 0, 56)).toEqual({ x: 0, y: 0 });
  });

  it('limitado a 1 mesmo arrastando para longe', () => {
    const v = joystickVector(0, 0, 500, 0, 56);
    expect(v.x).toBeCloseTo(1);
    expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('o pino não sai da base', () => {
    const k = knobOffset(0, 0, 300, 400, 50);
    expect(Math.hypot(k.x, k.y)).toBeCloseTo(50);
    expect(knobOffset(0, 0, 10, 0, 50)).toEqual({ x: 10, y: 0 });
  });
});
