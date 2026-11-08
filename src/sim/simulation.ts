import type { Body } from 'cannon-es';
import { Vector3 } from 'three';
import type {
  Aabb,
  CheckpointDef,
  DynamicBoxDef,
  GateDef,
  LevelDef,
  PlateDef,
  StaticBoxDef,
  Vec3Tuple,
} from '../levels/types';
import { axisVector, type Axis, type Vec3Like } from './axis';
import { FIXED_DT, GROUP, PLATE, PLAYER } from './config';
import { GravityFrame } from './frame';
import {
  DEFAULT_GRAVITY,
  GravityController,
  gravityVector,
  type GravityChange,
  type GravityLevel,
} from './gravity';
import {
  clampSpeed,
  createDynamicBox,
  createPhysicsWorld,
  createStaticBox,
  raycast,
  setCollidable,
  surfaceForceInRegion,
  type PhysicsWorld,
  type RayHit,
  type Region,
} from './physics';
import { Player, type MoveInput } from './player';

export interface SimInput {
  readonly move: MoveInput;
  /** Pulo pressionado desde o último passo. */
  readonly jump: boolean;
}

export type SimEvent =
  | { readonly type: 'gravity'; readonly change: GravityChange }
  | { readonly type: 'jump' }
  | { readonly type: 'land'; readonly speed: number }
  | { readonly type: 'gate'; readonly id: string; readonly open: boolean }
  | { readonly type: 'checkpoint'; readonly id: string }
  | { readonly type: 'respawn' }
  | { readonly type: 'object-reset'; readonly id: string }
  | { readonly type: 'complete'; readonly time: number };

export interface StaticRuntime {
  readonly def: StaticBoxDef;
  readonly body: Body;
}

export interface ObjectRuntime {
  readonly def: DynamicBoxDef;
  readonly body: Body;
}

export interface PlateRuntime {
  readonly def: PlateDef;
  /** Área sensível (inclui uma folga na espessura para a penetração dos contatos). */
  readonly region: Region;
  /** Força medida (N), suavizada. */
  force: number;
  /** Tempo (s) com a força acima do limite, até `PLATE.holdTime`. */
  hold: number;
  active: boolean;
}

export interface GateRuntime {
  readonly def: GateDef;
  readonly body: Body;
  open: boolean;
}

const PITCH_MIN = -1.25;
const PITCH_MAX = 1.1;
const DEFAULT_PITCH = -0.28;

const tmpForward = new Vector3();
const tmpRight = new Vector3();
const tmpUp = new Vector3();
const tmpGravity = new Vector3();
const tmpLook = new Vector3();

function toVec(t: Vec3Tuple): Vec3Like {
  return { x: t[0], y: t[1], z: t[2] };
}

/** Área sensível de uma placa, com 0,15 m de folga para cada lado da superfície. */
export function plateRegion(def: PlateDef): Region {
  const margin = 0.15;
  const [cx, cy, cz] = def.center;
  const [sx, sy, sz] = def.size;
  return {
    min: { x: cx - sx / 2 - margin, y: cy - sy / 2 - margin, z: cz - sz / 2 - margin },
    max: { x: cx + sx / 2 + margin, y: cy + sy / 2 + margin, z: cz + sz / 2 + margin },
  };
}

export function insideAabb(p: Vec3Like, box: Aabb, margin = 0): boolean {
  return (
    p.x >= box.min[0] - margin &&
    p.x <= box.max[0] + margin &&
    p.y >= box.min[1] - margin &&
    p.y <= box.max[1] + margin &&
    p.z >= box.min[2] - margin &&
    p.z <= box.max[2] + margin
  );
}

/**
 * Simulação completa de um desafio, sem nenhuma dependência de renderização.
 * Os testes automatizados usam esta classe diretamente para provar que as
 * mecânicas funcionam (e que os desafios exigem os poderes certos).
 */
export class Simulation {
  readonly physics: PhysicsWorld;
  readonly gravity: GravityController;
  readonly frame: GravityFrame;
  readonly player: Player;
  readonly statics: StaticRuntime[];
  readonly objects: ObjectRuntime[];
  readonly plates: PlateRuntime[];
  readonly gates: GateRuntime[];
  readonly view = { yaw: 0, pitch: DEFAULT_PITCH };

  /** Tempo de jogo (s) desde o início/reinício do desafio. */
  time = 0;
  completed = false;
  private respawnPoint: Vec3Tuple;
  private respawnYaw: number;
  private checkpointId: string | null = null;
  private events: SimEvent[] = [];

