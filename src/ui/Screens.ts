import { LEVELS, type LevelDef, type LevelId } from '../levels';
import { formatControlText, type InputMode } from '../input/actions';
import type { QualitySetting } from '../render/quality';
import { isUnlocked, type Progress, type Settings } from '../state/storage';
import { actionButton, el } from './dom';
import { formatTime, POWER_NAMES } from './format';

export interface ScreenCallbacks {
  play(id: LevelId): void;
  begin(): void;
  resume(): void;
  restart(): void;
  menu(): void;
  next(): void;
  settingsChanged(settings: Settings): void;
  /** Abre os ajustes; `back` volta para a tela anterior. */
  openSettings(back: () => void): void;
  fullscreen(): void;
}

/** Como usar cada poder, por tipo de controle. */
const POWER_CONTROLS: Readonly<Record<string, Readonly<Record<InputMode, string>>>> = {
  intensity: {
    keyboard: 'Teclas 1, 2 e 3: gravidade Leve, Normal e Pesada.',
    touch: 'Botões LEVE, NORMAL e PESADA.',
  },
  flip: {
    keyboard: 'Tecla F: inverte a gravidade.',
    touch: 'Botão INVERTER.',
  },
  aim: {
    keyboard: 'Mire com a câmera e aperte G (ou clique): a gravidade puxa para aquela superfície.',
    touch: 'Mire com a câmera e toque em APONTAR: a gravidade puxa para aquela superfície.',
  },
};

const CONTROLS_TABLE: readonly [string, string, string][] = [
  ['Mover', 'W A S D ou setas', 'Direcional (lado esquerdo da tela)'],
  ['Olhar', 'Mouse (clique na tela para capturar)', 'Arrastar no lado direito da tela'],
  ['Pular', 'Espaço', 'PULAR'],
  ['Gravidade Leve / Normal / Pesada', '1 / 2 / 3', 'LEVE / NORMAL / PESADA'],
  ['Inverter a gravidade (Desafio 2+)', 'F', 'INVERTER'],
  ['Apontar a gravidade (Desafio 3)', 'G ou clique', 'APONTAR'],
  ['Aproximar / afastar a câmera', 'Roda do mouse', '—'],
  ['Reiniciar o desafio', 'R', 'Menu de pausa'],
  ['Pausar', 'Esc ou P', 'Botão ❙❙'],
];

