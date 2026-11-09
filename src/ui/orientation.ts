/**
 * O jogo é feito para a tela deitada (paisagem). Em aparelhos de toque em pé,
 * mostramos um aviso para girar e pausamos o jogo. No PC (mouse), uma janela
 * estreita continua funcionando normalmente.
 */
export function isPortraitBlocked(width: number, height: number, touchDevice: boolean): boolean {
  return touchDevice && height > width;
}

/** Aparelho de toque: ponteiro "grosso" (dedo) ou tela com toque e sem mouse. */
export function detectTouchDevice(win: Pick<Window, 'matchMedia' | 'navigator'> = window): boolean {
  const coarse = win.matchMedia?.('(pointer: coarse)').matches ?? false;
  const fine = win.matchMedia?.('(pointer: fine)').matches ?? false;
  const touchPoints = win.navigator?.maxTouchPoints ?? 0;
  return coarse || (touchPoints > 0 && !fine);
}

/** Observa a orientação e avisa quando o bloqueio muda. */
export class OrientationGuard {
  blocked: boolean;
  private readonly onResize = () => this.check();

  constructor(
    private readonly touchDevice: () => boolean,
    private readonly onChange: (blocked: boolean) => void,
  ) {
    this.blocked = this.compute();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    screen.orientation?.addEventListener?.('change', this.onResize);
  }

  private compute(): boolean {
    return isPortraitBlocked(window.innerWidth, window.innerHeight, this.touchDevice());
  }

  check(): void {
    const blocked = this.compute();
    if (blocked === this.blocked) return;
    this.blocked = blocked;
    this.onChange(blocked);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    screen.orientation?.removeEventListener?.('change', this.onResize);
  }
}