  constructor(readonly level: LevelDef) {
    this.physics = createPhysicsWorld();
    this.gravity = new GravityController(new Set(level.powers), DEFAULT_GRAVITY);
    this.frame = new GravityFrame(DEFAULT_GRAVITY.axis);
    this.applyWorldGravity();

    this.statics = level.statics.map((def) => ({
      def,
      body: createStaticBox(this.physics, toVec(def.center), toVec(def.size)),
    }));
    this.plates = level.plates.map((def) => ({
      def,
      region: plateRegion(def),
      force: 0,
      hold: 0,
      active: false,
    }));
    this.gates = level.gates.map((def) => ({
      def,
      body: createStaticBox(this.physics, toVec(def.center), toVec(def.size)),
      open: false,
    }));
    this.objects = level.objects.map((def) => ({
      def,
      body: createDynamicBox(this.physics, toVec(def.center), def.edge, def.mass),
    }));
    this.player = new Player(this.physics, toVec(level.spawn));
    this.respawnPoint = level.spawn;
    this.respawnYaw = level.yaw;
    this.view.yaw = level.yaw;
  }

  get world() {
    return this.physics.world;
  }

  /** Recomeça o desafio do zero (posições, gravidade, barreiras e tempo). */
  reset(): void {
    this.time = 0;
    this.completed = false;
    this.checkpointId = null;
    this.respawnPoint = this.level.spawn;
    this.respawnYaw = this.level.yaw;
    for (const object of this.objects) this.resetObject(object, false);
    for (const plate of this.plates) {
      plate.force = 0;
      plate.hold = 0;
      plate.active = false;
    }
    for (const gate of this.gates) this.setGate(gate, false, false);
    this.respawn(false);
    this.events = [];
  }

