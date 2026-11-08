import type { Aabb, StaticBoxDef, SurfaceStyle, Vec3Tuple } from './types';

/** Bloco fixo a partir dos cantos mínimo e máximo (mais fácil de desenhar a fase). */
export function block(min: Vec3Tuple, max: Vec3Tuple, style: SurfaceStyle): StaticBoxDef {
  const size: Vec3Tuple = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (size.some((s) => s <= 0)) {
    throw new Error(`Bloco inválido: min ${min.join(',')} max ${max.join(',')}`);
  }
  return {
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    size,
    style,
  };
}

export function zone(min: Vec3Tuple, max: Vec3Tuple): Aabb {
  return { min, max };
}

export function centerOf(min: Vec3Tuple, max: Vec3Tuple): Vec3Tuple {
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

export function sizeOf(min: Vec3Tuple, max: Vec3Tuple): Vec3Tuple {
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
}
