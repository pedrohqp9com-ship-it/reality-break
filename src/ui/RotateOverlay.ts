import { el } from './dom';

/**
 * Aviso de tela cheia para celular em pé. O botão entra em tela cheia e pede ao
 * navegador para travar na horizontal — no Chrome do Android a tela gira
 * sozinha, mesmo com o aparelho em pé.
 */
export class RotateOverlay {
  readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, canFullscreen: boolean, onFullscreen: () => void) {
    const button = el('button', {
      className: 'btn btn-primary',
      text: 'Jogar em tela cheia',
      attrs: { type: 'button', 'data-testid': 'rotate-fullscreen' },
    });
    button.addEventListener('click', onFullscreen);
    this.root = el('div', {
      className: 'rotate-overlay',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rotate-title', 'data-testid': 'rotate-overlay' },
      children: [
        el('div', {
          className: 'rotate-phone',
          attrs: { 'aria-hidden': 'true' },
          children: [el('div', { className: 'rotate-phone-screen' })],
        }),
        el('h2', { text: 'Gire o aparelho', attrs: { id: 'rotate-title' } }),
        el('p', {
          text: 'REALITY BREAK é jogado com a tela deitada. Vire o celular para a horizontal.',
        }),
        canFullscreen ? button : null,
      ],
    });
    this.root.hidden = true;
    parent.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }
}
