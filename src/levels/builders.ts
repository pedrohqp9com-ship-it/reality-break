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

/**
 * Laje com um furo retangular (onde entra uma placa de pressão, rente à superfície).
 * `axis` é o eixo da espessura da laje (0 = x, 1 = y, 2 = z). Devolve até 4 blocos
 * que cercam o furo sem se sobrepor.
 */
export function slabWithHole(
  min: Vec3Tuple,
  max: Vec3Tuple,
  axis: 0 | 1 | 2,
  holeMin: Vec3Tuple,
  holeMax: Vec3Tuple,
  style: SurfaceStyle,
): StaticBoxDef[] {
  const [a, b] = ([0, 1, 2] as const).filter((i) => i !== axis) as [0 | 1 | 2, 0 | 1 | 2];
  const pieces: StaticBoxDef[] = [];
  const make = (aMin: number, aMax: number, bMin: number, bMax: number) => {
    if (aMax - aMin <= 1e-6 || bMax - bMin <= 1e-6) return;
    const lo = [0, 0, 0];
    const hi = [0, 0, 0];
    lo[axis] = min[axis];
    hi[axis] = max[axis];
    lo[a] = aMin;
    hi[a] = aMax;
    lo[b] = bMin;
    hi[b] = bMax;
    pieces.push(block(lo as unknown as Vec3Tuple, hi as unknown as Vec3Tuple, style));
  };
  // Faixas inteiras antes e depois do furo (no eixo a), e os dois pedaços laterais.
  make(min[a], holeMin[a], min[b], max[b]);
  make(holeMax[a], max[a], min[b], max[b]);
  make(holeMin[a], holeMax[a], min[b], holeMin[b]);
  make(holeMin[a], holeMax[a], holeMax[b], max[b]);
  return pieces;
}
