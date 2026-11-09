import { LEVELS, type LevelId } from '../levels';
import type { QualitySetting } from '../render/quality';

/** Configurações e progresso salvos no próprio aparelho (nada sai dele). */
export interface Settings {
  sensitivity: number;
  invertY: boolean;
  quality: QualitySetting;
  showFps: boolean;
  /** Vibração no Android (só aparece nos ajustes se o aparelho permitir). */
  vibration: boolean;
}

export interface Progress {
  completed: LevelId[];
  bestTimes: Partial<Record<LevelId, number>>;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  progress: Progress;
}

export const STORAGE_KEY = 'reality-break:v1';

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  invertY: false,
  quality: 'auto',
  showFps: false,
  vibration: true,
};

export function defaultSave(): SaveData {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, progress: { completed: [], bestTimes: {} } };
}

const LEVEL_IDS = new Set<string>(LEVELS.map((l) => l.id));
const QUALITIES = new Set<string>(['auto', 'baixa', 'alta']);

/** Lê dados salvos com validação: qualquer valor estranho volta ao padrão. */
export function parseSave(raw: string | null): SaveData {
  const save = defaultSave();
  if (!raw) return save;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return save;
  }
  if (!data || typeof data !== 'object') return save;
  const { settings, progress } = data as Record<string, unknown>;
  if (settings && typeof settings === 'object') {
    const s = settings as Record<string, unknown>;
    if (typeof s.sensitivity === 'number' && s.sensitivity >= 0.25 && s.sensitivity <= 3) {
      save.settings.sensitivity = s.sensitivity;
    }
    if (typeof s.invertY === 'boolean') save.settings.invertY = s.invertY;
    if (typeof s.quality === 'string' && QUALITIES.has(s.quality)) {
      save.settings.quality = s.quality as QualitySetting;
    }
    if (typeof s.showFps === 'boolean') save.settings.showFps = s.showFps;
    if (typeof s.vibration === 'boolean') save.settings.vibration = s.vibration;
  }
  if (progress && typeof progress === 'object') {
    const p = progress as Record<string, unknown>;
    if (Array.isArray(p.completed)) {
      save.progress.completed = [...new Set(p.completed)].filter(
        (id): id is LevelId => typeof id === 'string' && LEVEL_IDS.has(id),
      );
    }
    if (p.bestTimes && typeof p.bestTimes === 'object') {
      for (const [id, time] of Object.entries(p.bestTimes as Record<string, unknown>)) {
        if (LEVEL_IDS.has(id) && typeof time === 'number' && Number.isFinite(time) && time > 0) {
          save.progress.bestTimes[id as LevelId] = time;
        }
      }
    }
  }
  return save;
}

/** Um desafio fica liberado quando o anterior foi concluído. */
export function isUnlocked(progress: Progress, id: LevelId): boolean {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index <= 0) return index === 0;
  return progress.completed.includes(LEVELS[index - 1]!.id);
}

/** Próximo desafio a jogar: o primeiro liberado e ainda não concluído. */
export function nextToPlay(progress: Progress): LevelId {
  const pending = LEVELS.find((l) => isUnlocked(progress, l.id) && !progress.completed.includes(l.id));
  return (pending ?? LEVELS[0]!).id;
}

/** Registra a conclusão; devolve true se for um novo recorde. */
export function recordCompletion(progress: Progress, id: LevelId, time: number): boolean {
  if (!progress.completed.includes(id)) progress.completed.push(id);
  const best = progress.bestTimes[id];
  if (best === undefined || time < best) {
    progress.bestTimes[id] = time;
    return true;
  }
  return false;
}

/** Armazenamento tolerante a falhas (aba anônima, armazenamento bloqueado…). */
export class SaveStore {
  data: SaveData;

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
    let raw: string | null = null;
    try {
      raw = storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.data = parseSave(raw);
  }

  save(): boolean {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
      return !!this.storage;
    } catch {
      return false;
    }
  }
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
