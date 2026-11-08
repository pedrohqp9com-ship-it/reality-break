import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { Simulation } from '../sim/simulation';

const LOCAL_UP = new Vector3(0, 1, 0);
const LOCAL_BACK = new Vector3(0, 0, 1);
const LOCAL_FORWARD = new Vector3(0, 0, -1);

const tmpPivot = new Vector3();
const tmpDesired = new Vector3();
const tmpOffset = new Vector3();
const tmpQuat = new Quaternion();

/** Distâncias da câmera (m). A roda do mouse ajusta dentro deste intervalo. */
export const CAMERA_DISTANCE = { min: 3, max: 10, default: 6.2 } as const;

/**
 * Câmera em terceira pessoa que orbita a sonda. O referencial visual acompanha o
 * da gravidade com uma transição suave (o mundo "gira" quando a gravidade muda),
 * e a câmera se aproxima quando há uma parede entre ela e a sonda.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly visualFrame = new Quaternion();
  readonly up = new Vector3(0, 1, 0);
  readonly forward = new Vector3(0, 0, -1);
  desiredDistance: number = CAMERA_DISTANCE.default;
  private distance: number = CAMERA_DISTANCE.default;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(70, aspect, 0.1, 400);
  }

  zoom(delta: number): void {
    this.desiredDistance = Math.min(
      CAMERA_DISTANCE.max,
      Math.max(CAMERA_DISTANCE.min, this.desiredDistance + delta),
    );
  }

  /** Sem transição (ao começar, reiniciar ou voltar a um ponto seguro). */
  snapTo(sim: Simulation, target: Vector3): void {
    this.visualFrame.copy(sim.frame.quaternion);
    this.distance = this.desiredDistance;
    this.update(0, sim, target);
  }

  update(dt: number, sim: Simulation, target: Vector3): void {
    const blend = dt > 0 ? 1 - Math.exp(-dt / 0.14) : 1;
    this.visualFrame.slerp(sim.frame.quaternion, blend).normalize();
    this.up.copy(LOCAL_UP).applyQuaternion(this.visualFrame);

    const view = sim.frame.viewQuaternion(sim.view.yaw, sim.view.pitch, tmpQuat, this.visualFrame);
    this.forward.copy(LOCAL_FORWARD).applyQuaternion(view);

    const pivot = tmpPivot.copy(target).addScaledVector(this.up, 0.7);
    tmpOffset.copy(LOCAL_BACK).applyQuaternion(view);
    tmpDesired.copy(pivot).addScaledVector(tmpOffset, this.desiredDistance + 0.4);

    // Se uma parede está no caminho, aproxima a câmera para não atravessá-la.
    let allowed = this.desiredDistance;
    const hit = sim.raycastScenery(pivot, tmpDesired);
    if (hit) allowed = Math.max(0.6, hit.distance - 0.4);
    if (allowed < this.distance) this.distance = allowed;
    else this.distance += (allowed - this.distance) * (dt > 0 ? 1 - Math.exp(-dt / 0.25) : 1);

    this.camera.position.copy(pivot).addScaledVector(tmpOffset, this.distance);
    this.camera.quaternion.copy(view);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    // Em retrato (celular em pé), abre o campo de visão para enxergar mais dos lados.
    this.camera.fov = aspect < 1 ? 82 : 70;
    this.camera.updateProjectionMatrix();
  }
}
