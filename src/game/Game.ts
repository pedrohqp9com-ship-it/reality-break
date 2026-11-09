import { Quaternion, Vector3 } from 'three';
import { getLevel, nextLevel, type LevelId } from '../levels';
import type { GameAction, InputMode } from '../input/actions';
import { powerForAction } from '../input/actions';
import { HAPTIC, Haptics } from '../input/haptics';
import { InputManager } from '../input/InputManager';
import { TouchControls } from '../input/TouchControls';
import { createSharedTextures, type SharedTextures } from '../render/assets';
import { CameraRig } from '../render/CameraRig';
import { LevelView } from '../render/LevelView';
import { Renderer } from '../render/Renderer';
import { axisVector } from '../sim/axis';
import { FIXED_DT, MAX_STEPS_PER_FRAME } from '../sim/config';
import { Simulation, type SimEvent } from '../sim/simulation';
import { FixedStepper } from '../sim/stepper';
import {
  browserStorage,
  nextToPlay,
  recordCompletion,
  SaveStore,
  type Settings,
} from '../state/storage';
import { gravityArrow, gravityToast } from '../ui/format';
import { enterFullscreen, fullscreenAvailable, isFullscreen, toggleFullscreen } from '../ui/fullscreen';
import { Hud } from '../ui/Hud';
import { detectTouchDevice, OrientationGuard } from '../ui/orientation';
import { RotateOverlay } from '../ui/RotateOverlay';
import { Screens } from '../ui/Screens';

export type GameState = 'menu' | 'briefing' | 'playing' | 'paused' | 'complete' | 'defeat';

const tmpGravity = new Vector3();
const tmpVelocity = new Vector3();

/** Velocidade no plano do chão atual (m/s). */
function horizontalSpeed(sim: Simulation): number {
  const v = sim.player.body.velocity;
  const up = sim.up();
  tmpVelocity.set(v.x, v.y, v.z);
  return tmpVelocity.addScaledVector(up, -tmpVelocity.dot(up)).length();
}
const tmpInverse = new Quaternion();

/**
 * Orquestra o jogo: telas, laço principal, entrada, simulação e renderização.
 * A simulação roda em passo fixo; a imagem é desenhada a cada quadro.
 */
export class Game {
  state: GameState = 'menu';
  sim: Simulation | null = null;
  private view: LevelView | null = null;
  private readonly renderer: Renderer;
  private readonly rig: CameraRig;
  private readonly input: InputManager;
  private readonly touch: TouchControls;
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly rotateOverlay: RotateOverlay;
  private readonly orientation: OrientationGuard;
  private readonly touchDevice: boolean;
  private readonly haptics = new Haptics();
  private readonly store = new SaveStore(browserStorage());
  private readonly stepper = new FixedStepper(FIXED_DT, MAX_STEPS_PER_FRAME);
  private readonly textures: SharedTextures;
  private jumpQueued = false;
  private lastTime = 0;
  private fps = 60;
  private needsRender = true;
  private rafId = 0;
  private pausedAt = 0;

