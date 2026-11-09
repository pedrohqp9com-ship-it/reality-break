import type { GravityLevel, Power } from '../sim/gravity';
import type { GameAction } from './actions';
import type { InputManager } from './InputManager';
import { joystickVector, knobOffset } from './joystick';

/** Raio útil do direcional (px): arrastar até aqui = velocidade máxima. */
const JOYSTICK_RADIUS = 56;

function button(label: string, action: GameAction, className: string, aria: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `touch-btn ${className}`;
  el.textContent = label;
  el.dataset.action = action;
  el.setAttribute('aria-label', aria);
  return el;
}

/**
 * Controles de tela para celular deitado:
 * - metade esquerda: direcional. Fica visível em repouso no canto e "nasce" onde
 *   o polegar toca;
 * - metade direita: arrastar gira a câmera;
 * - canto direito: PULAR (grande) com CORRER, APONTAR e INVERTER em arco ao
 *   redor, e a intensidade da gravidade logo abaixo do relógio.
 * Só aparecem os botões dos poderes liberados no desafio atual.
 */
export class TouchControls {
  readonly root: HTMLDivElement;
  private readonly moveZone: HTMLDivElement;
  private readonly lookZone: HTMLDivElement;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly cluster: HTMLDivElement;
  private readonly intensityBox: HTMLDivElement;
  private readonly runButton: HTMLButtonElement;
  private readonly intensityButtons = new Map<GravityLevel, HTMLButtonElement>();
  private movePointer: number | null = null;
  private lookPointer: number | null = null;
  private originX = 0;
  private originY = 0;
  private lookX = 0;
  private lookY = 0;

  constructor(parent: HTMLElement, private readonly input: InputManager) {
    this.root = document.createElement('div');
    this.root.className = 'touch-layer';
    this.root.dataset.testid = 'touch-controls';

    this.moveZone = document.createElement('div');
    this.moveZone.className = 'touch-zone touch-zone-move';
    this.lookZone = document.createElement('div');
    this.lookZone.className = 'touch-zone touch-zone-look';

    this.base = document.createElement('div');
    this.base.className = 'joystick';
    this.base.dataset.testid = 'joystick';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.append(this.knob);

    this.cluster = document.createElement('div');
    this.cluster.className = 'touch-cluster';
    this.runButton = button('CORRER', 'sprint', 'touch-run', 'Correr (liga e desliga)');
    this.runButton.setAttribute('aria-pressed', 'false');
    const jump = button('PULAR', 'jump', 'touch-jump', 'Pular');
    this.cluster.append(this.runButton, jump);

    this.intensityBox = document.createElement('div');
    this.intensityBox.className = 'touch-intensity';
    this.intensityBox.setAttribute('role', 'group');
    this.intensityBox.setAttribute('aria-label', 'Intensidade da gravidade');

    this.root.append(this.moveZone, this.lookZone, this.base, this.cluster, this.intensityBox);
    parent.append(this.root);

    this.moveZone.addEventListener('pointerdown', (e) => this.startMove(e));
    this.lookZone.addEventListener('pointerdown', (e) => this.startLook(e));
    this.root.addEventListener('pointermove', (e) => this.onMove(e));
    this.root.addEventListener('pointerup', (e) => this.onEnd(e));
    this.root.addEventListener('pointercancel', (e) => this.onEnd(e));
    this.root.addEventListener('pointerdown', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.touch-btn');
      if (!target?.dataset.action) return;
      e.preventDefault();
      target.classList.add('pressed');
      this.input.touchAction(target.dataset.action as GameAction);
    });
    const release = (e: Event) => (e.target as HTMLElement).closest('.touch-btn')?.classList.remove('pressed');
    this.root.addEventListener('pointerup', release);
    this.root.addEventListener('pointercancel', release);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.rest();
  }

  /** Mostra só os botões dos poderes liberados. */
  setPowers(powers: readonly Power[]): void {
    this.cluster.querySelectorAll('.touch-power').forEach((el) => el.remove());
    if (powers.includes('aim')) {
      this.cluster.append(
        button('APONTAR', 'aim', 'touch-power touch-aim', 'Apontar a gravidade para onde a câmera olha'),
      );
    }
    if (powers.includes('flip')) {
      this.cluster.append(button('INVERTER', 'flip', 'touch-power touch-flip', 'Inverter a gravidade'));
    }

    this.intensityBox.replaceChildren();
    this.intensityButtons.clear();
    this.intensityBox.hidden = !powers.includes('intensity');
    if (powers.includes('intensity')) {
      for (const [level, label] of [
        ['leve', 'LEVE'],
        ['normal', 'NORMAL'],
        ['pesada', 'PESADA'],
      ] as const) {
        const el = button(label, level, 'touch-level', `Gravidade ${label.toLowerCase()}`);
        this.intensityButtons.set(level, el);
        this.intensityBox.append(el);
      }
    }
  }

  setActiveLevel(level: GravityLevel): void {
    for (const [key, el] of this.intensityButtons) {
      el.classList.toggle('active', key === level);
      el.setAttribute('aria-pressed', String(key === level));
    }
  }

  setSprint(active: boolean): void {
    this.runButton.classList.toggle('active', active);
    this.runButton.setAttribute('aria-pressed', String(active));
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (!visible) this.reset();
  }

  /** Direcional de volta à posição de repouso (canto inferior esquerdo). */
  private rest(): void {
    this.base.classList.remove('active');
    this.base.style.transform = '';
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  private startMove(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return this.input.setMode('keyboard');
    if (this.movePointer !== null) return;
    e.preventDefault();
    this.movePointer = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.root.setPointerCapture?.(e.pointerId);
    this.base.classList.add('active');
    this.base.style.transform = `translate(${e.clientX - JOYSTICK_RADIUS}px, ${e.clientY - JOYSTICK_RADIUS}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.input.touchMove(0, 0);
  }

  private startLook(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return this.input.setMode('keyboard');
    if (this.lookPointer !== null) return;
    e.preventDefault();
    this.lookPointer = e.pointerId;
    this.lookX = e.clientX;
    this.lookY = e.clientY;
    this.root.setPointerCapture?.(e.pointerId);
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId === this.movePointer) {
      const v = joystickVector(this.originX, this.originY, e.clientX, e.clientY, JOYSTICK_RADIUS);
      const k = knobOffset(this.originX, this.originY, e.clientX, e.clientY, JOYSTICK_RADIUS);
      this.knob.style.transform = `translate(${k.x}px, ${k.y}px)`;
      this.input.touchMove(v.x, v.y);
    } else if (e.pointerId === this.lookPointer) {
      this.input.touchLook(e.clientX - this.lookX, e.clientY - this.lookY);
      this.lookX = e.clientX;
      this.lookY = e.clientY;
    }
  }

  private onEnd(e: PointerEvent): void {
    if (e.pointerId === this.movePointer) {
      this.movePointer = null;
      this.rest();
      this.input.releaseJoystick();
    } else if (e.pointerId === this.lookPointer) {
      this.lookPointer = null;
    }
  }

  private reset(): void {
    this.movePointer = null;
    this.lookPointer = null;
    this.rest();
    this.input.releaseJoystick();
  }
}
