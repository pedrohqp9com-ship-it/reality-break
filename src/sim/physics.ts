import {
  Body,
  Box,
  ContactMaterial,
  GSSolver,
  Material,
  RaycastResult,
  SAPBroadphase,
  Sphere,
  Vec3,
  World,
  type ContactEquation,
} from 'cannon-es';
import { GROUP, MATERIALS, PLAYER, PLAYER_CONTACT_RELAXATION, TERMINAL_SPEED } from './config';
import type { Vec3Like } from './axis';

export interface PhysicsMaterials {
  readonly scenery: Material;
  readonly object: Material;
  readonly player: Material;
}

export interface PhysicsWorld {
  readonly world: World;
  readonly materials: PhysicsMaterials;
}

/** Cria o mundo físico (cannon-es) com materiais e contatos configurados. */
export function createPhysicsWorld(): PhysicsWorld {
  const world = new World();
  world.broadphase = new SAPBroadphase(world);
  // Sem "sono": um cubo parado sobre uma placa precisa continuar gerando contato
  // para que a placa meça a força dele. Com poucas dezenas de corpos, o custo é baixo.
  world.allowSleep = false;
  const solver = new GSSolver();
  solver.iterations = 12;
  world.solver = solver;

  const scenery = new Material('scenery');
  const object = new Material('object');
  const player = new Material('player');

  const objectContact = {
    friction: MATERIALS.objectFriction,
    restitution: MATERIALS.objectRestitution,
  };
  world.addContactMaterial(new ContactMaterial(object, scenery, objectContact));
  world.addContactMaterial(new ContactMaterial(object, object, objectContact));
  // O jogador anda por propulsão própria; sem atrito ele não "gruda" em paredes.
  const playerContact = {
    friction: 0,
    restitution: 0,
    contactEquationRelaxation: PLAYER_CONTACT_RELAXATION,
  };
  world.addContactMaterial(new ContactMaterial(player, scenery, playerContact));
  world.addContactMaterial(new ContactMaterial(player, object, playerContact));

  return { world, materials: { scenery, object, player } };
}

export function vec3(v: Vec3Like): Vec3 {
  return new Vec3(v.x, v.y, v.z);
}

export function createStaticBox(
  physics: PhysicsWorld,
  center: Vec3Like,
  size: Vec3Like,
): Body {
  const body = new Body({
    mass: 0,
    type: Body.STATIC,
    shape: new Box(new Vec3(size.x / 2, size.y / 2, size.z / 2)),
    position: vec3(center),
    material: physics.materials.scenery,
    collisionFilterGroup: GROUP.STATIC,
    collisionFilterMask: GROUP.ALL,
  });
  physics.world.addBody(body);
  return body;
}

export function createDynamicBox(
  physics: PhysicsWorld,
  center: Vec3Like,
  edge: number,
  mass: number,
): Body {
  const half = edge / 2;
  const body = new Body({
    mass,
    shape: new Box(new Vec3(half, half, half)),
    position: vec3(center),
    material: physics.materials.object,
    collisionFilterGroup: GROUP.OBJECT,
    collisionFilterMask: GROUP.ALL,
    linearDamping: 0.01,
    angularDamping: 0.1,
  });
  physics.world.addBody(body);
  return body;
}

export function createPlayerBody(physics: PhysicsWorld, center: Vec3Like): Body {
  const body = new Body({
    mass: PLAYER.mass,
    shape: new Sphere(PLAYER.radius),
    position: vec3(center),
    material: physics.materials.player,
    collisionFilterGroup: GROUP.PLAYER,
    collisionFilterMask: GROUP.ALL,
    linearDamping: 0,
    fixedRotation: true,
  });
  body.updateMassProperties();
  physics.world.addBody(body);
  return body;
}

/** Liga ou desliga as colisões de um corpo (usado pelas barreiras de energia). */
export function setCollidable(body: Body, collidable: boolean): void {
  body.collisionFilterMask = collidable ? GROUP.ALL : 0;
}

/** Limita a velocidade dos corpos dinâmicos à velocidade terminal. */
export function clampSpeed(body: Body, maxSpeed = TERMINAL_SPEED): void {
  const speed = body.velocity.length();
  if (speed > maxSpeed) body.velocity.scale(maxSpeed / speed, body.velocity);
}

export interface Region {
  readonly min: Vec3Like;
  readonly max: Vec3Like;
}

/**
 * Força (N) que os corpos fazem contra o cenário fixo dentro de uma região (a
 * área de uma placa de pressão), na direção `normal` (para fora da superfície).
 *
 * O solucionador do cannon-es guarda em `multiplier` a força de cada contato
 * resolvido no último passo. Somamos os contatos com corpos estáticos cujo ponto
 * de contato cai dentro da região. Assim a placa pode ser só uma área marcada de
 * uma parede ou piso contínuo — sem emendas em que objetos enganchariam.
 */
export function surfaceForceInRegion(
  contacts: readonly ContactEquation[],
  region: Region,
  normal: Vec3Like,
): number {
  let total = 0;
  for (const contact of contacts) {
    const { bi, bj } = contact;
    const iStatic = bi.type === Body.STATIC;
    const jStatic = bj.type === Body.STATIC;
    if (iStatic === jStatic) continue;
    const surface = iStatic ? bi : bj;
    const r = iStatic ? contact.ri : contact.rj;
    const px = surface.position.x + r.x;
    const py = surface.position.y + r.y;
    const pz = surface.position.z + r.z;
    if (
      px < region.min.x || px > region.max.x ||
      py < region.min.y || py > region.max.y ||
      pz < region.min.z || pz > region.max.z
    ) {
      continue;
    }
    // `ni` aponta de bi para bj; com o sinal, aponta da superfície para o corpo.
    const sign = iStatic ? 1 : -1;
    const n = contact.ni;
    const along = sign * (n.x * normal.x + n.y * normal.y + n.z * normal.z);
    if (along > 0 && contact.multiplier > 0) total += contact.multiplier * along;
  }
  return total;
}

export interface RayHit {
  readonly distance: number;
  readonly point: Vec3Like;
  readonly normal: Vec3Like;
  readonly body: Body;
}

const rayResult = new RaycastResult();
const rayFrom = new Vec3();
const rayTo = new Vec3();

export function raycast(
  world: World,
  from: Vec3Like,
  to: Vec3Like,
  mask: number,
): RayHit | null {
  rayResult.reset();
  rayFrom.set(from.x, from.y, from.z);
  rayTo.set(to.x, to.y, to.z);
  const hit = world.raycastClosest(
    rayFrom,
    rayTo,
    { collisionFilterMask: mask, skipBackfaces: true },
    rayResult,
  );
  if (!hit || !rayResult.body) return null;
  const p = rayResult.hitPointWorld;
  const n = rayResult.hitNormalWorld;
  return {
    distance: rayResult.distance,
    point: { x: p.x, y: p.y, z: p.z },
    normal: { x: n.x, y: n.y, z: n.z },
    body: rayResult.body,
  };
}
