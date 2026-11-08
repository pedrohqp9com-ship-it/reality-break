import { describe, expect, it } from 'vitest';
import { formatControlText, KEY_ACTIONS, moveFromKeys, powerForAction } from './actions';

describe('teclado', () => {
  it('WASD e setas viram um vetor de movimento', () => {
    expect(moveFromKeys(new Set(['KeyW']))).toEqual({ x: 0, y: 1 });
    expect(moveFromKeys(new Set(['ArrowLeft']))).toEqual({ x: -1, y: 0 });
    expect(moveFromKeys(new Set(['KeyW', 'KeyS']))).toEqual({ x: 0, y: 0 });
  });

  it('diagonal não anda mais rápido', () => {
    const v = moveFromKeys(new Set(['KeyW', 'KeyD']));
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });

  it('mapeamento de teclas de ação', () => {
    expect(KEY_ACTIONS.Space).toBe('jump');
    expect(KEY_ACTIONS.Digit1).toBe('leve');
    expect(KEY_ACTIONS.Digit3).toBe('pesada');
    expect(KEY_ACTIONS.KeyF).toBe('flip');
    expect(KEY_ACTIONS.KeyG).toBe('aim');
    expect(KEY_ACTIONS.Escape).toBe('pause');
  });

  it('cada poder tem a sua ação; pular e pausar não dependem de poder', () => {
    expect(powerForAction('leve')).toBe('intensity');
    expect(powerForAction('flip')).toBe('flip');
    expect(powerForAction('aim')).toBe('aim');
    expect(powerForAction('jump')).toBeNull();
    expect(powerForAction('pause')).toBeNull();
  });
});

describe('textos de dica', () => {
  it('troca marcadores pelo controle em uso', () => {
    const text = 'Ative [LEVE] e pule com [PULAR].';
    expect(formatControlText(text, 'keyboard')).toBe('Ative tecla 1 (Leve) e pule com Espaço.');
    expect(formatControlText(text, 'touch')).toBe('Ative o botão LEVE e pule com o botão PULAR.');
  });

  it('mantém marcadores desconhecidos', () => {
    expect(formatControlText('[XYZ]', 'touch')).toBe('[XYZ]');
  });
});
