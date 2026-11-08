import { describe, expect, it } from 'vitest';
import { PLAYER } from './config';
import {
  EARTH_GRAVITY,
  GravityController,
  gravityMagnitude,
  gravityVector,
  jumpHeight,
  type Power,
} from './gravity';

const all = new Set<Power>(['intensity', 'flip', 'aim']);

describe('gravidade', () => {
  it('intensidades em relação à Terra', () => {
    expect(gravityMagnitude('normal')).toBeCloseTo(EARTH_GRAVITY);
    expect(gravityMagnitude('leve')).toBeCloseTo(EARTH_GRAVITY * 0.35);
    expect(gravityMagnitude('pesada')).toBeCloseTo(EARTH_GRAVITY * 2);
    const v = gravityVector({ axis: '+x', level: 'pesada' });
    expect(v.x).toBeCloseTo(19.62);
    expect(v.y).toBe(0);
  });

  it('altura do salto segue h = v²/2g', () => {
    expect(jumpHeight(PLAYER.jumpSpeed, 'normal')).toBeCloseTo(1.835, 2);
    expect(jumpHeight(PLAYER.jumpSpeed, 'leve')).toBeCloseTo(5.24, 1);
    expect(jumpHeight(PLAYER.jumpSpeed, 'pesada')).toBeCloseTo(0.917, 2);
  });

  it('poderes bloqueados não têm efeito', () => {
    const g = new GravityController(new Set<Power>(['intensity']));
    expect(g.flip()).toBeNull();
    expect(g.aim({ x: 1, y: 0, z: 0 })).toBeNull();
    expect(g.state).toEqual({ axis: '-y', level: 'normal' });
    expect(g.setLevel('leve')?.current).toEqual({ axis: '-y', level: 'leve' });
  });

  it('mudar para o mesmo estado não gera mudança', () => {
    const g = new GravityController(all);
    expect(g.setLevel('normal')).toBeNull();
    expect(g.aim({ x: 0, y: -1, z: 0 })).toBeNull();
  });

  it('inverter e apontar trocam o eixo; reiniciar volta ao inicial', () => {
    const g = new GravityController(all);
    expect(g.flip()?.current.axis).toBe('+y');
    const change = g.aim({ x: 0.2, y: 0.1, z: -0.9 });
    expect(change).toMatchObject({ cause: 'aim', previous: { axis: '+y' }, current: { axis: '-z' } });
    g.setLevel('pesada');
    expect(g.previewAim({ x: 1, y: 0, z: 0 })).toBe('+x');
    expect(g.reset()?.current).toEqual({ axis: '-y', level: 'normal' });
    expect(g.reset()).toBeNull();
  });
});