  look(deltaYaw: number, deltaPitch: number): void {
    this.view.yaw = (this.view.yaw + deltaYaw) % (Math.PI * 2);
    this.view.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.view.pitch + deltaPitch));
  }

  lookDirection(target = new Vector3()): Vector3 {
    return this.frame.lookDirection(this.view.yaw, this.view.pitch, target);
  }

  up(target = new Vector3()): Vector3 {
    return axisVector(this.gravity.state.axis, target).negate();
  }

  setIntensity(level: GravityLevel): GravityChange | null {
    return this.onGravityChange(this.gravity.setLevel(level));
  }

  flipGravity(): GravityChange | null {
    return this.onGravityChange(this.gravity.flip());
  }

  aimGravity(): GravityChange | null {
    return this.onGravityChange(this.gravity.aim(this.lookDirection(tmpLook)));
  }

  /** Eixo que "apontar" escolheria agora (para a interface mostrar antes). */
  aimPreview(): Axis | null {
    if (!this.gravity.has('aim')) return null;
    return this.gravity.previewAim(this.lookDirection(tmpLook));
  }

  step(input: SimInput, dt = FIXED_DT): void {
    if (this.completed) return;
    const up = this.up(tmpUp);
    this.frame.moveBasis(this.view.yaw, tmpForward, tmpRight);
    if (this.player.preStep(dt, input.move, input.jump, tmpForward, tmpRight, up)) {
      this.events.push({ type: 'jump' });
    }

    this.world.step(dt);
    this.time += dt;

    for (const object of this.objects) clampSpeed(object.body);
    clampSpeed(this.player.body);

    if (this.player.postStep(this.world, up, dt)) {
      this.events.push({ type: 'land', speed: this.player.lastImpactSpeed });
    }
    this.updatePlates(dt);
    this.updateCheckpoints();
    this.updateBounds();
    this.updatePortal();
  }

  drainEvents(): SimEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  /** Dica da zona onde a sonda está (texto com marcadores de controle). */
  activeHint(): string | null {
    const p = this.player.position;
    for (const hint of this.level.hints) if (insideAabb(p, hint.zone)) return hint.text;
    return null;
  }

  /** Raio contra o cenário fixo (usado pela câmera para não atravessar paredes). */
  raycastScenery(from: Vec3Like, to: Vec3Like): RayHit | null {
    return raycast(this.world, from, to, GROUP.STATIC);
  }

  /** Raio contra cenário e objetos (usado pelo marcador de queda). */
  raycastSolid(from: Vec3Like, to: Vec3Like): RayHit | null {
    return raycast(this.world, from, to, GROUP.STATIC | GROUP.OBJECT);
  }

  private onGravityChange(change: GravityChange | null): GravityChange | null {
    if (!change) return null;
    if (change.previous.axis !== change.current.axis) {
      this.frame.moveBasis(this.view.yaw, tmpForward, tmpRight);
      this.frame.rotateTo(change.previous.axis, change.current.axis, tmpForward);
    }
    this.applyWorldGravity();
    this.events.push({ type: 'gravity', change });
    return change;
  }

  private applyWorldGravity(): void {
    const g = gravityVector(this.gravity.state, tmpGravity);
    this.world.gravity.set(g.x, g.y, g.z);
  }

  private updatePlates(dt: number): void {
    if (this.plates.length === 0) return;
    const blend = 1 - Math.exp(-dt / PLATE.smoothing);
    for (const plate of this.plates) {
      const normal = axisVector(plate.def.normal, tmpLook);
      const raw = surfaceForceInRegion(this.world.contacts, plate.region, normal);
      plate.force += (raw - plate.force) * blend;
      const threshold = plate.def.threshold;
      if (plate.active) {
        plate.active = plate.force >= threshold * PLATE.releaseRatio;
        if (!plate.active) plate.hold = 0;
      } else {
        plate.hold = plate.force >= threshold ? plate.hold + dt : 0;
        plate.active = plate.hold >= PLATE.holdTime - 1e-9;
      }
    }
    for (const gate of this.gates) {
      const wantsOpen = this.plates.some((p) => p.def.gate === gate.def.id && p.active);
      // Trava de segurança: a barreira não se fecha sobre algo que a atravessa.
      if (!wantsOpen && gate.open && this.somethingInside(gate)) continue;
      this.setGate(gate, wantsOpen, true);
    }
  }

  private somethingInside(gate: GateRuntime): boolean {
    const { center, size } = gate.def;
    const box: Aabb = {
      min: [center[0] - size[0] / 2, center[1] - size[1] / 2, center[2] - size[2] / 2],
      max: [center[0] + size[0] / 2, center[1] + size[1] / 2, center[2] + size[2] / 2],
    };
    if (insideAabb(this.player.position, box, PLAYER.radius)) return true;
    return this.objects.some((o) => {
      const half = (o.def.edge * Math.sqrt(3)) / 2;
      return insideAabb(o.body.position, box, half);
    });
  }

  private setGate(gate: GateRuntime, open: boolean, emit: boolean): void {
    if (gate.open === open) return;
    gate.open = open;
    setCollidable(gate.body, !open);
    if (emit) this.events.push({ type: 'gate', id: gate.def.id, open });
  }

  private updateCheckpoints(): void {
    const p = this.player.position;
    for (const checkpoint of this.level.checkpoints) {
      if (checkpoint.id !== this.checkpointId && insideAabb(p, checkpoint.zone)) {
        this.activateCheckpoint(checkpoint);
      }
    }
  }

  private activateCheckpoint(checkpoint: CheckpointDef): void {
    this.checkpointId = checkpoint.id;
    this.respawnPoint = checkpoint.spawn;
    this.respawnYaw = checkpoint.yaw;
    this.events.push({ type: 'checkpoint', id: checkpoint.id });
  }

  private updateBounds(): void {
    if (!insideAabb(this.player.position, this.level.bounds)) this.respawn(true);
    for (const object of this.objects) {
      const home = object.def.home ?? this.level.bounds;
      if (!insideAabb(object.body.position, home)) this.resetObject(object, true);
    }
  }

  private resetObject(object: ObjectRuntime, emit: boolean): void {
    const body = object.body;
    const [x, y, z] = object.def.center;
    body.position.set(x, y, z);
    body.previousPosition.copy(body.position);
    body.interpolatedPosition.copy(body.position);
    body.quaternion.set(0, 0, 0, 1);
    body.previousQuaternion.copy(body.quaternion);
    body.interpolatedQuaternion.copy(body.quaternion);
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    if (emit) this.events.push({ type: 'object-reset', id: object.def.id });
  }

  /** Volta ao último ponto seguro com a gravidade inicial do desafio. */
  private respawn(emit: boolean): void {
    const change = this.gravity.reset();
    this.frame.reset(this.gravity.state.axis);
    this.applyWorldGravity();
    this.player.teleport(toVec(this.respawnPoint));
    this.view.yaw = this.respawnYaw;
    this.view.pitch = DEFAULT_PITCH;
    if (emit) {
      if (change) this.events.push({ type: 'gravity', change });
      this.events.push({ type: 'respawn' });
    }
  }

  private updatePortal(): void {
    const { center, radius } = this.level.portal;
    const p = this.player.position;
    const d = Math.hypot(p.x - center[0], p.y - center[1], p.z - center[2]);
    if (d <= radius) {
      this.completed = true;
      this.events.push({ type: 'complete', time: this.time });
    }
  }
}