  constructor(private readonly root: HTMLElement, canvas: HTMLCanvasElement) {
    this.touchDevice = detectTouchDevice();
    const touchFirst = this.touchDevice;
    const settings = this.store.data.settings;
    this.renderer = new Renderer(canvas, settings.quality, touchFirst);
    this.rig = new CameraRig(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    this.textures = createSharedTextures();

    this.input = new InputManager(canvas, touchFirst);
    this.applySettings(settings);
    this.input.onModeChange = (mode) => this.onModeChange(mode);
    this.input.onPointerLockLost = () => {
      if (this.state === 'playing' && this.input.mode === 'keyboard') this.pause();
    };
    this.input.onZoom = (delta) => this.rig.zoom(delta);
    this.input.onSprintToggle = (active) => this.touch.setSprint(active);

    const canFullscreen = fullscreenAvailable();
    this.hud = new Hud(root, {
      onPause: () => this.pause(),
      onFullscreen: canFullscreen ? () => void toggleFullscreen() : null,
    });
    this.touch = new TouchControls(root, this.input);
    this.screens = new Screens(
      root,
      {
        play: (id) => this.loadLevel(id),
        begin: () => this.begin(),
        resume: () => this.resume(),
        restart: () => this.restart(),
        menu: () => this.toMenu(),
        next: () => {
          const next = this.sim ? nextLevel(this.sim.level.id) : null;
          if (next) this.loadLevel(next.id);
        },
        settingsChanged: (s) => this.saveSettings(s),
        openSettings: (back) => this.screens.settings(this.store.data.settings, back),
        fullscreen: () => void toggleFullscreen(),
      },
      canFullscreen,
      this.haptics.supported,
    );
    this.rotateOverlay = new RotateOverlay(root, canFullscreen, () => void enterFullscreen());
    this.orientation = new OrientationGuard(
      () => this.touchDevice || this.input.mode === 'touch',
      (blocked) => this.onOrientation(blocked),
    );
    this.rotateOverlay.setVisible(this.orientation.blocked);
    document.addEventListener('fullscreenchange', () => {
      this.hud.setFullscreen(isFullscreen());
      // Atualiza o texto "Tela cheia" / "Sair da tela cheia" das telas abertas.
      if (this.screens.current === 'menu') this.toMenu();
      else if (this.screens.current === 'pause') this.screens.pause();
      this.resize();
    });

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    this.resize();
    this.toMenu();
  }

  start(): void {
    this.lastTime = performance.now();
    const frame = (now: number) => {
      this.rafId = requestAnimationFrame(frame);
      this.frame(now);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  // ---------------------------------------------------------------- telas

  private setState(state: GameState): void {
    this.state = state;
    this.root.dataset.state = state;
    const playing = state === 'playing';
    this.input.active = playing;
    this.hud.setVisible(state === 'playing' || state === 'paused');
    this.touch.setVisible(playing && this.input.mode === 'touch');
    if (!playing) {
      this.input.clear();
      this.jumpQueued = false;
    }
    this.needsRender = true;
  }

  toMenu(): void {
    this.input.releasePointerLock();
    this.unloadLevel();
    this.setState('menu');
    const progress = this.store.data.progress;
    this.screens.mainMenu(progress, nextToPlay(progress));
  }

  loadLevel(id: LevelId): void {
    this.unloadLevel();
    const level = getLevel(id);
    const sim = new Simulation(level);
    this.sim = sim;
    this.view = new LevelView(sim, this.textures, this.renderer.profile.particles);
    this.rig.snapTo(sim, this.view.playerPosition);
    this.hud.setLevel(level, sim.plates, this.input.mode);
    this.touch.setPowers(level.powers);
    this.touch.setActiveLevel(sim.gravity.state.level);
    this.input.setTouchSprint(false);
    this.stepper.reset();
    this.setState('briefing');
    this.screens.briefing(level, this.input.mode);
  }

  private unloadLevel(): void {
    this.view?.dispose();
    this.view = null;
    this.sim = null;
  }

  begin(): void {
    if (!this.sim || this.orientation.blocked) return;
    this.screens.hide();
    this.setState('playing');
    this.stepper.reset();
    this.input.requestPointerLock();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.pausedAt = performance.now();
    this.setState('paused');
    this.input.releasePointerLock();
    this.screens.pause();
  }

  resume(): void {
    if (this.state !== 'paused' || this.orientation.blocked) return;
    this.screens.hide();
    this.setState('playing');
    this.stepper.reset();
    this.input.requestPointerLock();
  }

  restart(): void {
    if (!this.sim || !this.view) return;
    this.sim.reset();
    this.view.snap();
    this.rig.snapTo(this.sim, this.view.playerPosition);
    this.touch.setActiveLevel(this.sim.gravity.state.level);
    this.screens.hide();
    this.setState('playing');
    this.stepper.reset();
    this.input.requestPointerLock();
    this.hud.showToast('Desafio reiniciado');
  }

  private complete(time: number): void {
    if (!this.sim) return;
    const level = this.sim.level;
    const progress = this.store.data.progress;
    const record = recordCompletion(progress, level.id, time);
    this.store.save();
    this.input.releasePointerLock();
    this.setState('complete');
    this.screens.complete(level, time, progress.bestTimes[level.id] ?? time, record, !!nextLevel(level.id), {
      lives: this.sim.lives,
      maxLives: this.sim.maxLives,
    });
  }

  /** Sem vidas: tela de derrota (o progresso salvo não muda). */
  private defeat(time: number): void {
    if (!this.sim) return;
    this.input.releasePointerLock();
    this.setState('defeat');
    const done = this.sim.objectives.filter((o) => o.done).length;
    this.screens.defeat(this.sim.level, time, done, this.sim.objectives.length);
  }

  /** Celular em pé: mostra o aviso para girar e pausa o jogo. */
  private onOrientation(blocked: boolean): void {
    this.rotateOverlay.setVisible(blocked);
    if (blocked) this.pause();
    this.root.dataset.portrait = String(blocked);
  }

  /** Se o celular está em pé (o jogo fica bloqueado até girar). */
  get portraitBlocked(): boolean {
    return this.orientation.blocked;
  }

  private onModeChange(mode: InputMode): void {
    this.orientation.check();
    this.hud.setMode(mode);
    this.touch.setVisible(this.state === 'playing' && mode === 'touch');
    if (mode === 'touch') this.input.releasePointerLock();
  }

  private saveSettings(settings: Settings): void {
    const previous = this.store.data.settings;
    this.store.data.settings = settings;
    this.store.save();
    this.applySettings(settings);
    if (previous.quality !== settings.quality) this.renderer.setQuality(settings.quality);
  }

  private applySettings(settings: Settings): void {
    this.haptics.enabled = settings.vibration;
    this.input.sensitivity = settings.sensitivity;
    this.input.invertY = settings.invertY;
    this.root.dataset.fps = String(settings.showFps);
  }

  private resize(): void {
    this.renderer.applySize();
    const canvas = this.renderer.canvas;
    this.rig.resize(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    this.needsRender = true;
  }

  // ---------------------------------------------------------------- laço

  private handleAction(action: GameAction): void {
    const sim = this.sim;
    if (action === 'pause') {
      if (this.state === 'playing') this.pause();
      // No PC, Esc solta o cursor (o que já pausa) e às vezes também chega como
      // tecla: sem esta folga, a mesma tecla pausaria e despausaria o jogo.
      else if (this.state === 'paused' && performance.now() - this.pausedAt > 400) this.resume();
      return;
    }
    if (!sim || this.state !== 'playing') return;
    const power = powerForAction(action);
    if (power && !sim.gravity.has(power)) return; // poder ainda não liberado
    switch (action) {
      case 'jump':
        this.jumpQueued = true;
        break;
      case 'leve':
      case 'normal':
      case 'pesada':
        sim.setIntensity(action);
        break;
      case 'flip':
        sim.flipGravity();
        break;
      case 'aim':
        if (!sim.aimGravity()) this.hud.showToast('Já é o chão — mire em outra superfície', 1.2);
        break;
      case 'restart':
        this.restart();
        break;
    }
  }

  private handleEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'gravity':
          this.hud.showToast(gravityToast(event.change.previous, event.change.current));
          this.touch.setActiveLevel(event.change.current.level);
          this.haptics.pulse(HAPTIC.gravity);
          break;
        case 'gate':
          this.hud.showToast(event.open ? 'Barreira aberta' : 'Barreira fechada', 1.2);
          if (event.open) this.haptics.pulse(HAPTIC.gate);
          break;
        case 'checkpoint':
          this.hud.showToast('Ponto seguro registrado', 1.4);
          break;
        case 'respawn':
          this.view?.snap();
          if (this.sim && this.view) this.rig.snapTo(this.sim, this.view.playerPosition);
          break;
        case 'life-lost': {
          const cause = event.reason === 'void' ? 'Caiu no vazio' : 'Atingida por um feixe';
          const rest = event.lives === 1 ? 'resta 1 vida' : `restam ${event.lives} vidas`;
          if (event.lives > 0) this.hud.showToast(`${cause} — ${rest}`, 2.2);
          this.haptics.pulse([...HAPTIC.hurt]);
          break;
        }
        case 'defeat':
          this.defeat(event.time);
          break;
        case 'objective':
          if (event.id !== 'portal') this.hud.showToast(`Objetivo cumprido: ${event.text}`, 2);
          break;
        case 'object-reset':
          // Só avisa do Cubo Denso, que importa para o desafio; caixas voltam em silêncio.
          if (this.sim?.objects.find((o) => o.def.id === event.id)?.def.kind === 'denso') {
            this.hud.showToast('O Cubo Denso saiu da área e voltou ao início', 1.8);
          }
          break;
        case 'complete':
          this.haptics.pulse([...HAPTIC.complete]);
          this.complete(event.time);
          break;
        case 'jump':
          this.haptics.pulse(HAPTIC.jump);
          break;
        case 'land':
          // Só pousos fortes vibram (quedas longas ou gravidade pesada).
          if (event.speed > 7) this.haptics.pulse(HAPTIC.land);
          break;
      }
    }
  }

  private frame(now: number): void {
    const dt = Math.min(0.25, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.08;

    for (const action of this.input.consumeActions()) this.handleAction(action);

    const sim = this.sim;
    const view = this.view;
    let alpha = 1;
    if (sim && view && this.state === 'playing') {
      const look = this.input.consumeLook();
      sim.look(look.yaw, look.pitch);
      const { steps, alpha: a } = this.stepper.advance(dt);
      alpha = a;
      const move = this.input.move();
      const sprint = this.input.sprint();
      for (let i = 0; i < steps && this.state === 'playing'; i++) {
        view.beforeStep();
        sim.step({ move, jump: this.jumpQueued, sprint });
        this.jumpQueued = false;
        view.afterStep();
        this.handleEvents(sim.drainEvents());
      }
      this.renderer.trackFrame(dt);
    }

    const animate = this.state === 'playing' || this.state === 'briefing';
    if (!sim || !view || (!animate && !this.needsRender)) return;
    this.needsRender = false;

    const frameDt = animate ? dt : 0;
    view.update(frameDt, alpha, this.rig.up, this.rig.forward);
    this.rig.update(frameDt, sim, view.playerPosition);

    if (this.state === 'playing' || this.state === 'paused') {
      // Gravidade no espaço da câmera, para a seta da bússola.
      tmpInverse.copy(this.rig.camera.quaternion).invert();
      const g = axisVector(sim.gravity.state.axis, tmpGravity).applyQuaternion(tmpInverse);
      this.hud.update(frameDt, {
        time: sim.time,
        gravity: sim.gravity.state,
        arrow: gravityArrow(g.x, g.y, g.z),
        aim: sim.aimPreview(),
        plates: sim.plates,
        gates: sim.gates,
        hint: sim.activeHint(),
        mode: this.input.mode,
        fps: this.store.data.settings.showFps ? this.fps : null,
        lives: sim.lives,
        maxLives: sim.maxLives,
        objectives: sim.objectives,
      });
    }
    this.renderer.webgl.render(view.scene, this.rig.camera);
  }

  /** Estado resumido (usado pelos testes de ponta a ponta com ?debug). */
  debugState() {
    const sim = this.sim;
    const p = sim?.player.position;
    return {
      state: this.state,
      screen: this.screens.current,
      portraitBlocked: this.orientation.blocked,
      fullscreen: isFullscreen(),
      mode: this.input.mode,
      level: sim?.level.id ?? null,
      player: p ? { x: p.x, y: p.y, z: p.z } : null,
      grounded: sim?.player.grounded ?? false,
      sprint: this.input.sprint(),
      speed: sim ? horizontalSpeed(sim) : 0,
      gravity: sim ? { ...sim.gravity.state } : null,
      plates: sim?.plates.map((pl) => ({ id: pl.def.id, force: pl.force, active: pl.active })) ?? [],
      gates: sim?.gates.map((g) => ({ id: g.def.id, open: g.open })) ?? [],
      time: sim?.time ?? 0,
      completed: sim?.completed ?? false,
      defeated: sim?.defeated ?? false,
      lives: sim?.lives ?? 0,
      objectives: sim?.objectives.map((o) => ({ id: o.def.id, done: o.done })) ?? [],
      pixelRatio: this.renderer.pixelRatio,
      fps: this.fps,
      progress: this.store.data.progress,
    };
  }
}