/** Telas sobrepostas ao jogo: menu, briefing, pausa, conclusão, ajustes. */
export class Screens {
  readonly root: HTMLDivElement;
  current: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: ScreenCallbacks,
    private readonly canFullscreen: boolean,
  ) {
    this.root = el('div', { className: 'screens' });
    parent.append(this.root);
  }

  private show(name: string, content: HTMLElement): void {
    this.current = name;
    this.root.hidden = false;
    this.root.dataset.screen = name;
    const panel = el('div', {
      className: `panel panel-${name}`,
      attrs: { role: 'dialog', 'aria-modal': 'true', 'data-testid': `screen-${name}` },
      children: [content],
    });
    this.root.replaceChildren(panel);
    const first = panel.querySelector<HTMLElement>('[data-autofocus], .btn-primary, button');
    first?.focus({ preventScroll: true });
  }

  hide(): void {
    this.current = null;
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  mainMenu(progress: Progress, nextId: LevelId): void {
    const done = progress.completed.length;
    const nextLevel = LEVELS.find((l) => l.id === nextId)!;
    const playLabel =
      done === 0 ? 'Jogar' : done >= LEVELS.length ? 'Jogar de novo' : `Continuar: ${nextLevel.title}`;
    this.show(
      'menu',
      el('div', {
        className: 'menu',
        children: [
          el('h1', {
            className: 'logo',
            attrs: { 'aria-label': 'Reality Break' },
            children: [el('span', { text: 'REALITY' }), el('span', { className: 'logo-break', text: 'BREAK' })],
          }),
          el('p', { className: 'tagline', text: 'As leis da física são só sugestões.' }),
          el('div', {
            className: 'menu-buttons',
            children: [
              actionButton(playLabel, () => this.callbacks.play(nextId), { primary: true, testId: 'play' }),
              actionButton('Desafios', () => this.levelSelect(progress), { testId: 'levels' }),
              actionButton('Controles', () => this.controls(() => this.mainMenu(progress, nextId))),
              actionButton('Ajustes', () => this.callbacks.openSettings(() => this.mainMenu(progress, nextId))),
              this.canFullscreen
                ? actionButton(document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia', () =>
                    this.callbacks.fullscreen(),
                  )
                : null,
            ].filter((b): b is HTMLButtonElement => !!b),
          }),
          el('p', {
            className: 'menu-foot',
            text: `Protótipo · ${done}/${LEVELS.length} desafios concluídos`,
          }),
        ],
      }),
    );
  }

  levelSelect(progress: Progress): void {
    const cards = LEVELS.map((level) => {
      const unlocked = isUnlocked(progress, level.id);
      const completed = progress.completed.includes(level.id);
      const best = progress.bestTimes[level.id];
      const status = completed
        ? `Concluído${best ? ` · melhor tempo ${formatTime(best)}` : ''}`
        : unlocked
          ? 'Disponível'
          : 'Bloqueado: conclua o desafio anterior';
      const card = el('button', {
        className: `level-card${unlocked ? '' : ' locked'}${completed ? ' done' : ''}`,
        attrs: { type: 'button', 'data-testid': `level-${level.id}` },
        children: [
          el('span', { className: 'level-card-num', text: `Desafio ${level.number}` }),
          el('span', { className: 'level-card-title', text: level.title }),
          el('span', { className: 'level-card-power', text: `Poder: ${POWER_NAMES[level.newPower]}` }),
          el('span', { className: 'level-card-status', text: status }),
        ],
      });
      card.disabled = !unlocked;
      card.style.setProperty('--accent', `#${level.accent.toString(16).padStart(6, '0')}`);
      card.addEventListener('click', () => this.callbacks.play(level.id));
      return card;
    });
    this.show(
      'levels',
      el('div', {
        children: [
          el('h2', { text: 'Desafios' }),
          el('div', { className: 'level-grid', children: cards }),
          el('div', { className: 'menu-buttons', children: [actionButton('Voltar', () => this.callbacks.menu())] }),
        ],
      }),
    );
  }

  briefing(level: LevelDef, mode: InputMode): void {
    const accent = `#${level.accent.toString(16).padStart(6, '0')}`;
    const content = el('div', {
      className: 'briefing',
      children: [
        el('span', { className: 'eyebrow', text: `Desafio ${level.number} de ${LEVELS.length}` }),
        el('h2', { text: level.title }),
        el('p', { className: 'tagline', text: level.tagline }),
        el('ul', { className: 'briefing-list', children: level.briefing.map((line) => el('li', { text: line })) }),
        el('p', {
          className: 'briefing-control',
          text: formatControlText(POWER_CONTROLS[level.newPower]![mode], mode),
        }),
        el('p', { className: 'briefing-objective', children: [el('strong', { text: 'Objetivo: ' }), document.createTextNode(level.objective)] }),
        el('div', {
          className: 'menu-buttons',
          children: [
            actionButton('Começar', () => this.callbacks.begin(), { primary: true, testId: 'begin' }),
            actionButton('Voltar', () => this.callbacks.menu()),
          ],
        }),
      ],
    });
    content.style.setProperty('--accent', accent);
    this.show('briefing', content);
  }

  pause(): void {
    this.show(
      'pause',
      el('div', {
        children: [
          el('h2', { text: 'Pausa' }),
          el('div', {
            className: 'menu-buttons',
            children: [
              actionButton('Continuar', () => this.callbacks.resume(), { primary: true, testId: 'resume' }),
              actionButton('Reiniciar desafio', () => this.callbacks.restart(), { testId: 'restart' }),
              this.canFullscreen
                ? actionButton(
                    document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia',
                    () => this.callbacks.fullscreen(),
                    { testId: 'pause-fullscreen' },
                  )
                : null,
              actionButton('Controles', () => this.controls(() => this.pause())),
              actionButton('Ajustes', () => this.callbacks.openSettings(() => this.pause())),
              actionButton('Menu principal', () => this.callbacks.menu(), { testId: 'to-menu' }),
            ].filter((b): b is HTMLButtonElement => !!b),
          }),
        ],
      }),
    );
  }

  complete(level: LevelDef, time: number, best: number, record: boolean, hasNext: boolean): void {
    this.show(
      'complete',
      el('div', {
        children: [
          el('span', { className: 'eyebrow', text: `Desafio ${level.number} concluído` }),
          el('h2', { text: level.title }),
          el('p', { className: 'result-time', attrs: { 'data-testid': 'result-time' }, text: formatTime(time) }),
          el('p', {
            className: 'result-best',
            text: record ? 'Novo recorde!' : `Melhor tempo: ${formatTime(best)}`,
          }),
          hasNext
            ? null
            : el('p', {
                className: 'result-end',
                text: 'Você concluiu os três desafios deste protótipo. Novos poderes e fases virão nas próximas etapas.',
              }),
          el('div', {
            className: 'menu-buttons',
            children: [
              hasNext
                ? actionButton('Próximo desafio', () => this.callbacks.next(), { primary: true, testId: 'next' })
                : null,
              actionButton('Repetir', () => this.callbacks.restart(), { primary: !hasNext, testId: 'replay' }),
              actionButton('Menu principal', () => this.callbacks.menu()),
            ].filter((b): b is HTMLButtonElement => !!b),
          }),
        ],
      }),
    );
  }

  settings(current: Settings, back: () => void): void {
    const sensitivity = el('input', {
      attrs: { type: 'range', min: '0.25', max: '3', step: '0.05', id: 'set-sens', 'data-autofocus': '' },
    });
    sensitivity.value = String(current.sensitivity);
    const sensValue = el('output', { text: `${current.sensitivity.toFixed(2)}×`, attrs: { for: 'set-sens' } });
    const invert = el('input', { attrs: { type: 'checkbox', id: 'set-invert' } });
    invert.checked = current.invertY;
    const fps = el('input', { attrs: { type: 'checkbox', id: 'set-fps' } });
    fps.checked = current.showFps;
    const quality = el('select', {
      attrs: { id: 'set-quality' },
      children: [
        el('option', { text: 'Automática (ajusta a resolução)', attrs: { value: 'auto' } }),
        el('option', { text: 'Baixa (mais leve)', attrs: { value: 'baixa' } }),
        el('option', { text: 'Alta', attrs: { value: 'alta' } }),
      ],
    });
    quality.value = current.quality;

    const emit = () => {
      const next: Settings = {
        sensitivity: Number(sensitivity.value),
        invertY: invert.checked,
        showFps: fps.checked,
        quality: quality.value as QualitySetting,
      };
      sensValue.textContent = `${next.sensitivity.toFixed(2)}×`;
      this.callbacks.settingsChanged(next);
    };
    for (const input of [sensitivity, invert, fps, quality]) input.addEventListener('input', emit);

    const row = (label: string, id: string, control: HTMLElement, extra?: HTMLElement) =>
      el('div', {
        className: 'setting',
        children: [el('label', { text: label, attrs: { for: id } }), control, extra],
      });

    this.show(
      'settings',
      el('div', {
        children: [
          el('h2', { text: 'Ajustes' }),
          row('Sensibilidade da câmera', 'set-sens', sensitivity, sensValue),
          row('Inverter eixo vertical', 'set-invert', invert),
          row('Qualidade gráfica', 'set-quality', quality),
          row('Mostrar FPS', 'set-fps', fps),
          el('div', { className: 'menu-buttons', children: [actionButton('Voltar', back, { primary: true })] }),
        ],
      }),
    );
  }

  controls(back: () => void): void {
    const rows = CONTROLS_TABLE.map(([action, pc, touch]) =>
      el('tr', { children: [el('th', { text: action, attrs: { scope: 'row' } }), el('td', { text: pc }), el('td', { text: touch })] }),
    );
    this.show(
      'controls',
      el('div', {
        children: [
          el('h2', { text: 'Controles' }),
          el('div', {
            className: 'table-wrap',
            children: [
              el('table', {
                children: [
                  el('thead', {
                    children: [
                      el('tr', {
                        children: [
                          el('th', { text: 'Ação', attrs: { scope: 'col' } }),
                          el('th', { text: 'PC', attrs: { scope: 'col' } }),
                          el('th', { text: 'Celular', attrs: { scope: 'col' } }),
                        ],
                      }),
                    ],
                  }),
                  el('tbody', { children: rows }),
                ],
              }),
            ],
          }),
          el('div', { className: 'menu-buttons', children: [actionButton('Voltar', back, { primary: true })] }),
        ],
      }),
    );
  }

  error(message: string): void {
    this.show(
      'error',
      el('div', {
        children: [
          el('h1', {
            className: 'logo',
            children: [el('span', { text: 'REALITY' }), el('span', { className: 'logo-break', text: 'BREAK' })],
          }),
          el('p', { className: 'error-text', text: message }),
        ],
      }),
    );
  }
}
