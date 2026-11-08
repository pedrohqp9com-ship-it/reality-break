import { describe, expect, it } from 'vitest';
import { PLAYER } from '../sim/config';
import { jumpHeight, POWERS } from '../sim/gravity';
import { insideAabb, Simulation } from '../sim/simulation';
import { solveInversao, solveLeveza, solveOrientacao } from '../test/bots';
import { IDLE, runUntil, steerTowards } from '../test/helpers';
import { getLevel, LEVELS, nextLevel } from './index';
import { INVERSAO_CEILING, INVERSAO_WALL_TOP } from './inversao';
import { LEVEZA_LEDGE_HEIGHT } from './leveza';
import { ORIENTACAO_BARRIER_Y } from './orientacao';
import type { LevelDef, Vec3Tuple } from './types';
import { axisVector } from '../sim/axis';

function sphereHitsBox(p: Vec3Tuple, r: number, box: { center: Vec3Tuple; size: Vec3Tuple }) {
  let d2 = 0;
  for (let i = 0; i < 3; i++) {
    const lo = box.center[i]! - box.size[i]! / 2;
    const hi = box.center[i]! + box.size[i]! / 2;
    const v = Math.max(lo - p[i]!, 0, p[i]! - hi);
    d2 += v * v;
  }
  return d2 < r * r - 1e-6;
}

function solids(level: LevelDef): { center: Vec3Tuple; size: Vec3Tuple }[] {
  return [...level.statics, ...level.gates];
}

describe('dados dos desafios', () => {
  it('três desafios em ordem, cada um liberando um poder novo', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['leveza', 'inversao', 'orientacao']);
    LEVELS.forEach((level, i) => {
      expect(level.number).toBe(i + 1);
      expect(level.powers).toEqual(POWERS.slice(0, i + 1));
      expect(level.newPower).toBe(POWERS[i]);
    });
    expect(nextLevel('leveza')?.id).toBe('inversao');
    expect(nextLevel('orientacao')).toBeNull();
    expect(getLevel('inversao').title).toBe('Inversão');
  });

  it.each(LEVELS.map((l) => [l.id, l] as const))('%s: geometria coerente', (_, level) => {
    const boxes = solids(level);
    // Ponto inicial, pontos seguros e portal livres de paredes e dentro dos limites.
    const spawns = [level.spawn, ...level.checkpoints.map((c) => c.spawn)];
    for (const spawn of spawns) {
      expect(boxes.some((b) => sphereHitsBox(spawn, PLAYER.radius, b))).toBe(false);
      expect(insideAabb({ x: spawn[0], y: spawn[1], z: spawn[2] }, level.bounds)).toBe(true);
    }
    const [px, py, pz] = level.portal.center;
    expect(boxes.some((b) => sphereHitsBox(level.portal.center, 0.3, b))).toBe(false);
    expect(insideAabb({ x: px, y: py, z: pz }, level.bounds)).toBe(true);
    // Objetos não começam dentro de paredes.
    for (const object of level.objects) {
      expect(boxes.some((b) => sphereHitsBox(object.center, object.edge / 2 - 0.01, b))).toBe(false);
    }
    // Toda placa controla uma barreira que existe; ids únicos.
    for (const plate of level.plates) expect(level.gates.map((g) => g.id)).toContain(plate.gate);
    const ids = level.objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Textos de dica só usam marcadores conhecidos.
    for (const hint of level.hints) {
      for (const token of hint.text.match(/\[[A-Z]+\]/g) ?? []) {
        expect(['[LEVE]', '[NORMAL]', '[PESADA]', '[INVERTER]', '[APONTAR]', '[PULAR]']).toContain(token);
      }
    }
  });

  it.each(LEVELS.map((l) => [l.id, l] as const))('%s: placas ficam sobre uma superfície', (_, level) => {
    for (const plate of level.plates) {
      const normal = axisVector(plate.normal);
      // Um ponto logo "atrás" da placa precisa estar dentro de um bloco fixo.
      const behind: Vec3Tuple = [
        plate.center[0] - normal.x * 0.05,
        plate.center[1] - normal.y * 0.05,
        plate.center[2] - normal.z * 0.05,
      ];
      expect(level.statics.some((b) => sphereHitsBox(behind, 0.01, b))).toBe(true);
    }
  });
});

describe('cada desafio exige o poder que apresenta', () => {
  it('Leveza: a plataforma é alta demais para o salto normal e alcançável no Leve', () => {
    expect(jumpHeight(PLAYER.jumpSpeed, 'normal')).toBeLessThan(LEVEZA_LEDGE_HEIGHT);
    expect(jumpHeight(PLAYER.jumpSpeed, 'leve')).toBeGreaterThan(LEVEZA_LEDGE_HEIGHT + 1);

    const tryClimb = (sim: Simulation) =>
      runUntil(
        sim,
        12,
        (s) => steerTowards(s, { x: 0, y: 0, z: -14 }, s.player.grounded && s.player.position.z < -9),
        (s) => s.player.position.y > LEVEZA_LEDGE_HEIGHT && s.player.grounded,
      );
    expect(tryClimb(new Simulation(getLevel('leveza')))).toBe(false);
    const light = new Simulation(getLevel('leveza'));
    light.setIntensity('leve');
    expect(tryClimb(light)).toBe(true);
  });

  it('Inversão: nem o salto Leve alcança a fresta junto ao teto', () => {
    expect(PLAYER.radius * 2).toBeLessThan(INVERSAO_CEILING - INVERSAO_WALL_TOP);
    expect(jumpHeight(PLAYER.jumpSpeed, 'leve') + 1 /* cubo */).toBeLessThan(INVERSAO_WALL_TOP);

    const sim = new Simulation(getLevel('inversao'));
    sim.setIntensity('leve');
    const crossed = runUntil(
      sim,
      12,
      (s) => steerTowards(s, { x: 0, y: 0, z: -20 }, s.player.grounded),
      (s) => s.player.position.z < -17,
    );
    expect(crossed).toBe(false);
  });

  it('Orientação: sem apontar, a barreira impede subir (nem invertendo)', () => {
    const sim = new Simulation(getLevel('orientacao'));
    sim.flipGravity();
    let maxY = 0;
    runUntil(sim, 4, IDLE, (s) => {
      maxY = Math.max(maxY, s.player.position.y);
      return false;
    });
    expect(maxY).toBeLessThan(ORIENTACAO_BARRIER_Y);
    expect(sim.player.grounded).toBe(true);
  });
});

describe('cada desafio tem solução usando só os controles do jogador', () => {
  it('Desafio 1 — Leveza', () => {
    expect(solveLeveza(new Simulation(getLevel('leveza')))).toBe(true);
  });
  it('Desafio 2 — Inversão', () => {
    expect(solveInversao(new Simulation(getLevel('inversao')))).toBe(true);
  });
  it('Desafio 3 — Orientação', () => {
    expect(solveOrientacao(new Simulation(getLevel('orientacao')))).toBe(true);
  });
});
