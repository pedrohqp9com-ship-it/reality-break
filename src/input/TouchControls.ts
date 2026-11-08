import type { GravityLevel, Power } from '../sim/gravity';
import type { GameAction } from './actions';
import type { InputManager } from './InputManager';
import { joystickVector, knobOffset } from './joystick';

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
 * Controles de tela para celular: metade esquerda = direcional que nasce onde o
 * polegar toca; metade direita = arrastar para olhar; botões para pular e para
 * os poderes liberados no desafio atual (poderes bloqueados não aparecem).
 */
export class TouchControls {
  readonly root: HTMLDivElement;
  private readonly moveZone: HTMLDivElement;
  private readonly lookZone: HTMLDivElement;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly powerBox: HTMLDivElement;
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
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.append(this.knob);

    this.powerBox = document.createElement('div');
    this.powerBox.className = 'touch-powers';
    const jump = button('PULAR', 'jump', 'touch-jump', 'Pular');

    this.root.append(this.moveZone, this.lookZone, this.base, this.powerBox, jump);
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
  }

  /** Mostra só os botões dos poderes liberados. */
  setPowers(powers: readonly Power[]): void {
    this.powerBox.replaceChildren();
    this.intensityButtons.clear();
    if (powers.includes('intensity')) {
      const group = document.createElement('div');
      group.className = 'touch-intensity';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Intensidade da gravidade');
      for (const [level, label] of [
        ['leve', 'LEVE'],
        ['normal', 'NORMAL'],
        ['pesada', 'PESADA'],
      ] as const) {
        const el = button(label, level, 'touch-level', `Gravidade ${label.toLowerCase()}`);
        this.intensityButtons.set(level, el);
        group.append(el);
      }
      this.powerBox.append(group);
    }
    if (powers.includes('flip')) {
      this.powerBox.append(button('INVERTER', 'flip', 'touch-power', 'Inverter a gravidade'));
    }
    if (powers.includes('aim')) {
      this.powerBox.append(
        button('APONTAR', 'aim', 'touch-power', 'Apontar a gravidade para onde a câmera olha'),
      );
    }
  }

  setActiveLevel(level: GravityLevel): void {
    for (const [key, el] of this.intensityButtons) {
      el.classList.toggle('active', key === level);
      el.setAttribute('aria-pressed', String(key === level));
    }
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (!visible) this.reset();
  }

  private startMove(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return this.input.setMode('keyboard');
    if (this.movePointer !== null) return;
    e.preventDefault();
    this.movePointer = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.root.setPointerCapture?.(e.pointerId);
    this.base.style.transform = `translate(${e.clientX - JOYSTICK_RADIUS}px, ${e.clientY - JOYSTICK_RADIUS}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.add('visible');
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
      this.base.classList.remove('visible');
      this.input.releaseJoystick();
    } else if (e.pointerId === this.lookPointer) {
      this.lookPointer = null;
    }
  }

  private reset(): void {
    this.movePointer = null;
    this.lookPointer = null;
    this.base.classList.remove('visible');
    this.input.releaseJoystick();
  }
}
