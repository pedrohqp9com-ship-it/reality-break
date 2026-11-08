import { Vector3 } from 'three';

/** As seis direções possíveis da gravidade (alinhadas aos eixos do mundo). */
export type Axis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export const AXES: readonly Axis[] = ['-y', '+y', '-z', '+z', '-x', '+x'];

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

const AXIS_COMPONENTS: Record<Axis, readonly [number, number, number]> = {
  '+x': [1, 0, 0],
  '-x': [-1, 0, 0],
  '+y': [0, 1, 0],
  '-y': [0, -1, 0],
  '+z': [0, 0, 1],
  '-z': [0, 0, -1],
};

export function isAxis(value: unknown): value is Axis {
  return typeof value === 'string' && value in AXIS_COMPONENTS;
}

export function axisVector(axis: Axis, target = new Vector3()): Vector3 {
  const [x, y, z] = AXIS_COMPONENTS[axis];
  return target.set(x, y, z);
}

export function oppositeAxis(axis: Axis): Axis {
  return `${axis[0] === '+' ? '-' : '+'}${axis[1]}` as Axis;
}

/** Eixo do mundo mais próximo de uma direção qualquer (maior produto escalar). */
export function nearestAxis(direction: Vec3Like): Axis {
  let best: Axis = '-y';
  let bestDot = -Infinity;
  for (const axis of AXES) {
    const [x, y, z] = AXIS_COMPONENTS[axis];
    const dot = x * direction.x + y * direction.y + z * direction.z;
    if (dot > bestDot) {
      bestDot = dot;
      best = axis;
    }
  }
  return best;
}
