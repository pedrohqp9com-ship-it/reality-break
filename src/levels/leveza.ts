import { block, centerOf, sizeOf, zone } from './builders';
import type { LevelDef, Vec3Tuple } from './types';

const GATE_MIN: Vec3Tuple = [-6, 3.2, -29];
const GATE_MAX: Vec3Tuple = [6, 12, -28];

/** Topo da plataforma elevada: alto demais para um salto em gravidade normal. */
export const LEVEZA_LEDGE_HEIGHT = 3.2;

/**
 * Desafio 1 — LEVEZA. Apresenta a intensidade da gravidade.
 * 1) A plataforma tem 3,2 m: com gravidade normal o salto chega a ~1,8 m; com a
 *    gravidade Leve (0,35 g), a ~5,2 m.
 * 2) A barreira só abre com 1500 N na placa. O Cubo Denso (100 kg) faz 981 N em
 *    gravidade normal e 1962 N na Pesada (2 g). A sonda sozinha (70 kg) não basta.
 */
export const leveza: LevelDef = {
  id: 'leveza',
  number: 1,
  title: 'Leveza',
  tagline: 'Peso não é uma constante.',
  objective: 'Suba na plataforma, abra a barreira e entre no portal.',
  newPower: 'intensity',
  briefing: [
    'Você controla a intensidade da gravidade deste lugar.',
    'LEVE (0,35 g): saltos quase três vezes mais altos, objetos fáceis de empurrar.',
    'PESADA (2 g): tudo pesa o dobro — inclusive sobre as placas de pressão.',
  ],
  powers: ['intensity'],
  spawn: [0, 0.55, 0],
  yaw: 0,
  bounds: zone([-20, -20, -50], [20, 40, 20]),
  statics: [
    block([-6, -1, -12], [6, 0, 6], 'floor'),
    block([-6, -1, -38], [6, 2.2, -12], 'wall'),
    block([-6, 2.2, -38], [6, 3.2, -12], 'floor'),
    block([-7, -1, -39], [-6, 12, 7], 'wall'),
    block([6, -1, -39], [7, 12, 7], 'wall'),
    block([-6, -1, 6], [6, 12, 7], 'wall'),
    block([-6, -1, -39], [6, 12, -38], 'wall'),
    // Marcos visuais nas laterais da plataforma.
    block([-6, 3.2, -12.6], [-5.4, 3.5, -12], 'accent'),
    block([5.4, 3.2, -12.6], [6, 3.5, -12], 'accent'),
  ],
  objects: [
    {
      id: 'cubo-denso',
      kind: 'denso',
      center: [2, 3.7, -16],
      edge: 1,
      mass: 100,
      home: zone([-6, 2.5, -38], [6, 14, -12]),
    },
    { id: 'caixa-1', kind: 'caixa', center: [-3, 0.3, -4], edge: 0.6, mass: 8 },
    { id: 'caixa-2', kind: 'caixa', center: [-2.2, 0.3, -6.5], edge: 0.6, mass: 8 },
    { id: 'caixa-3', kind: 'caixa', center: [3.2, 0.3, -7], edge: 0.6, mass: 8 },
  ],
  plates: [
    {
      id: 'placa',
      center: [2, 3.2, -22],
      size: [2.4, 0.04, 2.4],
      normal: '+y',
      threshold: 1500,
      gate: 'barreira',
    },
  ],
  gates: [{ id: 'barreira', center: centerOf(GATE_MIN, GATE_MAX), size: sizeOf(GATE_MIN, GATE_MAX) }],
  portal: { center: [0, 4.6, -34], normal: '+z', radius: 1.2 },
  checkpoints: [
    {
      id: 'plataforma',
      zone: zone([-6, 3, -28], [6, 12, -12]),
      spawn: [0, 3.75, -13.5],
      yaw: 0,
    },
  ],
  lives: 3,
  // Entre a placa e a barreira, um feixe varre o corredor. Com a gravidade Pesada
  // (necessária para manter a barreira aberta) o salto não passa por cima: é
  // preciso esperar a hora certa.
  hazards: [
    {
      id: 'feixe-plataforma',
      center: [0, 4.7, -25.5],
      size: [1.2, 3, 0.4],
      motion: { axis: 0, amplitude: 4.4, period: 5 },
    },
  ],
  objectives: [
    {
      id: 'subir',
      text: 'Suba na plataforma de 3,2 m',
      kind: 'zone',
      zone: zone([-6, 3, -38], [6, 14, -12]),
    },
    { id: 'barreira', text: 'Abra a barreira com a placa', kind: 'gate', gate: 'barreira' },
    { id: 'portal', text: 'Entre no portal', kind: 'portal' },
  ],
  hints: [
    {
      zone: zone([-6, -1, -12], [6, 12, 6]),
      text: 'A plataforma tem 3,2 m; um salto normal chega a ~1,8 m. Ative [LEVE] e pule com [PULAR].',
    },
    {
      zone: zone([-6, 3, -20], [6, 14, -12]),
      text: 'A placa mede a força sobre ela (em newtons). Empurre o Cubo Denso até a placa.',
    },
    {
      zone: zone([-6, 3, -24.5], [6, 14, -20]),
      text: 'Peso = massa × gravidade. Com [PESADA], o mesmo cubo pesa o dobro.',
    },
    {
      zone: zone([-6, 3, -28], [6, 14, -24.5]),
      text: 'O feixe vai e volta: espere ele passar e atravesse. Use [CORRER] para ser mais rápido.',
    },
  ],
  accent: 0x38f2ff,
};
