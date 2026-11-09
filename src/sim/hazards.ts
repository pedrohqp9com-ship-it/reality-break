import type { HazardDef, Vec3Tuple } from '../levels/types';
import type { Vec3Like } from './axis';

/**
 * Feixes de energia: tocar um feixe ativo custa uma vida. São regras de jogo
 * (não corpos físicos): não empurram nada e objetos passam por eles. A posição e
 * o estado (aceso/apagado) dependem só do tempo de jogo, então são previsíveis —
 * dá para observar o ritmo e passar na hora certa.
 */

/** Centro do feixe no instante `time` (s). */
export function hazardCenter(def: HazardDef, time: number): Vec3Tuple {
  const motion = def.motion;
  if (!motion) return def.center;
  const angle = (2 * Math.PI * time) / motion.period + (motion.phase ?? 0) * 2 * Math.PI;
  const offset = motion.amplitude * Math.sin(angle);
  const center: [number, number, number] = [def.center[0], def.center[1], def.center[2]];
  center[motion.axis] += offset;
  return center;
}

function blinkCycle(def: HazardDef, time: number): number {
  const blink = def.blink!;
  const t = time / blink.period + (blink.phase ?? 0);
  return t - Math.floor(t);
}

/** Feixes piscantes ficam acesos uma fração de cada ciclo; os demais, sempre. */
export function hazardActive(def: HazardDef, time: number): boolean {
  if (!def.blink) return true;
  return blinkCycle(def, time) < def.blink.on;
}

/** Aviso visual: o feixe vai acender em menos de `lead` segundos. */
export function hazardWarning(def: HazardDef, time: number, lead = 0.45): boolean {
  if (!def.blink || hazardActive(def, time)) return false;
  const remaining = (1 - blinkCycle(def, time)) * def.blink.period;
  return remaining <= lead;
}

/** Esfera (centro, raio) tocando uma caixa alinhada aos eixos. */
export function sphereTouchesBox(p: Vec3Like, radius: number, center: Vec3Tuple, size: Vec3Tuple): boolean {
  const px = [p.x, p.y, p.z];
  let d2 = 0;
  for (let i = 0; i < 3; i++) {
    const lo = center[i]! - size[i]! / 2;
    const hi = center[i]! + size[i]! / 2;
    const v = px[i]!;
    const d = v < lo ? lo - v : v > hi ? v - hi : 0;
    d2 += d * d;
  }
  return d2 < radius * radius;
}

/** A esfera está sendo atingida pelo feixe neste instante? */
export function hazardHits(def: HazardDef, time: number, p: Vec3Like, radius: number): boolean {
  return hazardActive(def, time) && sphereTouchesBox(p, radius, hazardCenter(def, time), def.size);
}
