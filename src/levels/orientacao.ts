import { block, centerOf, sizeOf, zone } from './builders';
import type { LevelDef, Vec3Tuple } from './types';

const GATE_MIN: Vec3Tuple = [-8, 10, -8];
const GATE_MAX: Vec3Tuple = [8, 11, 8];

/** Altura da barreira horizontal que divide o salão no Desafio 3. */
export const ORIENTACAO_BARRIER_Y = 10;

/**
 * Desafio 3 — ORIENTAÇÃO. Apresenta o poder de apontar a gravidade para qualquer
 * um dos seis eixos (chão, teto e quatro paredes).
 * Uma barreira horizontal a 10 m divide o salão. O portal fica numa sacada a
 * 14 m, na parede norte. A placa que abre a barreira está embutida na parede
 * norte, rente ao chão: ela só sente força quando a gravidade aponta para essa
 * parede. Com o Cubo Denso sobre ela em gravidade Pesada (1962 N > 1500 N), a
 * barreira abre; aí dá para subir andando pela parede e pousar na sacada.
 */
export const orientacao: LevelDef = {
  id: 'orientacao',
  number: 3,
  title: 'Orientação',
  tagline: 'Qualquer parede pode ser o chão.',
  objective: 'Abra a barreira pela placa da parede norte e pouse na sacada do portal.',
  newPower: 'aim',
  briefing: [
    'Novo poder: APONTAR a gravidade. Olhe para uma superfície e ela vira o seu chão.',
    'Funciona com as quatro paredes, o chão e o teto — você e os objetos caem para lá.',
    'Inverter e a intensidade continuam disponíveis. Combine os três.',
  ],
  powers: ['intensity', 'flip', 'aim'],
  spawn: [0, 0.55, 3.5],
  yaw: 0,
  bounds: zone([-20, -10, -20], [20, 35, 20]),
  statics: [
    block([-9, -1, -9], [9, 0, 9], 'floor'),
    block([-9, 24, -9], [9, 25, 9], 'floor'),
    block([-9, 0, -8], [-8, 24, 8], 'wall'),
    block([8, 0, -8], [9, 24, 8], 'wall'),
    block([-9, 0, 8], [9, 24, 9], 'wall'),
    block([-8, 0, -9], [8, 24, -8], 'wall'),
    // Sacada do portal
    block([-2.5, 13.4, -8], [2.5, 14, -5], 'floor'),
    block([-2.5, 13.2, -5.2], [2.5, 13.4, -5], 'accent'),
  ],
  objects: [
    {
      id: 'cubo-denso',
      kind: 'denso',
      center: [-5, 0.5, -6.6],
      edge: 1,
      mass: 100,
      home: zone([-8, 0, -8], [8, 10, 8]),
    },
    { id: 'caixa-1', kind: 'caixa', center: [3.2, 0.3, 3], edge: 0.6, mass: 8 },
    { id: 'caixa-2', kind: 'caixa', center: [6.5, 0.3, -1], edge: 0.6, mass: 8 },
    { id: 'caixa-3', kind: 'caixa', center: [5.5, 0.3, 5.5], edge: 0.6, mass: 8 },
  ],
  plates: [
    {
      id: 'placa-norte',
      // Na parede norte, rente ao chão.
      center: [0, 1.2, -8],
      size: [2.4, 2.4, 0.04],
      normal: '+z',
      threshold: 1500,
      gate: 'barreira',
    },
  ],
  gates: [{ id: 'barreira', center: centerOf(GATE_MIN, GATE_MAX), size: sizeOf(GATE_MIN, GATE_MAX) }],
  portal: { center: [0, 15.3, -6.3], normal: '+z', radius: 1.1 },
  checkpoints: [],
  hints: [
    {
      zone: zone([-8, 0, -6], [8, 10, 8]),
      text: 'A placa está na parede norte. Olhe para essa parede e use [APONTAR]: ela vira o seu chão.',
    },
    {
      zone: zone([-8, 0, -8], [8, 10, -6]),
      text: 'Placa na parede só sente força com a gravidade apontada para ela. Leve o Cubo Denso e use [PESADA].',
    },
    {
      zone: zone([-8, 11, -8], [8, 24, 8]),
      text: 'Para pousar na sacada, olhe para ela (o chão original) e use [APONTAR] de novo.',
    },
  ],
  accent: 0xffb347,
};
