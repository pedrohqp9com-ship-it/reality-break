import { inversao } from './inversao';
import { leveza } from './leveza';
import { orientacao } from './orientacao';
import type { LevelDef, LevelId } from './types';

/** Desafios em ordem de progressão: cada um libera um novo poder. */
export const LEVELS: readonly LevelDef[] = [leveza, inversao, orientacao];

export function getLevel(id: LevelId): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Desafio desconhecido: ${id}`);
  return level;
}

export function nextLevel(id: LevelId): LevelDef | null {
  const index = LEVELS.findIndex((l) => l.id === id);
  return LEVELS[index + 1] ?? null;
}

export type { LevelDef, LevelId } from './types';
