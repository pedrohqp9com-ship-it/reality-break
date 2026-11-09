import type { LevelDef } from '../levels';
import type { InputMode } from '../input/actions';
import { formatControlText } from '../input/actions';
import type { Axis } from '../sim/axis';
import type { GravityState } from '../sim/gravity';
import type { GateRuntime, ObjectiveRuntime, PlateRuntime } from '../sim/simulation';
import { el } from './dom';
import { AXIS_NAMES, formatGravity, formatNewtons, formatTime, type GravityArrow } from './format';

const KEY_HELP: Readonly<Record<string, string>> = {
  base: 'WASD mover · Shift correr · Mouse olhar · Espaço pular',
  intensity: '1 Leve · 2 Normal · 3 Pesada',
  flip: 'F inverter',
  aim: 'G/clique apontar',
  tail: 'R reiniciar · Esc pausa',
};

const HINT_SECONDS = 9;

interface PlateRow {
  readonly fill: HTMLDivElement;
  readonly value: HTMLSpanElement;
  readonly gate: HTMLSpanElement;
}

/** Interface sobre o jogo (DOM). Só mostra o estado real da simulação. */
export class Hud {
  readonly root: HTMLDivElement;
  readonly pauseButton: HTMLButtonElement;
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly title: HTMLDivElement;
  private readonly lives: HTMLDivElement;
  private livesShown = -1;
  private lastObjective = '';
  private readonly objective: HTMLDivElement;
  private readonly timer: HTMLDivElement;
  private readonly arrow: HTMLDivElement;
  private readonly axis: HTMLDivElement;
  private readonly level: HTMLDivElement;
  private readonly aim: HTMLDivElement;
  private readonly plates: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private readonly fps: HTMLDivElement;
  private readonly keys: HTMLDivElement;
  private plateRows: PlateRow[] = [];
  private toastTimer = 0;
  private lastHint: string | null = null;
  /** Tempo restante (s) da dica atual na tela. */
  private hintTimer = 0;
  private lastTimer = '';

  constructor(
    parent: HTMLElement,
    actions: { onPause: () => void; onFullscreen: (() => void) | null },
  ) {
    this.title = el('div', { className: 'hud-title' });
    this.lives = el('div', { className: 'hud-lives', attrs: { 'data-testid': 'lives', role: 'img' } });
    this.objective = el('div', { className: 'hud-objective', attrs: { 'data-testid': 'objective' } });
    this.timer = el('div', { className: 'hud-timer', attrs: { 'data-testid': 'timer' } });
    this.pauseButton = el('button', {
      className: 'hud-pause',
      attrs: { type: 'button', 'aria-label': 'Pausar', 'data-testid': 'pause-button' },
      children: [el('span'), el('span')],
    });
    this.pauseButton.addEventListener('click', actions.onPause);
    this.fullscreenButton = el('button', {
      className: 'hud-icon-btn hud-fullscreen',
      attrs: { type: 'button', 'aria-label': 'Tela cheia', 'aria-pressed': 'false', 'data-testid': 'fullscreen-button' },
      children: [el('span', { className: 'fs-icon', attrs: { 'aria-hidden': 'true' } })],
    });
    // Sem a API de tela cheia (ex.: iPhone), o botão não aparece.
    this.fullscreenButton.hidden = !actions.onFullscreen;
    if (actions.onFullscreen) this.fullscreenButton.addEventListener('click', actions.onFullscreen);
    this.arrow = el('div', { className: 'hud-arrow', attrs: { 'aria-hidden': 'true' } });
    this.axis = el('div', { className: 'hud-axis' });
    this.level = el('div', { className: 'hud-level', attrs: { 'data-testid': 'gravity-level' } });
    this.aim = el('div', { className: 'hud-aim', attrs: { 'data-testid': 'aim-preview' } });
    this.plates = el('div', { className: 'hud-plates' });
    this.hint = el('div', { className: 'hud-hint', attrs: { 'aria-live': 'polite', 'data-testid': 'hint' } });
    this.toast = el('div', { className: 'hud-toast', attrs: { role: 'status', 'data-testid': 'toast' } });
    this.fps = el('div', { className: 'hud-fps', attrs: { 'data-testid': 'fps' } });
    this.keys = el('div', { className: 'hud-keys' });

    const gravity = el('div', {
      className: 'hud-gravity',
      attrs: { 'data-testid': 'gravity' },
      children: [
        el('div', { className: 'hud-compass', children: [this.arrow] }),
        el('div', { className: 'hud-gravity-text', children: [this.axis, this.level, this.aim] }),
      ],
    });
    // Duas colunas: à esquerda o desafio e a gravidade; à direita tempo, pausa e placas.
    this.root = el('div', {
      className: 'hud',
      attrs: { 'data-testid': 'hud' },
      children: [
        el('div', {
          className: 'hud-col hud-left',
          children: [
            el('div', { className: 'hud-row hud-title-row', children: [this.title, this.lives] }),
            this.objective,
            gravity,
            this.hint,
          ],
        }),
        el('div', {
          className: 'hud-col hud-right',
          children: [
            el('div', { className: 'hud-row', children: [this.timer, this.fullscreenButton, this.pauseButton] }),
            this.plates,
            this.fps,
          ],
        }),
        this.toast,
        this.keys,
      ],
    });
    parent.append(this.root);
  }

