import { describe, expect, it } from 'vitest';
import {
  defaultSave,
  isUnlocked,
  nextToPlay,
  parseSave,
  recordCompletion,
  SaveStore,
  STORAGE_KEY,
} from './storage';

describe('dados salvos', () => {
  it('JSON inválido ou vazio volta ao padrão', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('{oops')).toEqual(defaultSave());
    expect(parseSave('42')).toEqual(defaultSave());
  });

  it('descarta valores fora do esperado', () => {
    const save = parseSave(
      JSON.stringify({
        settings: { sensitivity: 99, invertY: 'sim', quality: 'ultra', showFps: true },
        progress: { completed: ['leveza', 'hack', 'leveza'], bestTimes: { leveza: 12.5, inversao: -1, x: 3 } },
      }),
    );
    expect(save.settings).toEqual({ sensitivity: 1, invertY: false, quality: 'auto', showFps: true });
    expect(save.progress).toEqual({ completed: ['leveza'], bestTimes: { leveza: 12.5 } });
  });

  it('progressão: cada desafio libera o seguinte', () => {
    const progress = defaultSave().progress;
    expect(isUnlocked(progress, 'leveza')).toBe(true);
    expect(isUnlocked(progress, 'inversao')).toBe(false);
    expect(nextToPlay(progress)).toBe('leveza');
    expect(recordCompletion(progress, 'leveza', 40)).toBe(true);
    expect(isUnlocked(progress, 'inversao')).toBe(true);
    expect(isUnlocked(progress, 'orientacao')).toBe(false);
    expect(nextToPlay(progress)).toBe('inversao');
  });

  it('recorde só quando o tempo melhora', () => {
    const progress = defaultSave().progress;
    recordCompletion(progress, 'leveza', 40);
    expect(recordCompletion(progress, 'leveza', 50)).toBe(false);
    expect(recordCompletion(progress, 'leveza', 30)).toBe(true);
    expect(progress.bestTimes.leveza).toBe(30);
    expect(progress.completed).toEqual(['leveza']);
  });

  it('funciona mesmo com o armazenamento bloqueado', () => {
    const blocked = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const store = new SaveStore(blocked);
    expect(store.data).toEqual(defaultSave());
    expect(store.save()).toBe(false);
    expect(new SaveStore(null).save()).toBe(false);
  });

  it('salva e lê de volta', () => {
    const memory = new Map<string, string>();
    const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v) };
    const store = new SaveStore(storage);
    recordCompletion(store.data.progress, 'leveza', 20);
    store.data.settings.sensitivity = 1.5;
    expect(store.save()).toBe(true);
    expect(memory.has(STORAGE_KEY)).toBe(true);
    const again = new SaveStore(storage);
    expect(again.data.progress.completed).toEqual(['leveza']);
    expect(again.data.settings.sensitivity).toBe(1.5);
  });
});
