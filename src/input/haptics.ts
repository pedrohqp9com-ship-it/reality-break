/**
 * Vibração curta no Android como resposta física às ações (pulo, pouso forte,
 * troca de gravidade, barreira, perda de vida). Navegadores sem a API (iPhone,
 * PC) simplesmente não vibram, e o ajuste nem aparece.
 */
export class Haptics {
  enabled = true;

  constructor(private readonly nav: Pick<Navigator, 'vibrate'> | null = typeof navigator === 'undefined' ? null : navigator) {}

  get supported(): boolean {
    return typeof this.nav?.vibrate === 'function';
  }

  pulse(pattern: number | number[]): boolean {
    if (!this.enabled || !this.supported) return false;
    try {
      return this.nav!.vibrate(pattern);
    } catch {
      return false;
    }
  }
}

/** Padrões (ms) usados no jogo. */
export const HAPTIC = {
  jump: 8,
  land: 18,
  gravity: 14,
  gate: 30,
  hurt: [70, 40, 90],
  complete: [30, 50, 30, 50, 60],
} as const;
