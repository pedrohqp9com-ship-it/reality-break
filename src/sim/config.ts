/**
 * Constantes da simulação. Todas as unidades estão no SI: metros, segundos,
 * quilogramas e newtons. Os desafios foram desenhados a partir destes números,
 * e os testes conferem que eles continuam coerentes entre si.
 */

/** Passo fixo da física (60 Hz). A renderização interpola entre passos. */
export const FIXED_DT = 1 / 60;
/** Limite de passos por quadro, para o jogo não "travar" depois de uma pausa longa. */
export const MAX_STEPS_PER_FRAME = 5;

export const PLAYER = {
  radius: 0.5,
  /** Massa do jogador (kg). Entra no cálculo da força sobre as placas. */
  mass: 70,
  /** Velocidade máxima andando (m/s). */
  moveSpeed: 6,
  /** Velocidade vertical aplicada no salto (m/s). Altura = v² / (2g). */
  jumpSpeed: 6,
  /** Quão rápido a velocidade alcança a desejada no chão / no ar (1/s). */
  groundResponse: 14,
  airResponse: 4,
  /** Aceleração máxima de controle no chão / no ar (m/s²). */
  groundAccel: 50,
  airAccel: 14,
  /** Tolerâncias de controle que deixam o pulo mais justo para quem joga. */
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  /** Contato conta como "chão" se a normal estiver a menos de ~56° do "para cima". */
  groundNormalMin: 0.55,
} as const;

/**
 * Velocidade terminal (m/s). No mundo real, o arrasto do ar limita a velocidade de
 * queda; aqui o limite também evita que objetos atravessem paredes de 1 m em um
 * único passo da física (30 m/s × 1/60 s = 0,5 m).
 */
export const TERMINAL_SPEED = 30;

export const MATERIALS = {
  /** Atrito entre objetos e o cenário. O jogador não usa atrito: ele se move por propulsão. */
  objectFriction: 0.4,
  objectRestitution: 0.05,
} as const;

/** Grupos de colisão (bits). */
export const GROUP = {
  STATIC: 1,
  OBJECT: 2,
  PLAYER: 4,
  ALL: -1,
} as const;

/**
 * Placas de pressão: suavização da leitura (s), histerese para não piscar e tempo
 * que a força precisa ficar acima do limite. Um impacto rápido (uma queda) gera
 * um pico de força real, mas curto; a placa só ativa com força sustentada.
 */
export const PLATE = {
  smoothing: 0.08,
  releaseRatio: 0.95,
  holdTime: 0.5,
} as const;

/**
 * Relaxação dos contatos da sonda (cannon-es usa 3 por padrão). Um valor maior
 * amortece a correção de penetração e reduz o quique em quedas rápidas.
 */
export const PLAYER_CONTACT_RELAXATION = 6;
