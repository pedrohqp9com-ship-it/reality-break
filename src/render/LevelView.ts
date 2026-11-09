import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  DirectionalLight,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  BoxGeometry,
  type Material,
} from 'three';
import type { SurfaceStyle } from '../levels/types';
import { axisVector } from '../sim/axis';
import { PLAYER } from '../sim/config';
import { GRAVITY_MULTIPLIER } from '../sim/gravity';
import { FIXED_DT } from '../sim/config';
import { hazardActive, hazardCenter, hazardWarning } from '../sim/hazards';
import type { Simulation } from '../sim/simulation';
import type { SharedTextures } from './assets';
import { boxEdgesGeometry, mergeBoxes } from './geometry';

const BACKGROUND = 0x05070f;
const PLATE_IDLE = new Color(0xff4466);
const DENSE_COLOR = 0xff8a3d;

const tmpVec = new Vector3();
const tmpVec2 = new Vector3();
const tmpUp = new Vector3();
const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const ZERO = new Vector3();
const Z_AXIS = new Vector3(0, 0, 1);

interface BodySnapshot {
  readonly prev: Vector3;
  readonly curr: Vector3;
  readonly prevQ: Quaternion;
  readonly currQ: Quaternion;
}

function snapshot(): BodySnapshot {
  return { prev: new Vector3(), curr: new Vector3(), prevQ: new Quaternion(), currQ: new Quaternion() };
}

/**
 * Tudo o que aparece na tela para um desafio. Só lê a simulação: a imagem nunca
 * altera a física. Posições são interpoladas entre dois passos da física.
 */
export class LevelView {
  readonly scene = new Scene();
  readonly playerPosition = new Vector3();
  private readonly disposables: { dispose(): void }[] = [];
  private readonly objectMeshes: Mesh[] = [];
  private readonly objectSnapshots: BodySnapshot[] = [];
  private readonly playerSnapshot = snapshot();
  private readonly plateMaterials: MeshLambertMaterial[] = [];
  private readonly gateMaterials: MeshBasicMaterial[] = [];
  private readonly hazardMeshes: { mesh: Mesh; glow: MeshBasicMaterial; core: MeshBasicMaterial }[] = [];
  private readonly avatar = new Group();
  private readonly avatarRing: Mesh;
  private readonly portal = new Group();
  private readonly portalDisc: Mesh;
  private readonly portalRings: Mesh[] = [];
  private readonly marker: Mesh;
  private readonly markerMaterial: MeshBasicMaterial;
  private particles!: Points;
  private particleVelocity = new Vector3();
  private elapsed = 0;
  private readonly accent: Color;

  constructor(
    private readonly sim: Simulation,
    private readonly textures: SharedTextures,
    particleCount: number,
  ) {
    const level = sim.level;
    this.accent = new Color(level.accent);
    this.scene.background = new Color(BACKGROUND);
    this.scene.fog = new FogExp2(BACKGROUND, 0.018);

    this.scene.add(new HemisphereLight(0xa8e8ff, 0x2a1640, 2.2));
    const sun = new DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.4, 1, 0.3);
    this.scene.add(sun);

