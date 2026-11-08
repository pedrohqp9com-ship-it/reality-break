import { describe, expect, it } from 'vitest';
import { AXES } from '../sim/axis';
import { AXIS_NAMES, formatGravity, formatNewtons, formatTime, gravityArrow, gravityToast } from './format';

describe('formatação', () => {
  it('tempo m:ss.d', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(65.34)).toBe('1:05.3');
    expect(formatTime(9.99)).toBe('0:09.9');
    expect(formatTime(Number.NaN)).toBe('0:00.0');
  });

  it('força em newtons com separador brasileiro', () => {
    expect(formatNewtons(1962.3)).toBe('1.962 N');
    expect(formatNewtons(-5)).toBe('0 N');
  });

  it('gravidade e mensagens', () => {
    expect(formatGravity({ axis: '-y', level: 'leve' })).toBe('Leve · 0,35 g');
    expect(gravityToast({ axis: '-y', level: 'normal' }, { axis: '+y', level: 'normal' })).toBe('Gravidade → Teto');
    expect(gravityToast({ axis: '-y', level: 'normal' }, { axis: '-y', level: 'pesada' })).toBe('Gravidade Pesada');
    for (const axis of AXES) expect(AXIS_NAMES[axis]).toBeTruthy();
  });
});

describe('bússola de gravidade', () => {
  it('para baixo na tela = sem rotação', () => {
    expect(gravityArrow(0, -1, 0)).toEqual({ rotation: 0, depth: 'none' });
  });

  it('para a direita da tela = −90° (seta girada no sentido anti-horário)', () => {
    expect(gravityArrow(1, 0, 0).rotation).toBe(-90);
    expect(gravityArrow(-1, 0, 0).rotation).toBe(90);
    expect(Math.abs(gravityArrow(0, 1, 0).rotation)).toBe(180);
  });

  it('para dentro ou para fora da tela', () => {
    expect(gravityArrow(0, 0, -1).depth).toBe('forward');
    expect(gravityArrow(0, 0, 1).depth).toBe('back');
  });
});
