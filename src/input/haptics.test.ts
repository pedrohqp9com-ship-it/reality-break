import { describe, expect, it, vi } from 'vitest';
import { Haptics } from './haptics';

describe('vibração', () => {
  it('vibra quando o aparelho permite e o ajuste está ligado', () => {
    const vibrate = vi.fn(() => true);
    const haptics = new Haptics({ vibrate });
    expect(haptics.supported).toBe(true);
    expect(haptics.pulse(20)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(20);
    haptics.enabled = false;
    expect(haptics.pulse(20)).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('sem a API (iPhone, PC), não faz nada', () => {
    const haptics = new Haptics({} as Navigator);
    expect(haptics.supported).toBe(false);
    expect(haptics.pulse(20)).toBe(false);
    expect(new Haptics(null).pulse(5)).toBe(false);
  });

  it('erros do navegador não quebram o jogo', () => {
    const haptics = new Haptics({
      vibrate: () => {
        throw new Error('bloqueado');
      },
    });
    expect(haptics.pulse(10)).toBe(false);
  });
});
