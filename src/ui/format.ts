import type { Axis } from '../sim/axis';
import { GRAVITY_MULTIPLIER, type GravityLevel, type GravityState, type Power } from '../sim/gravity';

/** Nome da superfície para onde a gravidade puxa (como as fases são orientadas). */
export const AXIS_NAMES: Readonly<Record<Axis, string>> = {
  '-y': 'Chão',
  '+y': 'Teto',
  '-z': 'Parede norte',
  '+z': 'Parede sul',
  '-x': 'Parede oeste',
  '+x': 'Parede leste',
};

export const LEVEL_NAMES: Readonly<Record<GravityLevel, string>> = {
  leve: 'Leve',
  normal: 'Normal',
  pesada: 'Pesada',
};

export const POWER_NAMES: Readonly<Record<Power, string>> = {
  intensity: 'Intensidade',
  flip: 'Inverter',
  aim: 'Apontar',
};

/** Tempo no formato m:ss.d (ex.: 1:05.3). */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalTenths = Math.floor(safe * 10);
  const minutes = Math.floor(totalTenths / 600);
  const rest = (totalTenths % 600) / 10;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** Força em newtons com separador de milhar brasileiro (ex.: 1.962 N). */
export function formatNewtons(value: number): string {
  return `${Math.round(Math.max(0, value)).toLocaleString('pt-BR')} N`;
}

export function formatGravity(state: GravityState): string {
  const g = GRAVITY_MULTIPLIER[state.level];
  return `${LEVEL_NAMES[state.level]} · ${g.toLocaleString('pt-BR')} g`;
}

/** Mensagem curta quando a gravidade muda. */
export function gravityToast(previous: GravityState, current: GravityState): string {
  if (previous.axis !== current.axis) return `Gravidade → ${AXIS_NAMES[current.axis]}`;
  return `Gravidade ${LEVEL_NAMES[current.level]}`;
}

export interface GravityArrow {
  /** Rotação (graus, sentido horário) de uma seta que aponta para baixo na tela. */
  readonly rotation: number;
  /** Quando a gravidade aponta quase toda para dentro ou para fora da tela. */
  readonly depth: 'none' | 'forward' | 'back';
}

/**
 * Seta da bússola de gravidade, a partir da gravidade no espaço da câmera
 * (x = direita, y = cima, z = para trás da câmera).
 */
export function gravityArrow(x: number, y: number, z: number): GravityArrow {
  const length = Math.hypot(x, y, z) || 1;
  const nz = z / length;
  const depth = nz < -0.85 ? 'forward' : nz > 0.85 ? 'back' : 'none';
  const rotation = (Math.atan2(-x, -y) * 180) / Math.PI;
  return { rotation: Math.round(rotation * 10) / 10 + 0, depth };
}
