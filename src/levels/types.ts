import type { Axis } from '../sim/axis';
import type { Power } from '../sim/gravity';

export type Vec3Tuple = readonly [number, number, number];

export interface Aabb {
  readonly min: Vec3Tuple;
  readonly max: Vec3Tuple;
}

/** Estilo visual de um bloco fixo (não altera a física). */
export type SurfaceStyle = 'floor' | 'wall' | 'accent';

export interface StaticBoxDef {
  readonly center: Vec3Tuple;
  readonly size: Vec3Tuple;
  readonly style: SurfaceStyle;
}

export type ObjectKind = 'denso' | 'caixa';

export interface DynamicBoxDef {
  readonly id: string;
  readonly kind: ObjectKind;
  readonly center: Vec3Tuple;
  /** Aresta do cubo (m). */
  readonly edge: number;
  /** Massa (kg). */
  readonly mass: number;
  /**
   * Região onde o objeto pode estar. Se sair dela (caiu no vazio ou ficou fora de
   * alcance), volta ao ponto inicial — assim o desafio nunca fica impossível.
   */
  readonly home?: Aabb;
}

/**
 * Placa de pressão: uma área marcada em um piso ou parede. Mede a força real que
 * os corpos fazem contra a superfície ali (lida dos contatos da física).
 */
export interface PlateDef {
  readonly id: string;
  /** Centro da placa, sobre a superfície. */
  readonly center: Vec3Tuple;
  /** Dimensões da área; a espessura (no eixo da normal) é só visual. */
  readonly size: Vec3Tuple;
  /** Direção para onde a face sensível aponta (para fora da superfície). */
  readonly normal: Axis;
  /** Força mínima (N) para ativar. */
  readonly threshold: number;
  /** Barreira controlada pela placa. */
  readonly gate: string;
}

/** Barreira de energia: sólida enquanto fechada; aberta, deixa tudo passar. */
export interface GateDef {
  readonly id: string;
  readonly center: Vec3Tuple;
  readonly size: Vec3Tuple;
}

export interface PortalDef {
  readonly center: Vec3Tuple;
  /** Direção para onde o anel está virado. */
  readonly normal: Axis;
  /** Raio de ativação (m), medido do centro do portal ao centro da sonda. */
  readonly radius: number;
}

export interface CheckpointDef {
  readonly id: string;
  readonly zone: Aabb;
  readonly spawn: Vec3Tuple;
  readonly yaw: number;
}

/**
 * Dica que aparece enquanto a sonda está dentro da zona. Os marcadores entre
 * colchetes (ex.: [LEVE]) viram a tecla ou o botão do controle em uso.
 */
export interface HintDef {
  readonly zone: Aabb;
  readonly text: string;
}

export type LevelId = 'leveza' | 'inversao' | 'orientacao';

export interface LevelDef {
  readonly id: LevelId;
  readonly number: number;
  readonly title: string;
  readonly tagline: string;
  readonly objective: string;
  /** Poder apresentado neste desafio e como ele funciona. */
  readonly newPower: Power;
  readonly briefing: readonly string[];
  readonly powers: readonly Power[];
  readonly spawn: Vec3Tuple;
  readonly yaw: number;
  /** Fora desta caixa, a sonda está no vazio e volta ao último ponto seguro. */
  readonly bounds: Aabb;
  readonly statics: readonly StaticBoxDef[];
  readonly objects: readonly DynamicBoxDef[];
  readonly plates: readonly PlateDef[];
  readonly gates: readonly GateDef[];
  readonly portal: PortalDef;
  readonly checkpoints: readonly CheckpointDef[];
  readonly hints: readonly HintDef[];
  /** Cor de destaque do desafio (hex). */
  readonly accent: number;
}
