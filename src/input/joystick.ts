/** Matemática do direcional virtual (sem DOM, testável). */

export interface JoystickVector {
  /** -1 (esquerda) a 1 (direita). */
  readonly x: number;
  /** -1 (trás) a 1 (frente). Arrastar para cima na tela = frente. */
  readonly y: number;
}

export const JOYSTICK_DEAD_ZONE = 0.12;

export function joystickVector(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  radius: number,
): JoystickVector {
  if (radius <= 0) return { x: 0, y: 0 };
  const dx = (currentX - originX) / radius;
  const dy = (originY - currentY) / radius;
  const length = Math.hypot(dx, dy);
  if (length < JOYSTICK_DEAD_ZONE) return { x: 0, y: 0 };
  // Reescala depois da zona morta para o movimento começar suave.
  const clamped = Math.min(1, length);
  const scaled = (clamped - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE);
  return { x: (dx / length) * scaled, y: (dy / length) * scaled };
}

/** Posição do "pino" do direcional, limitada ao raio da base. */
export function knobOffset(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  radius: number,
): { x: number; y: number } {
  const dx = currentX - originX;
  const dy = currentY - originY;
  const length = Math.hypot(dx, dy);
  if (length <= radius || length === 0) return { x: dx, y: dy };
  return { x: (dx / length) * radius, y: (dy / length) * radius };
}
