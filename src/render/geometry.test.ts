import { describe, expect, it } from 'vitest';
import { boxEdgesGeometry, GRID_TILE, mergeBoxes, worldBoxGeometry } from './geometry';

describe('geometria do cenário', () => {
  it('coordenadas de textura seguem a posição no mundo', () => {
    const geometry = worldBoxGeometry([2, -0.5, 0], [4, 1, 2]);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < position.count; i++) {
      if (normal.getY(i) > 0.5) {
        expect(uv.getX(i)).toBeCloseTo(position.getX(i) / GRID_TILE);
        expect(uv.getY(i)).toBeCloseTo(position.getZ(i) / GRID_TILE);
      }
    }
  });

  it('junta caixas numa geometria só', () => {
    const merged = mergeBoxes([
      { center: [0, 0, 0], size: [1, 1, 1] },
      { center: [3, 0, 0], size: [1, 2, 1] },
    ]);
    expect(merged?.getAttribute('position').count).toBe(48);
    expect(mergeBoxes([])).toBeNull();
  });

  it('12 arestas por caixa', () => {
    const edges = boxEdgesGeometry([{ center: [0, 0, 0], size: [1, 1, 1] }]);
    expect(edges.getAttribute('position').count).toBe(24);
  });
});
