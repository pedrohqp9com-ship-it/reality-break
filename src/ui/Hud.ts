import type { LevelDef } from '../levels';
import type { InputMode } from '../input/actions';
import { formatControlText } from '../input/actions';
import type { Axis } from '../sim/axis';
import type { GravityState } from '../sim/gravity';
import type { GateRuntime, PlateRuntime } from '../sim/simulation';
import { el } from './dom';
import { AXIS_NAMES, formatGravity, formatNewtons, formatTime, type GravityArrow } from './format';

const KEY_HELP: Readonly<Record<string, string>> = {
  base: 'WASD mover · Mouse olhar · Espaço pular',
  intensity: '1 Leve · 2 Normal · 3 Pesada',
  flip: 'F inverter',
  aim: 'G/clique apontar',
  tail: 'R reiniciar · Esc pausa',
};

interface PlateRow {
  readonly fill: HTMLDivElement;
  readonly value: HTMLSpanElement;
  readonly gate: HTMLSpanElement;
}

/** Interface sobre o jogo (DOM). Só mostra o estado real da simulação. */
export class Hud {
  readonly root: HTMLDivElement;
  readonly pauseButton: HTMLButtonElement;
  private readonly title: HTMLDivElement;
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
  private lastTimer = '';

  constructor(parent: HTMLElement, onPause: () => void) {
    this.title = el('div', { className: 'hud-title' });
    this.objective = el('div', { className: 'hud-objective' });
    this.timer = el('div', { className: 'hud-timer', attrs: { 'data-testid': 'timer' } });
    this.pauseButton = el('button', {
      className: 'hud-pause',
      attrs: { type: 'button', 'aria-label': 'Pausar', 'data-testid': 'pause-button' },
      children: [el('span'), el('span')],
    });
    this.pauseButton.addEventListener('click', onPause);
    this.arrow = el('div', { className: 'hud-arrow', attrs: { 'aria-hidden': 'true' } });
    this.axis = el('div', { className: 'hud-axis' });
    this.level = el('div', { className: 'hud-level', attrs: { 'data-testid': 'gravity-level' } });
    this.aim = el('div', { className: 'hud-aim', attrs: { 'data-testid': 'aim-preview' } });
    this.plates = el('div', { className: 'hud-plates' });
    this.hint = el('div', { className: 'hud-hint', attrs: { 'aria-live': 'polite', 'data-testid': 'hint' } });
    this.toast = el('div', { className: 'hud-toast', attrs: { role: 'status', 'data-testid': 'toast' } });
    this.fps = el('div', { className: 'hud-fps', attrs: { 'data-testid': 'fps' } });
    this.keys = el('div', { className: 'hud-keys' });

    this.root = el('div', {
      className: 'hud',
      attrs: { 'data-testid': 'hud' },
      children: [
        el('div', { className: 'hud-top-left', children: [this.title, this.objective] }),
        el('div', { className: 'hud-top-right', children: [this.timer, this.pauseButton] }),
        el('div', {
          className: 'hud-gravity',
          attrs: { 'data-testid': 'gravity' },
          children: [
            el('div', { className: 'hud-compass', children: [this.arrow] }),
            el('div', { className: 'hud-gravity-text', children: [this.axis, this.level, this.aim] }),
          ],
        }),
        this.plates,
        this.hint,
        this.toast,
        this.fps,
        this.keys,
      ],
    });
    parent.append(this.root);
  }

  setLevel(level: LevelDef, plates: readonly PlateRuntime[], mode: InputMode): void {
    this.title.textContent = `Desafio ${level.number} · ${level.title}`;
    this.objective.textContent = level.objective;
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
    },
  ): void {
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
      this.hint.classList.toggle('visible', !!hint);
      this.lastHint = hint;
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('visible');
    }

    this.fps.hidden = data.fps === null;
    if (data.fps !== null) this.fps.textContent = `${Math.round(data.fps)} FPS`;
  }
}
