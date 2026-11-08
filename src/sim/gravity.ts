import { Vector3 } from 'three';
import { axisVector, nearestAxis, oppositeAxis, type Axis, type Vec3Like } from './axis';

/** Aceleração da gravidade na Terra (m/s²). */
export const EARTH_GRAVITY = 9.81;

export type GravityLevel = 'leve' | 'normal' | 'pesada';
export const GRAVITY_LEVELS: readonly GravityLevel[] = ['leve', 'normal', 'pesada'];

/** Multiplicador de cada intensidade em relação à gravidade da Terra. */
export const GRAVITY_MULTIPLIER: Record<GravityLevel, number> = {
  leve: 0.35,
  normal: 1,
  pesada: 2,
};

/**
 * Poderes de alteração da gravidade. Cada desafio libera um novo poder e mantém os
 * anteriores; um poder bloqueado não aparece na interface e não tem efeito.
 */
export type Power = 'intensity' | 'flip' | 'aim';
export const POWERS: readonly Power[] = ['intensity', 'flip', 'aim'];

export interface GravityState {
  readonly axis: Axis;
  readonly level: GravityLevel;
}

export const DEFAULT_GRAVITY: GravityState = { axis: '-y', level: 'normal' };

export type GravityCause = Power | 'reset';

export interface GravityChange {
  readonly previous: GravityState;
  readonly current: GravityState;
  readonly cause: GravityCause;
}

export function gravityMagnitude(level: GravityLevel): number {
  return EARTH_GRAVITY * GRAVITY_MULTIPLIER[level];
}

export function gravityVector(state: GravityState, target = new Vector3()): Vector3 {
  return axisVector(state.axis, target).multiplyScalar(gravityMagnitude(state.level));
}

/** Altura máxima de um salto com velocidade inicial v: h = v² / (2g). */
export function jumpHeight(jumpSpeed: number, level: GravityLevel): number {
  return (jumpSpeed * jumpSpeed) / (2 * gravityMagnitude(level));
}

/** Guarda o estado da gravidade e aplica só os poderes liberados no desafio atual. */
export class GravityController {
  private current: GravityState;

  constructor(
    private readonly powers: ReadonlySet<Power>,
    private readonly initial: GravityState = DEFAULT_GRAVITY,
  ) {
    this.current = initial;
  }

  get state(): GravityState {
    return this.current;
  }

  has(power: Power): boolean {
    return this.powers.has(power);
  }

  setLevel(level: GravityLevel): GravityChange | null {
    if (!this.has('intensity') || level === this.current.level) return null;
    return this.apply({ axis: this.current.axis, level }, 'intensity');
  }

  flip(): GravityChange | null {
    if (!this.has('flip')) return null;
    return this.apply({ axis: oppositeAxis(this.current.axis), level: this.current.level }, 'flip');
  }

  /** Eixo que "apontar" escolheria para esta direção de olhar. */
  previewAim(lookDirection: Vec3Like): Axis {
    return nearestAxis(lookDirection);
  }

  /** A gravidade passa a puxar para o eixo do mundo mais próximo de onde se olha. */
  aim(lookDirection: Vec3Like): GravityChange | null {
    if (!this.has('aim')) return null;
    const axis = nearestAxis(lookDirection);
    if (axis === this.current.axis) return null;
    return this.apply({ axis, level: this.current.level }, 'aim');
  }

  reset(): GravityChange | null {
    const { axis, level } = this.initial;
    if (axis === this.current.axis && level === this.current.level) return null;
    return this.apply(this.initial, 'reset');
  }

  private apply(next: GravityState, cause: GravityCause): GravityChange {
    const change = { previous: this.current, current: next, cause };
    this.current = next;
    return change;
  }
}