  setLevel(level: LevelDef, plates: readonly PlateRuntime[], mode: InputMode): void {
    this.title.textContent = `Desafio ${level.number} · ${level.title}`;
    this.objective.textContent = level.objective;
    this.livesShown = -1;
    this.lastObjective = '';
    this.plates.replaceChildren();
    this.plateRows = plates.map((plate) => {
      const fill = el('div', { className: 'hud-plate-fill' });
      const value = el('span', { className: 'hud-plate-value' });
      const gate = el('span', { className: 'hud-plate-gate' });
      const row = el('div', {
        className: 'hud-plate',
        attrs: { 'data-testid': `plate-${plate.def.id}` },
        children: [
          el('div', {
            className: 'hud-plate-head',
            children: [el('span', { text: 'Placa de pressão' }), value],
          }),
          el('div', { className: 'hud-plate-bar', children: [fill] }),
          gate,
        ],
      });
      this.plates.append(row);
      return { fill, value, gate };
    });
    this.aim.hidden = !level.powers.includes('aim');
    const help = [KEY_HELP.base, ...level.powers.map((p) => KEY_HELP[p]), KEY_HELP.tail];
    this.keys.textContent = help.join(' · ');
    this.setMode(mode);
    this.lastHint = null;
  }

  setMode(mode: InputMode): void {
    this.root.dataset.mode = mode;
    this.lastHint = null;
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  setFullscreen(active: boolean): void {
    this.fullscreenButton.setAttribute('aria-pressed', String(active));
    this.fullscreenButton.setAttribute('aria-label', active ? 'Sair da tela cheia' : 'Tela cheia');
  }

  showToast(text: string, seconds = 1.8): void {
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    this.toastTimer = seconds;
  }

  update(
    dt: number,
    data: {
      time: number;
      gravity: GravityState;
      arrow: GravityArrow;
      aim: Axis | null;
      plates: readonly PlateRuntime[];
      gates: readonly GateRuntime[];
      hint: string | null;
      mode: InputMode;
      fps: number | null;
      lives: number;
      maxLives: number;
      objectives: readonly ObjectiveRuntime[];
    },
  ): void {
    if (data.lives !== this.livesShown) {
      this.livesShown = data.lives;
      this.lives.replaceChildren(
        ...Array.from({ length: data.maxLives }, (_, i) =>
          el('span', { className: `hud-life${i < data.lives ? ' full' : ''}` }),
        ),
      );
      this.lives.setAttribute('aria-label', `Vidas: ${data.lives} de ${data.maxLives}`);
      this.lives.dataset.lives = String(data.lives);
    }
    const doneCount = data.objectives.filter((o) => o.done).length;
    const current = data.objectives.find((o) => !o.done);
    const objectiveText = current
      ? `Objetivo ${doneCount + 1}/${data.objectives.length}: ${current.def.text}`
      : 'Objetivos cumpridos';
    if (objectiveText !== this.lastObjective) {
      this.objective.textContent = objectiveText;
      this.lastObjective = objectiveText;
    }
    const timer = formatTime(data.time);
    if (timer !== this.lastTimer) {
      this.timer.textContent = timer;
      this.lastTimer = timer;
    }
    this.arrow.style.transform = `rotate(${data.arrow.rotation}deg)`;
    this.arrow.dataset.depth = data.arrow.depth;
    this.axis.textContent = `Gravidade: ${AXIS_NAMES[data.gravity.axis]}`;
    this.level.textContent = formatGravity(data.gravity);
    this.level.dataset.level = data.gravity.level;
    if (data.aim) {
      const same = data.aim === data.gravity.axis;
      this.aim.textContent = same ? 'Apontar: (já é o chão)' : `Apontar → ${AXIS_NAMES[data.aim]}`;
    }

    data.plates.forEach((plate, i) => {
      const row = this.plateRows[i];
      if (!row) return;
      const ratio = Math.min(1, plate.force / plate.def.threshold);
      row.fill.style.transform = `scaleX(${ratio.toFixed(3)})`;
      row.fill.classList.toggle('active', plate.active);
      row.value.textContent = `${formatNewtons(plate.force)} / ${formatNewtons(plate.def.threshold)}`;
      const gate = data.gates.find((g) => g.def.id === plate.def.gate);
      row.gate.textContent = gate?.open
        ? 'Barreira: aberta'
        : plate.hold > 0
          ? 'Força suficiente: mantenha…'
          : 'Barreira: fechada';
      row.gate.classList.toggle('open', !!gate?.open);
    });

    const hint = data.hint ? formatControlText(data.hint, data.mode) : null;
    if (hint !== this.lastHint) {
      this.hint.textContent = hint ?? '';
      this.lastHint = hint;
      this.hintTimer = hint ? HINT_SECONDS : 0;
    } else if (this.hintTimer > 0) {
      this.hintTimer -= dt;
    }
    // A dica some depois de alguns segundos e volta ao entrar em outra zona.
    this.hint.classList.toggle('visible', !!hint && this.hintTimer > 0);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('visible');
    }

    this.fps.hidden = data.fps === null;
    if (data.fps !== null) this.fps.textContent = `${Math.round(data.fps)} FPS`;
  }
}
