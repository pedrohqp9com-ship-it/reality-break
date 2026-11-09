import {
  isMoveKey,
  KEY_ACTIONS,
  moveFromKeys,
  SPRINT_KEYS,
  type GameAction,
  type InputMode,
} from './actions';

/** Radianos por pixel (antes do ajuste de sensibilidade). */
const MOUSE_LOOK = 0.0024;
const TOUCH_LOOK = 0.0058;
/**
 * Alguns navegadores mandam um movimento de mouse "fantasma" (às vezes enorme)
 * logo depois da captura do cursor. Ignoramos esse instante e picos absurdos,
 * para a câmera não dar um salto ao começar a jogar.
 */
const LOCK_SETTLE_MS = 120;
const MAX_MOUSE_STEP = 250;

export interface LookDelta {
  yaw: number;
  pitch: number;
}

/**
 * Junta teclado, mouse e toque em um único estado de controle por quadro.
 * Nada aqui mexe no jogo diretamente: o laço principal lê os comandos e os
 * aplica na simulação.
 */
export class InputManager {
  sensitivity = 1;
  invertY = false;
  mode: InputMode;
  onModeChange: ((mode: InputMode) => void) | null = null;
  onPointerLockLost: (() => void) | null = null;
  onZoom: ((delta: number) => void) | null = null;
  onSprintToggle: ((active: boolean) => void) | null = null;
  /** Só gera comandos de jogo quando ativo (fora de menus e pausa). */
  active = false;

  private readonly keys = new Set<string>();
  private readonly actions: GameAction[] = [];
  private lookYaw = 0;
  private lookPitch = 0;
  private joystick = { x: 0, y: 0 };
  /** Corrida ligada pelo botão de toque (fica ligada até tocar de novo). */
  private touchSprint = false;
  private dragPointer: number | null = null;
  private dragX = 0;
  private dragY = 0;
  private ignoreMouseUntil = 0;
  private readonly cleanup: (() => void)[] = [];

  constructor(private readonly canvas: HTMLCanvasElement, touchFirst: boolean) {
    this.mode = touchFirst ? 'touch' : 'keyboard';
    this.listen(window, 'keydown', (e) => this.onKeyDown(e as KeyboardEvent));
    this.listen(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code));
    this.listen(window, 'blur', () => this.keys.clear());
    this.listen(document, 'mousemove', (e) => this.onMouseMove(e as MouseEvent));
    this.listen(document, 'pointerlockchange', () => {
      if (this.pointerLocked) this.ignoreMouseUntil = performance.now() + LOCK_SETTLE_MS;
      else this.onPointerLockLost?.();
    });
    this.listen(canvas, 'pointerdown', (e) => this.onCanvasPointerDown(e as PointerEvent));
    this.listen(window, 'pointermove', (e) => this.onCanvasPointerMove(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => {
      if ((e as PointerEvent).pointerId === this.dragPointer) this.dragPointer = null;
    });
    this.listen(canvas, 'wheel', (e) => {
      const wheel = e as WheelEvent;
      wheel.preventDefault();
      this.onZoom?.(Math.sign(wheel.deltaY) * 0.6);
    }, { passive: false });
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
  }

  private listen(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.cleanup.push(() => target.removeEventListener(type, handler, options));
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Captura o mouse (só funciona a partir de um clique ou tecla da pessoa). */
  requestPointerLock(): void {
    if (this.mode !== 'keyboard' || this.pointerLocked || !this.canvas.requestPointerLock) return;
    try {
      const result = this.canvas.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => undefined);
    } catch {
      // Sem captura (ex.: dentro de alguns iframes): o olhar continua por arrasto.
    }
  }

  releasePointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  setMode(mode: InputMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.onModeChange?.(mode);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
    this.setMode('keyboard');
    const action = KEY_ACTIONS[event.code];
    if (isMoveKey(event.code) || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    if (isMoveKey(event.code) || SPRINT_KEYS.has(event.code)) this.keys.add(event.code);
    if (action) {
      if (action === 'pause' || this.active) this.actions.push(action);
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.active || !this.pointerLocked) return;
    if (performance.now() < this.ignoreMouseUntil) return;
    if (Math.abs(event.movementX) > MAX_MOUSE_STEP || Math.abs(event.movementY) > MAX_MOUSE_STEP) return;
    this.addLook(event.movementX * MOUSE_LOOK, event.movementY * MOUSE_LOOK);
  }

  private onCanvasPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      // O toque é tratado pelos controles de tela, que aparecem a partir daqui.
      this.setMode('touch');
      return;
    }
    this.setMode('keyboard');
    if (!this.active) return;
    if (this.pointerLocked) {
      if (event.button === 0) this.actions.push('aim');
      return;
    }
    this.requestPointerLock();
    // Sem captura do mouse, arrastar com o botão pressionado gira a câmera.
    this.dragPointer = event.pointerId;
    this.dragX = event.clientX;
    this.dragY = event.clientY;
  }

  private onCanvasPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointer || this.pointerLocked || !this.active) return;
    this.addLook((event.clientX - this.dragX) * MOUSE_LOOK, (event.clientY - this.dragY) * MOUSE_LOOK);
    this.dragX = event.clientX;
    this.dragY = event.clientY;
  }

  /** Usado pelos controles de toque. */
  touchLook(dxPixels: number, dyPixels: number): void {
    this.setMode('touch');
    if (this.active) this.addLook(dxPixels * TOUCH_LOOK, dyPixels * TOUCH_LOOK);
  }

  touchMove(x: number, y: number): void {
    this.setMode('touch');
    this.joystick = { x, y };
  }

  /** Solta o direcional sem mudar o tipo de controle em uso. */
  releaseJoystick(): void {
    this.joystick = { x: 0, y: 0 };
  }

  touchAction(action: GameAction): void {
    this.setMode('touch');
    if (action === 'sprint') {
      if (this.active) this.setTouchSprint(!this.touchSprint);
      return;
    }
    if (action === 'pause' || this.active) this.actions.push(action);
  }

  setTouchSprint(active: boolean): void {
    this.touchSprint = active;
    this.onSprintToggle?.(active);
  }

  /** Correndo: Shift segurado no teclado ou botão CORRER ligado. */
  sprint(): boolean {
    if (!this.active) return false;
    for (const code of SPRINT_KEYS) if (this.keys.has(code)) return true;
    return this.touchSprint;
  }

  private addLook(dx: number, dy: number): void {
    this.lookYaw -= dx * this.sensitivity;
    this.lookPitch -= dy * this.sensitivity * (this.invertY ? -1 : 1);
  }

  /** Movimento atual (teclado ou direcional virtual, o que estiver mais forte). */
  move(): { x: number; y: number } {
    if (!this.active) return { x: 0, y: 0 };
    const keyboard = moveFromKeys(this.keys);
    const kb = Math.hypot(keyboard.x, keyboard.y);
    const js = Math.hypot(this.joystick.x, this.joystick.y);
    return kb >= js ? keyboard : this.joystick;
  }

  consumeLook(): LookDelta {
    const delta = { yaw: this.lookYaw, pitch: this.lookPitch };
    this.lookYaw = 0;
    this.lookPitch = 0;
    return delta;
  }

  consumeActions(): GameAction[] {
    return this.actions.splice(0, this.actions.length);
  }

  /** Limpa tudo (ao pausar ou trocar de tela), para nada "vazar" para depois. */
  clear(): void {
    this.keys.clear();
    this.actions.length = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.joystick = { x: 0, y: 0 };
    this.dragPointer = null;
  }

  dispose(): void {
    for (const fn of this.cleanup) fn();
  }
}
