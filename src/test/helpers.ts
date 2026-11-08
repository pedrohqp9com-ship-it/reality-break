import { Vector3 } from 'three';
import type { Vec3Like } from '../sim/axis';
import type { SimInput, Simulation } from '../sim/simulation';

export const IDLE: SimInput = { move: { x: 0, y: 0 }, jump: false };

export function run(sim: Simulation, seconds: number, input: SimInput = IDLE): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) sim.step(input);
}

/** Roda até a condição ser verdadeira (ou o tempo acabar). Devolve se conseguiu. */
export function runUntil(
  sim: Simulation,
  maxSeconds: number,
  input: SimInput | ((sim: Simulation) => SimInput),
  done: (sim: Simulation) => boolean,
): boolean {
  const steps = Math.round(maxSeconds * 60);
  for (let i = 0; i < steps; i++) {
    if (done(sim)) return true;
    sim.step(typeof input === 'function' ? input(sim) : input);
  }
  return done(sim);
}

const forward = new Vector3();
const right = new Vector3();

/**
 * Converte uma direção desejada no mundo em comando de movimento (como um
 * joystick faria), usando o referencial atual da gravidade e da câmera.
 */
export function steerTowards(sim: Simulation, target: Vec3Like, jump = false, gain = 1.5): SimInput {
  const p = sim.player.position;
  sim.frame.moveBasis(sim.view.yaw, forward, right);
  const d = new Vector3(target.x - p.x, target.y - p.y, target.z - p.z);
  const up = sim.up();
  d.addScaledVector(up, -d.dot(up));
  const x = Math.max(-1, Math.min(1, d.dot(right) * gain));
  const y = Math.max(-1, Math.min(1, d.dot(forward) * gain));
  return { move: { x, y }, jump };
}

export function distanceAlongPlane(sim: Simulation, target: Vec3Like): number {
  const p = sim.player.position;
  const d = new Vector3(target.x - p.x, target.y - p.y, target.z - p.z);
  const up = sim.up();
  d.addScaledVector(up, -d.dot(up));
  return d.length();
}

/** Altura máxima (ao longo do "para cima") atingida durante um salto parado. */
export function measureJumpHeight(sim: Simulation): number {
  run(sim, 1.5);
  const up = sim.up();
  const start = new Vector3().copy(sim.player.position as unknown as Vector3);
  const startH = start.dot(up);
  let max = startH;
  sim.step({ move: { x: 0, y: 0 }, jump: true });
  for (let i = 0; i < 60 * 5; i++) {
    sim.step(IDLE);
    const p = sim.player.position;
    max = Math.max(max, p.x * up.x + p.y * up.y + p.z * up.z);
    if (sim.player.grounded && i > 10) break;
  }
  return max - startH;
}