    this.buildScenery();
    this.buildPlatesAndGates();
    this.buildHazards();
    this.buildObjects();
    this.avatarRing = this.buildAvatar();
    this.portalDisc = this.buildPortal();
    this.markerMaterial = this.track(
      new MeshBasicMaterial({
        color: this.accent,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.marker = new Mesh(this.track(new RingGeometry(0.32, 0.46, 32)), this.markerMaterial);
    this.marker.renderOrder = 2;
    this.scene.add(this.marker);
    this.buildStars();
    this.buildParticles(particleCount);
    this.snap();
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  private buildScenery(): void {
    const level = this.sim.level;
    const styles: Record<SurfaceStyle, Material> = {
      floor: this.track(
        new MeshLambertMaterial({
          color: 0x1c2740,
          emissive: this.accent,
          emissiveMap: this.textures.grid,
          emissiveIntensity: 0.85,
        }),
      ),
      wall: this.track(
        new MeshLambertMaterial({
          color: 0x131a2c,
          emissive: this.accent,
          emissiveMap: this.textures.grid,
          emissiveIntensity: 0.32,
        }),
      ),
      accent: this.track(new MeshBasicMaterial({ color: this.accent })),
    };
    for (const style of ['floor', 'wall', 'accent'] as const) {
      const geometry = mergeBoxes(level.statics.filter((s) => s.style === style));
      if (!geometry) continue;
      this.track(geometry);
      this.scene.add(new Mesh(geometry, styles[style]));
    }
    const edges = new LineSegments(
      this.track(boxEdgesGeometry(level.statics.filter((s) => s.style !== 'accent'))),
      this.track(new LineBasicMaterial({ color: this.accent, transparent: true, opacity: 0.55 })),
    );
    this.scene.add(edges);
  }

  private buildPlatesAndGates(): void {
    for (const plate of this.sim.plates) {
      const material = this.track(
        new MeshLambertMaterial({
          color: 0x22192a,
          emissive: PLATE_IDLE.clone(),
          emissiveMap: this.textures.frame,
          emissiveIntensity: 0.8,
        }),
      );
      // A moldura acompanha a placa inteira, não a grade do mundo.
      const mesh = new Mesh(this.track(new BoxGeometry(...plate.def.size)), material);
      mesh.position.set(...plate.def.center);
      this.plateMaterials.push(material);
      this.scene.add(mesh);
    }
    for (const gate of this.sim.gates) {
      const texture = this.textures.stripes.clone();
      texture.repeat.set(Math.max(gate.def.size[0], gate.def.size[2]) / 2, gate.def.size[1] / 2);
      this.track(texture);
      const material = this.track(
        new MeshBasicMaterial({
          color: 0x7af6ff,
          map: texture,
          transparent: true,
          opacity: 0.55,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      const mesh = new Mesh(this.track(new BoxGeometry(...gate.def.size)), material);
      mesh.position.set(...gate.def.center);
      mesh.renderOrder = 3;
      this.gateMaterials.push(material);
      this.scene.add(mesh);
    }
  }

  /** Feixes de energia: halo transparente + núcleo brilhante. */
  private buildHazards(): void {
    for (const hazard of this.sim.level.hazards) {
      const glow = this.track(
        new MeshBasicMaterial({
          color: 0xff2a6d,
          transparent: true,
          opacity: 0.55,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      const core = this.track(
        new MeshBasicMaterial({ color: 0xffd1e0, transparent: true, opacity: 0.95, depthWrite: false }),
      );
      const mesh = new Mesh(this.track(new BoxGeometry(...hazard.size)), glow);
      const inner = new Mesh(this.track(new BoxGeometry(...hazard.size)), core);
      // Núcleo fino no meio do feixe (reduz as duas menores dimensões).
      const [sx, sy, sz] = hazard.size;
      const longest = Math.max(sx, sy, sz);
      inner.scale.set(sx === longest ? 1 : 0.3, sy === longest ? 1 : 0.3, sz === longest ? 1 : 0.3);
      mesh.add(inner);
      mesh.renderOrder = 4;
      this.hazardMeshes.push({ mesh, glow, core });
      this.scene.add(mesh);
    }
  }

  private buildObjects(): void {
    const dense = this.track(
      new MeshLambertMaterial({
        color: 0x3b2a20,
        emissive: DENSE_COLOR,
        emissiveMap: this.textures.frame,
        emissiveIntensity: 1,
      }),
    );
    const crate = this.track(
      new MeshLambertMaterial({
        color: 0x1d2a3d,
        emissive: this.accent,
        emissiveMap: this.textures.frame,
        emissiveIntensity: 0.7,
      }),
    );
    for (const object of this.sim.objects) {
      const geometry = this.track(new BoxGeometry(object.def.edge, object.def.edge, object.def.edge));
      const mesh = new Mesh(geometry, object.def.kind === 'denso' ? dense : crate);
      this.objectMeshes.push(mesh);
      this.objectSnapshots.push(snapshot());
      this.scene.add(mesh);
    }
  }

  private buildAvatar(): Mesh {
    const r = PLAYER.radius;
    const shell = new Mesh(
      this.track(new SphereGeometry(r, 32, 20)),
      this.track(new MeshLambertMaterial({ color: 0x2a3550, emissive: 0x0a1630 })),
    );
    const ring = new Mesh(
      this.track(new TorusGeometry(r * 1.12, 0.035, 8, 48)),
      this.track(new MeshBasicMaterial({ color: this.accent })),
    );
    ring.rotation.x = Math.PI / 2; // anel no "plano do chão" da gravidade atual
    const visor = new Mesh(
      this.track(new SphereGeometry(r * 0.32, 16, 12)),
      this.track(new MeshBasicMaterial({ color: 0xeaffff })),
    );
    visor.scale.set(1.5, 0.6, 0.5);
    visor.position.set(0, r * 0.25, r * 0.88);
    const core = new Mesh(
      this.track(new SphereGeometry(r * 0.18, 12, 8)),
      this.track(new MeshBasicMaterial({ color: this.accent })),
    );
    core.position.set(0, -r * 0.55, r * 0.72);
    this.avatar.add(shell, ring, visor, core);
    this.scene.add(this.avatar);
    return ring;
  }

  private buildPortal(): Mesh {
    const { center, normal, radius } = this.sim.level.portal;
    const ringMaterial = this.track(new MeshBasicMaterial({ color: this.accent }));
    const outer = new Mesh(this.track(new TorusGeometry(radius, 0.08, 12, 64)), ringMaterial);
    const inner = new Mesh(
      this.track(new TorusGeometry(radius * 0.82, 0.03, 8, 64)),
      this.track(new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })),
    );
    const disc = new Mesh(
      this.track(new CircleGeometry(radius * 0.95, 48)),
      this.track(
        new MeshBasicMaterial({
          color: this.accent,
          map: this.textures.portal,
          transparent: true,
          opacity: 0.9,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      ),
    );
    this.portalRings.push(outer, inner);
    this.portal.add(outer, inner, disc);
    this.portal.position.set(...center);
    this.portal.quaternion.setFromUnitVectors(Z_AXIS, axisVector(normal));
    this.scene.add(this.portal);
    return disc;
  }

  private buildStars(): void {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = 140 + Math.random() * 40;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = Math.cos(theta) * s * r;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = Math.sin(theta) * s * r;
    }
    const geometry = this.track(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const material = this.track(
      new PointsMaterial({ color: 0xbfd8ff, size: 1.6, sizeAttenuation: false, fog: false }),
    );
    this.scene.add(new Points(geometry, material));
  }

  /** Poeira que cai na direção e na intensidade da gravidade atual. */
  private buildParticles(count: number): void {
    const positions = new Float32Array(count * 3);
    const spawn = this.sim.level.spawn;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = spawn[0] + (Math.random() * 2 - 1) * PARTICLE_RANGE;
      positions[i * 3 + 1] = spawn[1] + (Math.random() * 2 - 1) * PARTICLE_RANGE;
      positions[i * 3 + 2] = spawn[2] + (Math.random() * 2 - 1) * PARTICLE_RANGE;
    }
    const geometry = this.track(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const material = this.track(
      new PointsMaterial({
        color: this.accent,
        map: this.textures.dot,
        size: 0.14,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.particles = new Points(geometry, material);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  /** Chamado depois de cada passo da física. */
  afterStep(): void {
    const p = this.sim.player.body.position;
    this.playerSnapshot.curr.set(p.x, p.y, p.z);
    this.sim.objects.forEach((object, i) => {
      const snap = this.objectSnapshots[i]!;
      const b = object.body;
      snap.curr.set(b.position.x, b.position.y, b.position.z);
      snap.currQ.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    });
  }

  /** Antes de um passo: o atual vira o anterior. */
  beforeStep(): void {
    this.playerSnapshot.prev.copy(this.playerSnapshot.curr);
    for (const snap of this.objectSnapshots) {
      snap.prev.copy(snap.curr);
      snap.prevQ.copy(snap.currQ);
    }
  }

  /** Teletransportes (respawn, reinício) não devem ser interpolados. */
  snap(): void {
    this.afterStep();
    this.beforeStep();
  }

  update(dt: number, alpha: number, visualUp: Vector3, cameraForward: Vector3): void {
    this.elapsed += dt;
    const sim = this.sim;
    const ps = this.playerSnapshot;
    this.playerPosition.lerpVectors(ps.prev, ps.curr, alpha);

    // Sonda: anel no plano perpendicular à gravidade, visor para onde ela anda.
    this.avatar.position.copy(this.playerPosition);
    const facing = tmpVec.copy(sim.player.facing);
    facing.addScaledVector(visualUp, -facing.dot(visualUp));
    if (facing.lengthSq() < 1e-4) {
      facing.copy(cameraForward).addScaledVector(visualUp, -cameraForward.dot(visualUp));
    }
    if (facing.lengthSq() > 1e-6) {
      facing.normalize();
      tmpMatrix.lookAt(facing, ZERO, visualUp);
      tmpQuat.setFromRotationMatrix(tmpMatrix);
      this.avatar.quaternion.slerp(tmpQuat, 1 - Math.exp(-dt * 14));
    }
    this.avatarRing.rotation.z += dt * (sim.player.grounded ? 1.2 : 4);

    this.objectMeshes.forEach((mesh, i) => {
      const snap = this.objectSnapshots[i]!;
      mesh.position.lerpVectors(snap.prev, snap.curr, alpha);
      mesh.quaternion.slerpQuaternions(snap.prevQ, snap.currQ, alpha);
    });

    sim.plates.forEach((plate, i) => {
      const material = this.plateMaterials[i]!;
      const ratio = Math.min(1, plate.force / plate.def.threshold);
      if (plate.active) material.emissive.copy(this.accent);
      else material.emissive.copy(PLATE_IDLE);
      material.emissiveIntensity = plate.active ? 1.6 : 0.35 + ratio * 0.9;
    });
    sim.gates.forEach((gate, i) => {
      const material = this.gateMaterials[i]!;
      const target = gate.open ? 0.04 : 0.55 + Math.sin(this.elapsed * 6) * 0.06;
      material.opacity += (target - material.opacity) * (1 - Math.exp(-dt * 10));
      if (material.map && !gate.open) material.map.offset.x = (this.elapsed * 0.6) % 1;
    });

    // Feixes no instante que está na tela (entre os dois últimos passos da física).
    const renderTime = Math.max(0, sim.time - FIXED_DT + alpha * FIXED_DT);
    sim.level.hazards.forEach((hazard, i) => {
      const { mesh, glow, core } = this.hazardMeshes[i]!;
      mesh.position.set(...hazardCenter(hazard, renderTime));
      const active = hazardActive(hazard, renderTime);
      const warning = hazardWarning(hazard, renderTime);
      const flicker = Math.sin(this.elapsed * 40) > 0 ? 1 : 0.4;
      glow.opacity = active ? 0.5 + Math.sin(this.elapsed * 9) * 0.08 : warning ? 0.25 * flicker : 0.05;
      core.opacity = active ? 0.95 : warning ? 0.5 * flicker : 0;
    });

    // Proteção depois de perder uma vida: a sonda pisca.
    this.avatar.visible = sim.invulnerable <= 0 || Math.floor(this.elapsed * 12) % 2 === 0;

    this.portalRings[0]!.rotation.z += dt * 0.6;
    this.portalRings[1]!.rotation.z -= dt * 1.4;
    this.portalDisc.rotation.z -= dt * 2.2;
    const pulse = 1 + Math.sin(this.elapsed * 3) * 0.04;
    this.portal.scale.setScalar(pulse);

    this.updateMarker();
    this.updateParticles(dt);
  }

  /** Marcador no ponto onde a sonda cairia, seguindo a gravidade atual. */
  private updateMarker(): void {
    const sim = this.sim;
    const down = axisVector(sim.gravity.state.axis, tmpVec2);
    const from = this.playerPosition;
    const to = tmpVec.copy(from).addScaledVector(down, 40);
    const hit = sim.raycastSolid(from, to);
    if (!hit) {
      this.marker.visible = false;
      return;
    }
    this.marker.visible = true;
    const n = tmpUp.set(hit.normal.x, hit.normal.y, hit.normal.z);
    this.marker.position.set(hit.point.x, hit.point.y, hit.point.z).addScaledVector(n, 0.03);
    this.marker.quaternion.setFromUnitVectors(Z_AXIS, n);
    const distance = Math.max(0, hit.distance - PLAYER.radius);
    this.marker.scale.setScalar(1 + Math.min(distance, 12) * 0.05);
    this.markerMaterial.opacity = Math.max(0.2, 0.75 - distance * 0.04);
  }

  private updateParticles(dt: number): void {
    const state = this.sim.gravity.state;
    const speed = 1.6 * Math.sqrt(GRAVITY_MULTIPLIER[state.level]);
    const target = axisVector(state.axis, tmpVec).multiplyScalar(speed);
    // A poeira muda de direção suavemente, como se tivesse inércia.
    this.particleVelocity.lerp(target, 1 - Math.exp(-dt * 3));
    const v = this.particleVelocity;
    const attribute = this.particles.geometry.getAttribute('position') as BufferAttribute;
    const array = attribute.array as Float32Array;
    const c = this.playerPosition;
    const range = PARTICLE_RANGE;
    for (let i = 0; i < array.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const center = k === 0 ? c.x : k === 1 ? c.y : c.z;
        const vk = k === 0 ? v.x : k === 1 ? v.y : v.z;
        let value = array[i + k]! + vk * dt;
        if (value > center + range) value -= range * 2;
        else if (value < center - range) value += range * 2;
        array[i + k] = value;
      }
    }
    attribute.needsUpdate = true;
  }

  dispose(): void {
    for (const resource of this.disposables) resource.dispose();
    this.disposables.length = 0;
    this.scene.clear();
  }
}

const PARTICLE_RANGE = 12;
