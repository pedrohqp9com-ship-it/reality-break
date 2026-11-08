/** Qualidade gráfica escolhida pela pessoa. */
export type QualitySetting = 'auto' | 'baixa' | 'alta';

export interface QualityProfile {
  /** Densidade de pixels máxima (resolução). */
  readonly maxPixelRatio: number;
  /** Partículas que mostram a direção da gravidade. */
  readonly particles: number;
  /** Se a resolução se ajusta sozinha quando o aparelho não acompanha. */
  readonly adaptive: boolean;
}

export function qualityProfile(setting: QualitySetting, devicePixelRatio: number, touch: boolean): QualityProfile {
  const dpr = Math.max(1, devicePixelRatio || 1);
  switch (setting) {
    case 'baixa':
      return { maxPixelRatio: Math.min(dpr, 1), particles: 120, adaptive: false };
    case 'alta':
      return { maxPixelRatio: Math.min(dpr, 2), particles: 420, adaptive: false };
    case 'auto':
    default:
      return { maxPixelRatio: Math.min(dpr, touch ? 1.5 : 2), particles: touch ? 200 : 360, adaptive: true };
  }
}

/**
 * Resolução adaptativa: se o tempo médio de quadro passa de ~22 ms (abaixo de
 * 45 FPS), reduz a escala em 10%; se fica abaixo de ~17,5 ms, aumenta 5%.
 * A escala multiplica a densidade de pixels e fica entre `min` e 1.
 */
export function nextResolutionScale(current: number, averageFrameMs: number, min = 0.55): number {
  if (!Number.isFinite(averageFrameMs) || averageFrameMs <= 0) return current;
  if (averageFrameMs > 22) return Math.max(min, +(current * 0.9).toFixed(3));
  if (averageFrameMs < 17.5) return Math.min(1, +(current * 1.05).toFixed(3));
  return current;
}

/** Mede o tempo médio de quadro em janelas de tempo fixas. */
export class FrameTimer {
  private total = 0;
  private frames = 0;

  constructor(private readonly windowSeconds = 1.5) {}

  /** Registra um quadro; devolve a média (ms) quando a janela fecha. */
  add(frameSeconds: number): number | null {
    if (!Number.isFinite(frameSeconds) || frameSeconds <= 0 || frameSeconds > 0.5) return null;
    this.total += frameSeconds;
    this.frames++;
    if (this.total < this.windowSeconds) return null;
    const average = (this.total / this.frames) * 1000;
    this.total = 0;
    this.frames = 0;
    return average;
  }
}
