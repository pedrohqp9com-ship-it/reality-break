import { Quaternion, Vector3 } from 'three';
import { getLevel, nextLevel, type LevelId } from '../levels';
import type { GameAction, InputMode } from '../input/actions';
import { powerForAction } from '../input/actions';
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
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';

export type GameState = 'menu' | 'briefing' | 'playing' | 'paused' | 'complete';

const tmpGravity = new Vector3();
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
    const touchFirst = window.matchMedia?.('(pointer: coarse)').matches ?? false;
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

    this.hud = new Hud(root, () => this.pause());
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
        fullscreen: () => this.enterFullscreen(),
      },
      !!document.fullscreenEnabled,
    );

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
    if (!this.sim) return;
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
    if (this.state !== 'paused') return;
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
    this.screens.complete(level, time, progress.bestTimes[level.id] ?? time, record, !!nextLevel(level.id));
  }

  private enterFullscreen(): void {
    const element = document.documentElement;
    element
      .requestFullscreen?.({ navigationUI: 'hide' })
      .then(() => {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>;
        };
        return orientation?.lock?.('landscape');
      })
      .catch(() => undefined);
  }

  private onModeChange(mode: InputMode): void {
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
          break;
        case 'gate':
          this.hud.showToast(event.open ? 'Barreira aberta' : 'Barreira fechada', 1.2);
          break;
        case 'checkpoint':
          this.hud.showToast('Ponto seguro registrado', 1.4);
          break;
        case 'respawn':
          this.view?.snap();
          if (this.sim && this.view) this.rig.snapTo(this.sim, this.view.playerPosition);
          this.hud.showToast('Você caiu no vazio — de volta ao ponto seguro', 2.2);
          break;
        case 'object-reset':
          this.hud.showToast('Um objeto saiu da área e voltou ao início', 1.6);
          break;
        case 'complete':
          this.complete(event.time);
          break;
        case 'jump':
        case 'land':
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
      for (let i = 0; i < steps && this.state === 'playing'; i++) {
        view.beforeStep();
        sim.step({ move, jump: this.jumpQueued });
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
      mode: this.input.mode,
      level: sim?.level.id ?? null,
      player: p ? { x: p.x, y: p.y, z: p.z } : null,
      grounded: sim?.player.grounded ?? false,
      gravity: sim ? { ...sim.gravity.state } : null,
      plates: sim?.plates.map((pl) => ({ id: pl.def.id, force: pl.force, active: pl.active })) ?? [],
      gates: sim?.gates.map((g) => ({ id: g.def.id, open: g.open })) ?? [],
      time: sim?.time ?? 0,
      completed: sim?.completed ?? false,
      pixelRatio: this.renderer.pixelRatio,
      fps: this.fps,
      progress: this.store.data.progress,
    };
  }
}
