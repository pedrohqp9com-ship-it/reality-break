import { Vec3, type Body, type World } from 'cannon-es';
import { Vector3 } from 'three';
import { PLAYER } from './config';
import { createPlayerBody, type PhysicsWorld } from './physics';
import type { Vec3Like } from './axis';

export interface MoveInput {
  /** -1 (esquerda) a 1 (direita). */
  readonly x: number;
  /** -1 (trás) a 1 (frente). */
  readonly y: number;
}

const tmpVel = new Vector3();
const tmpHorizontal = new Vector3();
const tmpDesired = new Vector3();
const tmpForce = new Vec3();

/**
 * Jogador: uma esfera física (sonda) que se move por propulsão no plano
 * perpendicular à gravidade atual. Não há atalhos: ela cai, colide e empurra
 * objetos pelo mesmo motor de física que move todo o resto.
 */
export class Player {
  readonly body: Body;
  grounded = false;
  /** Direção (no mundo) para onde a sonda se moveu por último. */
  readonly facing = new Vector3(0, 0, -1);
  private coyote = 0;
  private jumpBuffer = 0;
  /** Velocidade de queda logo antes de tocar o chão (para efeitos visuais). */
  lastImpactSpeed = 0;
  /** Tempo contínuo fora do chão (s). */
  airTime = 0;

  constructor(physics: PhysicsWorld, spawn: Vec3Like) {
    this.body = createPlayerBody(physics, spawn);
  }

  get position(): Vec3 {
    return this.body.position;
  }

  /**
   * Aplica a propulsão e o pulo antes de um passo da física.
   * @returns true se o jogador pulou neste passo.
   */
  preStep(
    dt: number,
    move: MoveInput,
    jumpPressed: boolean,
    forward: Vector3,
    right: Vector3,
    up: Vector3,
  ): boolean {
    const body = this.body;
    const v = tmpVel.set(body.velocity.x, body.velocity.y, body.velocity.z);
    const vUp = v.dot(up);
    const horizontal = tmpHorizontal.copy(v).addScaledVector(up, -vUp);

    let mx = move.x;
    let my = move.y;
    const length = Math.hypot(mx, my);
    if (length > 1) {
      mx /= length;
      my /= length;
    }
    const desired = tmpDesired
      .copy(forward)
      .multiplyScalar(my)
      .addScaledVector(right, mx)
      .multiplyScalar(PLAYER.moveSpeed);
    if (desired.lengthSq() > 0.01) this.facing.copy(desired).normalize();

    const response = this.grounded ? PLAYER.groundResponse : PLAYER.airResponse;
    const maxAccel = this.grounded ? PLAYER.groundAccel : PLAYER.airAccel;
    const accel = desired.sub(horizontal).multiplyScalar(response);
    if (accel.length() > maxAccel) accel.setLength(maxAccel);
    tmpForce.set(accel.x * body.mass, accel.y * body.mass, accel.z * body.mass);
    body.applyForce(tmpForce);

    this.coyote = this.grounded ? PLAYER.coyoteTime : Math.max(0, this.coyote - dt);
    this.jumpBuffer = jumpPressed ? PLAYER.jumpBuffer : Math.max(0, this.jumpBuffer - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      const newVel = v.addScaledVector(up, PLAYER.jumpSpeed - vUp);
      body.velocity.set(newVel.x, newVel.y, newVel.z);
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      return true;
    }
    return false;
  }

  /**
   * Depois do passo: está no chão se algum contato empurra a esfera "para cima"
   * (no referencial da gravidade atual) e ela não está subindo.
   * @returns true no passo em que a sonda pousa depois de um tempo no ar
   * (ignora as perdas de contato de um único passo ao quicar).
   */
  postStep(world: World, up: Vector3, dt: number): boolean {
    const body = this.body;
    const v = body.velocity;
    const vUp = v.x * up.x + v.y * up.y + v.z * up.z;
    let grounded = false;
    if (vUp < 1) {
      for (const contact of world.contacts) {
        let sign: number;
        if (contact.bj === body) sign = 1;
        else if (contact.bi === body) sign = -1;
        else continue;
        const n = contact.ni;
        const dot = sign * (n.x * up.x + n.y * up.y + n.z * up.z);
        if (dot > PLAYER.groundNormalMin) {
          grounded = true;
          break;
        }
      }
    }
    const landed = grounded && !this.grounded && this.airTime > 0.15;
    this.grounded = grounded;
    if (grounded) {
      this.airTime = 0;
    } else {
      this.airTime += dt;
      this.lastImpactSpeed = Math.max(0, -vUp);
    }
    return landed;
  }

  teleport(position: Vec3Like): void {
    this.body.position.set(position.x, position.y, position.z);
    this.body.previousPosition.copy(this.body.position);
    this.body.interpolatedPosition.copy(this.body.position);
    this.body.velocity.set(0, 0, 0);
    this.body.force.set(0, 0, 0);
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airTime = 0;
  }
}
