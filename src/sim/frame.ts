import { Quaternion, Vector3 } from 'three';
import { axisVector, oppositeAxis, type Axis, type Vec3Like } from './axis';

const LOCAL_UP = new Vector3(0, 1, 0);
const LOCAL_FORWARD = new Vector3(0, 0, -1);
const LOCAL_RIGHT = new Vector3(1, 0, 0);

const tmpUp = new Vector3();
const tmpTarget = new Vector3();
const tmpAxis = new Vector3();
const tmpRotation = new Quaternion();
const tmpYaw = new Quaternion();
const tmpPitch = new Quaternion();
const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);

/**
 * Referencial do jogador: leva o "para cima" local (Y) para o oposto da gravidade.
 * O ângulo horizontal da câmera (yaw) é medido dentro deste referencial, então o
 * controle continua natural quando o jogador anda em paredes ou no teto.
 */
export class GravityFrame {
  readonly quaternion = new Quaternion();

  constructor(gravityAxis: Axis = '-y') {
    this.reset(gravityAxis);
  }

  reset(gravityAxis: Axis = '-y'): void {
    this.quaternion.identity();
    if (gravityAxis !== '-y') this.rotateTo('-y', gravityAxis, LOCAL_FORWARD);
  }

  up(target = new Vector3()): Vector3 {
    return target.copy(LOCAL_UP).applyQuaternion(this.quaternion);
  }

  /**
   * Gira o referencial quando a gravidade troca de eixo. Usa a menor rotação que
   * leva o "para cima" antigo ao novo. Numa inversão (180°), gira em torno da
   * direção para onde o jogador olha: ele continua olhando para o mesmo lado,
   * agora de cabeça para baixo.
   */
  rotateTo(fromGravity: Axis, toGravity: Axis, hintForward: Vec3Like): void {
    if (fromGravity === toGravity) return;
    const fromUp = axisVector(oppositeAxis(fromGravity), tmpUp);
    const toUp = axisVector(oppositeAxis(toGravity), tmpTarget);

    if (fromUp.dot(toUp) < -0.5) {
      tmpAxis.set(hintForward.x, hintForward.y, hintForward.z);
      tmpAxis.addScaledVector(fromUp, -tmpAxis.dot(fromUp));
      if (tmpAxis.lengthSq() < 1e-8) tmpAxis.copy(LOCAL_RIGHT).applyQuaternion(this.quaternion);
      tmpAxis.normalize();
      tmpRotation.setFromAxisAngle(tmpAxis, Math.PI);
    } else {
      tmpRotation.setFromUnitVectors(fromUp, toUp);
    }
    this.quaternion.premultiply(tmpRotation).normalize();

    // Corrige o acúmulo de erro numérico: o "para cima" fica exatamente no eixo.
    const actualUp = this.up(tmpUp);
    tmpRotation.setFromUnitVectors(actualUp, toUp);
    this.quaternion.premultiply(tmpRotation).normalize();
  }

  /** Direções de movimento (frente e direita) no plano perpendicular à gravidade. */
  moveBasis(yaw: number, forward: Vector3, right: Vector3): void {
    tmpYaw.setFromAxisAngle(Y_AXIS, yaw).premultiply(this.quaternion);
    forward.copy(LOCAL_FORWARD).applyQuaternion(tmpYaw);
    right.copy(LOCAL_RIGHT).applyQuaternion(tmpYaw);
  }

  /** Orientação da câmera: referencial × yaw × pitch. */
  viewQuaternion(yaw: number, pitch: number, target = new Quaternion(), base = this.quaternion) {
    tmpYaw.setFromAxisAngle(Y_AXIS, yaw);
    tmpPitch.setFromAxisAngle(X_AXIS, pitch);
    return target.copy(base).multiply(tmpYaw).multiply(tmpPitch);
  }

  /** Direção para onde a câmera olha (inclui a inclinação vertical). */
  lookDirection(yaw: number, pitch: number, target = new Vector3()): Vector3 {
    const q = this.viewQuaternion(yaw, pitch, tmpRotation);
    return target.copy(LOCAL_FORWARD).applyQuaternion(q);
  }
}
