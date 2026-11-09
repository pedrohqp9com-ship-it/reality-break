import type { GravityLevel, Power } from '../sim/gravity';

/** Ações discretas do jogo (um toque/tecla = uma ação). */
export type GameAction =
  | 'jump'
  | 'leve'
  | 'normal'
  | 'pesada'
  | 'flip'
  | 'aim'
  | 'restart'
  | 'pause'
  /** Liga/desliga a corrida (botão de toque; no teclado, Shift é segurado). */
  | 'sprint';

export const KEY_ACTIONS: Readonly<Record<string, GameAction>> = {
  Space: 'jump',
  Digit1: 'leve',
  Numpad1: 'leve',
  Digit2: 'normal',
  Numpad2: 'normal',
  Digit3: 'pesada',
  Numpad3: 'pesada',
  KeyF: 'flip',
  KeyG: 'aim',
  KeyR: 'restart',
  Escape: 'pause',
  KeyP: 'pause',
};

const MOVE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function isMoveKey(code: string): boolean {
  return code in MOVE_KEYS;
}

/** Teclas que fazem correr enquanto estão pressionadas. */
export const SPRINT_KEYS: ReadonlySet<string> = new Set(['ShiftLeft', 'ShiftRight']);

/** Vetor de movimento a partir das teclas pressionadas (diagonal normalizada). */
export function moveFromKeys(pressed: ReadonlySet<string>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const code of pressed) {
    const dir = MOVE_KEYS[code];
    if (dir) {
      x += dir[0];
      y += dir[1];
    }
  }
  x = Math.max(-1, Math.min(1, x));
  y = Math.max(-1, Math.min(1, y));
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

export const INTENSITY_ACTIONS: Readonly<Record<GravityLevel, GameAction>> = {
  leve: 'leve',
  normal: 'normal',
  pesada: 'pesada',
};

/** Poder necessário para cada ação (as demais estão sempre disponíveis). */
export function powerForAction(action: GameAction): Power | null {
  switch (action) {
    case 'leve':
    case 'normal':
    case 'pesada':
      return 'intensity';
    case 'flip':
      return 'flip';
    case 'aim':
      return 'aim';
    default:
      return null;
  }
}

export type InputMode = 'keyboard' | 'touch';

const TOKEN_LABELS: Readonly<Record<InputMode, Readonly<Record<string, string>>>> = {
  keyboard: {
    LEVE: 'tecla 1 (Leve)',
    NORMAL: 'tecla 2 (Normal)',
    PESADA: 'tecla 3 (Pesada)',
    INVERTER: 'F (Inverter)',
    APONTAR: 'G ou clique (Apontar)',
    PULAR: 'Espaço',
    CORRER: 'Shift (Correr)',
  },
  touch: {
    LEVE: 'o botão LEVE',
    NORMAL: 'o botão NORMAL',
    PESADA: 'o botão PESADA',
    INVERTER: 'o botão INVERTER',
    APONTAR: 'o botão APONTAR',
    PULAR: 'o botão PULAR',
    CORRER: 'o botão CORRER',
  },
};

/** Troca os marcadores das dicas ([LEVE], [PULAR]…) pelo controle em uso. */
export function formatControlText(text: string, mode: InputMode): string {
  return text.replace(/\[([A-Z]+)\]/g, (match, token: string) => TOKEN_LABELS[mode][token] ?? match);
}
