import { block, zone } from './builders';
import type { LevelDef } from './types';

/** Altura do teto e do topo da parede com a fresta, no Desafio 2. */
export const INVERSAO_CEILING = 9;
export const INVERSAO_WALL_TOP = 7.6;

/**
 * Desafio 2 — INVERSÃO. Apresenta a inversão da gravidade.
 * A única passagem para a segunda sala é uma fresta de 1,4 m junto ao teto
 * (parede de 7,6 m; teto a 9 m). Nem o salto Leve (~5,2 m) alcança: é preciso
 * "cair para cima" e andar no teto. Na segunda sala, chão e teto têm vãos
 * alternados, e o portal está preso ao teto, depois do vazio.
 */
export const inversao: LevelDef = {
  id: 'inversao',
  number: 2,
  title: 'Inversão',
  tagline: 'Para cima também é um chão.',
  objective: 'Atravesse a fresta junto ao teto e alcance o portal preso ao teto.',
  newPower: 'flip',
  briefing: [
    'Novo poder: INVERTER a gravidade. Tudo — você e os objetos — cai para o lado oposto.',
    'A câmera gira junto: o teto vira o seu chão.',
    'A intensidade (Leve, Normal, Pesada) continua disponível.',
  ],
  powers: ['intensity', 'flip'],
  spawn: [0, 0.55, 0],
  yaw: 0,
  bounds: zone([-20, -12, -60], [20, 20, 16]),
  statics: [
    // Sala A
    block([-6, -1, -16], [6, 0, 6], 'floor'),
    block([-6, 9, -16], [6, 10, 6], 'floor'),
    block([-6, -1, -17], [6, 7.2, -16], 'wall'),
    block([-6, 7.2, -17], [6, 7.6, -16], 'accent'),
    // Sala B: chão com vãos
    block([-6, -1, -23], [6, 0, -17], 'floor'),
    block([-6, -1, -39], [6, 0, -29], 'floor'),
    // Sala B: teto com um vão
    block([-6, 9, -31], [6, 10, -17], 'floor'),
    block([-6, 9, -52], [6, 10, -37], 'floor'),
    // Bordas dos vãos (destaque visual)
    block([-6, -0.2, -23.3], [6, 0, -23], 'accent'),
    block([-6, -0.2, -29], [6, 0, -28.7], 'accent'),
    block([-6, -0.2, -39.3], [6, 0, -39], 'accent'),
    block([-6, 9, -31.3], [6, 9.2, -31], 'accent'),
    block([-6, 9, -37], [6, 9.2, -36.7], 'accent'),
    // Paredes
    block([-7, -6, -53], [-6, 15, 7], 'wall'),
    block([6, -6, -53], [7, 15, 7], 'wall'),
    block([-6, -1, 6], [6, 10, 7], 'wall'),
    block([-6, -6, -53], [6, 15, -52], 'wall'),
  ],
  objects: [
    { id: 'caixa-1', kind: 'caixa', center: [-3, 0.3, -6], edge: 0.6, mass: 8 },
    { id: 'caixa-2', kind: 'caixa', center: [2.5, 0.3, -8], edge: 0.6, mass: 8 },
    { id: 'caixa-3', kind: 'caixa', center: [0, 0.3, -11], edge: 0.6, mass: 8 },
    {
      id: 'caixa-4',
      kind: 'caixa',
      center: [-2, 0.3, -33],
      edge: 0.6,
      mass: 8,
      home: zone([-6, -10, -52], [6, 9, -17]),
    },
    {
      id: 'caixa-5',
      kind: 'caixa',
      center: [3, 0.3, -35],
      edge: 0.6,
      mass: 8,
      home: zone([-6, -10, -52], [6, 9, -17]),
    },
  ],
  plates: [],
  gates: [],
  portal: { center: [0, 7.8, -46], normal: '-y', radius: 1.2 },
  checkpoints: [
    {
      id: 'sala-b',
      zone: zone([-6, -1, -23], [6, 9, -17]),
      spawn: [0, 0.55, -19],
      yaw: 0,
    },
  ],
  hints: [
    {
      zone: zone([-6, -1, -16], [6, 9, -7]),
      text: 'A passagem fica junto ao teto, alta demais até para o salto Leve. Use [INVERTER].',
    },
    {
      zone: zone([-6, -1, -29], [6, 9, -17]),
      text: 'No teto, os vãos do chão não importam — mas o teto também tem um vão mais à frente.',
    },
    {
      zone: zone([-6, -1, -52], [6, 9, -29]),
      text: 'O portal está preso ao teto. Inverta a gravidade onde houver teto acima de você.',
    },
  ],
  accent: 0xc77dff,
};
