import { Vector3 } from 'three';
import type { Vec3Like } from '../sim/axis';
import type { SimInput, Simulation } from '../sim/simulation';
import { distanceAlongPlane, IDLE, runUntil, steerTowards } from './helpers';

/**
 * "Robôs" que resolvem cada desafio usando só os comandos que uma pessoa usa
 * (direcional, pulo, poderes e câmera). Servem de prova automatizada de que os
 * desafios têm solução com a física real — sem teletransporte nem atalhos.
 */

function goTo(sim: Simulation, target: Vec3Like, tolerance = 0.35, maxSeconds = 20, jump = false) {
  return runUntil(
    sim,
    maxSeconds,
    (s) => steerTowards(s, target, jump && s.player.grounded),
    (s) => distanceAlongPlane(s, target) < tolerance,
  );
}

/** Empurra um objeto até `goal` (no plano do chão atual), corrigindo a rota. */
function push(sim: Simulation, objectId: string, goal: Vec3Like, tolerance = 0.3, maxSeconds = 40) {
  const object = sim.objects.find((o) => o.def.id === objectId);
  if (!object) throw new Error(objectId);
  const up = sim.up();
  const planar = (v: Vector3) => v.addScaledVector(up, -v.dot(up));
  return runUntil(
    sim,
    maxSeconds,
    (s): SimInput => {
      const c = object.body.position;
      const toGoal = planar(new Vector3(goal.x - c.x, goal.y - c.y, goal.z - c.z));
      const dir = toGoal.lengthSq() > 1e-6 ? toGoal.normalize() : toGoal;
      const behind = new Vector3(c.x, c.y, c.z).addScaledVector(dir, -(object.def.edge / 2 + 0.75));
      const p = s.player.position;
      const toBehind = planar(new Vector3(behind.x - p.x, behind.y - p.y, behind.z - p.z));
      if (toBehind.length() > 0.45) {
        // Contorna o objeto: se o ponto de empurrar está do outro lado, desvia para o lado.
        const toObject = planar(new Vector3(c.x - p.x, c.y - p.y, c.z - p.z));
        const side = new Vector3().crossVectors(up, dir).normalize();
        if (toObject.dot(dir) < 0 && toObject.length() < object.def.edge + 1.2) {
          const detour = new Vector3(c.x, c.y, c.z).addScaledVector(side, object.def.edge + 0.8);
          return steerTowards(s, detour);
        }
        return steerTowards(s, behind);
      }
      // Empurra mais devagar perto do destino para o objeto não passar do ponto.
      const remaining = toGoal.length();
      const target = new Vector3(p.x, p.y, p.z).addScaledVector(dir, Math.max(0.3, remaining));
      return steerTowards(s, target, false, 0.5);
    },
    () => {
      const c = object.body.position;
      const near = planar(new Vector3(goal.x - c.x, goal.y - c.y, goal.z - c.z)).length() < tolerance;
      return near && object.body.velocity.length() < 0.2;
    },
  );
}

function hold(sim: Simulation, seconds: number) {
  runUntil(sim, seconds, IDLE, () => false);
}

export function solveLeveza(sim: Simulation): boolean {
  sim.setIntensity('leve');
  // Corre até a parede da plataforma pulando: em gravidade Leve, o salto alcança o topo.
  const onTop = runUntil(
    sim,
    15,
    (s) => steerTowards(s, { x: 0, y: 0, z: -14 }, s.player.grounded && s.player.position.z < -9),
    (s) => s.player.position.y > 3.4 && s.player.grounded,
  );
  if (!onTop) return false;
  sim.setIntensity('normal');
  if (!push(sim, 'cubo-denso', { x: 2, y: 3.7, z: -22 })) return false;
  hold(sim, 0.5);
  sim.setIntensity('pesada');
  hold(sim, 0.5);
  // Sai da frente do cubo e vai até o portal pela barreira aberta.
  if (!goTo(sim, { x: -2, y: 3.7, z: -24 })) return false;
  return runUntil(sim, 20, (s) => steerTowards(s, { x: 0, y: 4.6, z: -34 }), (s) => s.completed);
}

export function solveInversao(sim: Simulation): boolean {
  // Cai para o teto e atravessa a fresta.
  sim.flipGravity();
  hold(sim, 1.5);
  if (!goTo(sim, { x: 0, y: 8.5, z: -30 }, 0.5, 20)) return false;
  // Volta para o chão sobre a ilha (o teto tem um vão à frente).
  sim.flipGravity();
  hold(sim, 1.6);
  if (!goTo(sim, { x: 0, y: 0.5, z: -38.2 }, 0.4, 15)) return false;
  // Sobe de novo para o teto, depois do vão, e vai até o portal.
  sim.flipGravity();
  hold(sim, 1.6);
  return runUntil(sim, 15, (s) => steerTowards(s, { x: 0, y: 8.5, z: -46 }), (s) => s.completed);
}

export function solveOrientacao(sim: Simulation): boolean {
  // Olha para a parede norte e aponta a gravidade para ela: a sonda e o cubo caem para lá.
  sim.view.yaw = 0;
  sim.view.pitch = 0;
  if (!sim.aimGravity()) return false;
  hold(sim, 2.5);
  // Empurra o cubo pela quina (parede norte + chão original) até a placa.
  if (!push(sim, 'cubo-denso', { x: 0, y: 0.5, z: -7.5 }, 0.35)) return false;
  hold(sim, 0.5);
  sim.setIntensity('pesada');
  hold(sim, 0.5);
  if (!sim.gates[0]?.open) return false;
  // Sobe pela parede contornando a sacada e para logo acima dela.
  if (!goTo(sim, { x: 4.5, y: 9, z: -7.5 }, 0.5)) return false;
  if (!goTo(sim, { x: 4.5, y: 16, z: -7.5 }, 0.5)) return false;
  if (!goTo(sim, { x: 0, y: 16, z: -7.5 }, 0.4)) return false;
  // Olha para o chão original (atrás, no referencial da parede) e aponta.
  sim.view.yaw = Math.PI;
  sim.view.pitch = 0;
  if (!sim.aimGravity()) return false;
  hold(sim, 1.5);
  return runUntil(sim, 15, (s) => steerTowards(s, { x: 0, y: 14.5, z: -6.3 }), (s) => s.completed);
}
