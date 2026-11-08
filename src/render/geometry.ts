import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3Tuple } from '../levels/types';

/** Tamanho (m) de uma repetição da textura de grade. */
export const GRID_TILE = 4;

/**
 * Caixa com coordenadas de textura calculadas a partir da posição no mundo: a
 * grade fica com a mesma escala em todas as faces e continua alinhada entre
 * blocos vizinhos (como se o cenário fosse uma peça só).
 */
export function worldBoxGeometry(center: Vec3Tuple, size: Vec3Tuple, tile = GRID_TILE): BufferGeometry {
  const geometry = new BoxGeometry(size[0], size[1], size[2]);
  geometry.translate(center[0], center[1], center[2]);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    let u: number;
    let v: number;
    if (nx > 0.5) {
      u = z;
      v = y;
    } else if (ny > 0.5) {
      u = x;
      v = z;
    } else {
      u = x;
      v = y;
    }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/** Junta várias caixas em uma geometria (uma única chamada de desenho). */
export function mergeBoxes(boxes: readonly { center: Vec3Tuple; size: Vec3Tuple }[]): BufferGeometry | null {
  if (boxes.length === 0) return null;
  const parts = boxes.map((b) => worldBoxGeometry(b.center, b.size));
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged;
}

/** Arestas de várias caixas em um único conjunto de linhas. */
export function boxEdgesGeometry(boxes: readonly { center: Vec3Tuple; size: Vec3Tuple }[]): BufferGeometry {
  const positions: number[] = [];
  for (const { center, size } of boxes) {
    const hx = size[0] / 2;
    const hy = size[1] / 2;
    const hz = size[2] / 2;
    const corners = [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
      [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const [a, b] of edges) {
      const pa = corners[a!]!;
      const pb = corners[b!]!;
      positions.push(
        center[0] + pa[0]!, center[1] + pa[1]!, center[2] + pa[2]!,
        center[0] + pb[0]!, center[1] + pb[1]!, center[2] + pb[2]!,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}
