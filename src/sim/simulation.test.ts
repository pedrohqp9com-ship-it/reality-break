import { describe, expect, it } from 'vitest';
import { inversao } from '../levels/inversao';
import { leveza } from '../levels/leveza';
import { orientacao } from '../levels/orientacao';
import { IDLE, measureJumpHeight, run, runUntil } from '../test/helpers';
import { EARTH_GRAVITY, jumpHeight } from './gravity';
import { PLAYER, RESPAWN_INVULNERABILITY, TERMINAL_SPEED } from './config';
import { hazardCenter } from './hazards';
import { Simulation, type SimEvent } from './simulation';

function events(sim: Simulation, type: SimEvent['type']) {
  return sim.drainEvents().filter((e) => e.type === type);
}

describe('jogador e gravidade (física real)', () => {
  it('cai, pousa no chão e fica "no chão"', () => {
    const sim = new Simulation(leveza);
    run(sim, 1);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.position.y).toBeCloseTo(PLAYER.radius, 1);
  });

  it.each(['leve', 'normal', 'pesada'] as const)('salto em gravidade %s ≈ v²/2g', (level) => {
    const sim = new Simulation(leveza);
    sim.setIntensity(level);
    const measured = measureJumpHeight(sim);
    expect(measured).toBeGreaterThan(jumpHeight(PLAYER.jumpSpeed, level) * 0.9);
    expect(measured).toBeLessThan(jumpHeight(PLAYER.jumpSpeed, level) * 1.05);
  });

  it('move na direção da câmera, até a velocidade máxima', () => {
    const sim = new Simulation(leveza);
    run(sim, 0.5);
    run(sim, 0.6, { move: { x: 0, y: 1 }, jump: false });
    expect(sim.player.position.z).toBeLessThan(-3);
    const speed = Math.hypot(sim.player.body.velocity.x, sim.player.body.velocity.z);
    expect(speed).toBeGreaterThan(PLAYER.moveSpeed * 0.9);
    expect(speed).toBeLessThan(PLAYER.moveSpeed * 1.05);
  });

  it('correr: velocidade maior no chão, mesma altura de salto', () => {
    const sim = new Simulation(leveza);
    run(sim, 0.5);
    run(sim, 0.8, { move: { x: 0, y: 1 }, jump: false, sprint: true });
    const speed = Math.hypot(sim.player.body.velocity.x, sim.player.body.velocity.z);
    expect(speed).toBeGreaterThan(PLAYER.sprintSpeed * 0.9);
    expect(speed).toBeLessThan(PLAYER.sprintSpeed * 1.05);

    const jumper = new Simulation(leveza);
    run(jumper, 1);
    const y0 = jumper.player.position.y;
    let top = y0;
    jumper.step({ move: { x: 0, y: 1 }, jump: true, sprint: true });
    runUntil(jumper, 1.5, { move: { x: 0, y: 1 }, jump: false, sprint: true }, (s) => {
      top = Math.max(top, s.player.position.y);
      return false;
    });
    expect(top - y0).toBeLessThan(jumpHeight(PLAYER.jumpSpeed, 'normal') * 1.05);
  });

  it('inverter: a sonda cai para o teto e o teto vira chão', () => {
    const sim = new Simulation(inversao);
    run(sim, 0.5);
    expect(sim.flipGravity()?.current.axis).toBe('+y');
    expect(sim.world.gravity.y).toBeCloseTo(EARTH_GRAVITY);
    run(sim, 2);
    expect(sim.player.position.y).toBeCloseTo(9 - PLAYER.radius, 1);
    expect(sim.player.grounded).toBe(true);
    expect(sim.up().y).toBe(-1);
    // Os objetos também caem para o teto.
    for (const crate of sim.objects.slice(0, 3)) expect(crate.body.position.y).toBeGreaterThan(8);
  });

  it('apontar: a sonda cai na parede para onde a câmera olha', () => {
    const sim = new Simulation(orientacao);
    run(sim, 0.5);
    sim.view.yaw = Math.PI / 2; // olhando para -x (parede oeste)
    sim.view.pitch = 0;
    expect(sim.aimPreview()).toBe('-x');
    expect(sim.aimGravity()?.current.axis).toBe('-x');
    run(sim, 3);
    expect(sim.player.position.x).toBeCloseTo(-8 + PLAYER.radius, 1);
    expect(sim.player.grounded).toBe(true);
  });

  it('poderes bloqueados não fazem nada', () => {
    const sim = new Simulation(leveza);
    expect(sim.flipGravity()).toBeNull();
    expect(sim.aimGravity()).toBeNull();
    expect(sim.aimPreview()).toBeNull();
    expect(sim.gravity.state.axis).toBe('-y');
  });

  it('velocidade terminal limita quedas longas', () => {
    const sim = new Simulation(inversao);
    sim.setIntensity('pesada');
    sim.player.teleport({ x: 0, y: -2, z: -26 });
    let max = 0;
    runUntil(sim, 3, IDLE, (s) => {
      max = Math.max(max, s.player.body.velocity.length());
      return false;
    });
    expect(max).toBeLessThanOrEqual(TERMINAL_SPEED + 1e-6);
  });

  it('gera eventos de salto e pouso', () => {
    const sim = new Simulation(leveza);
    run(sim, 1);
    sim.drainEvents();
    sim.step({ move: { x: 0, y: 0 }, jump: true });
    expect(events(sim, 'jump')).toHaveLength(1);
    run(sim, 2);
    expect(events(sim, 'land')).toHaveLength(1);
  });
});

describe('placas de pressão e barreiras', () => {
  function cubeOnPlate(sim: Simulation) {
    const cube = sim.objects.find((o) => o.def.kind === 'denso')!;
    const plate = sim.plates[0]!;
    cube.body.position.set(plate.def.center[0], plate.def.center[1] + 0.55, plate.def.center[2]);
    return { cube, plate, gate: sim.gates[0]! };
  }

  it('a placa mede a força real: massa × gravidade', () => {
    const sim = new Simulation(leveza);
    const { plate, gate } = cubeOnPlate(sim);
    run(sim, 1);
    expect(plate.force).toBeGreaterThan(981 * 0.97);
    expect(plate.force).toBeLessThan(981 * 1.03);
    expect(gate.open).toBe(false);

    sim.setIntensity('pesada');
    run(sim, 1);
    expect(plate.force).toBeGreaterThan(1962 * 0.97);
    expect(gate.open).toBe(true);
    expect(sim.drainEvents()).toContainEqual({ type: 'gate', id: 'barreira', open: true });

    sim.setIntensity('leve');
    run(sim, 1);
    expect(plate.force).toBeLessThan(400);
    expect(gate.open).toBe(false);
  });

  it('a sonda sozinha (70 kg) não abre a barreira nem na gravidade Pesada', () => {
    const sim = new Simulation(leveza);
    sim.setIntensity('pesada');
    const plate = sim.plates[0]!;
    sim.player.teleport({ x: plate.def.center[0], y: 3.8, z: plate.def.center[2] });
    run(sim, 1);
    expect(plate.force).toBeGreaterThan(1300);
    expect(plate.force).toBeLessThan(1500);
    expect(sim.gates[0]!.open).toBe(false);
  });

  it('o pico de força de uma queda não abre a barreira: a força precisa durar 0,5 s', () => {
    const sim = new Simulation(orientacao);
    sim.view.yaw = 0;
    sim.view.pitch = 0;
    sim.aimGravity(); // a sonda cai 11 m e bate na placa da parede norte
    let peak = 0;
    let opened = false;
    runUntil(sim, 3, IDLE, (s) => {
      peak = Math.max(peak, s.plates[0]!.force);
      opened ||= s.gates[0]!.open;
      return false;
    });
    expect(peak).toBeGreaterThan(1500); // o impacto é real…
    expect(opened).toBe(false); // …mas curto demais para ativar a placa
    expect(sim.plates[0]!.force).toBeCloseTo(PLAYER.mass * EARTH_GRAVITY, -1);
  });

  it('barreira fechada bloqueia; aberta deixa passar', () => {
    const sim = new Simulation(leveza);
    const walk = { move: { x: 0, y: 1 }, jump: false };
    sim.player.teleport({ x: -3, y: 3.8, z: -26.6 }); // depois do feixe da plataforma
    run(sim, 2, walk);
    expect(sim.player.position.z).toBeGreaterThan(-28);

    cubeOnPlate(sim);
    sim.setIntensity('pesada');
    run(sim, 1);
    expect(sim.gates[0]!.open).toBe(true);
    run(sim, 2, walk);
    expect(sim.player.position.z).toBeLessThan(-29);
  });

  it('a barreira não se fecha sobre a sonda que está atravessando', () => {
    const sim = new Simulation(leveza);
    const { cube } = cubeOnPlate(sim);
    sim.setIntensity('pesada');
    run(sim, 1);
    sim.player.teleport({ x: -3, y: 3.75, z: -28.5 });
    cube.body.position.set(-4, 3.75, -18); // tira o cubo da placa
    run(sim, 0.3);
    expect(sim.gates[0]!.open).toBe(true);
    sim.player.teleport({ x: -3, y: 3.75, z: -23.8 }); // antes do feixe da plataforma
    run(sim, 0.3);
    expect(sim.gates[0]!.open).toBe(false);
  });

  it('placa na parede só sente força quando a gravidade aponta para ela', () => {
    const sim = new Simulation(orientacao);
    const cube = sim.objects.find((o) => o.def.kind === 'denso')!;
    const plate = sim.plates[0]!;
    // Cubo encostado na placa, mas a gravidade puxa para o chão.
    cube.body.position.set(0, 0.5, -7.48);
    run(sim, 1);
    expect(plate.force).toBeLessThan(50);
    // Gravidade apontada para a parede norte, intensidade Pesada.
    sim.view.yaw = 0;
    sim.view.pitch = 0;
    sim.aimGravity();
    sim.setIntensity('pesada');
    run(sim, 2.5);
    expect(plate.force).toBeGreaterThan(1900);
    expect(sim.gates[0]!.open).toBe(true);
  });
});

describe('vazio, pontos seguros e portal', () => {
  it('cair no vazio volta ao último ponto seguro, com a gravidade inicial', () => {
    const sim = new Simulation(inversao);
    sim.player.teleport({ x: 0, y: 0.6, z: -19 });
    run(sim, 0.2);
    expect(events(sim, 'checkpoint')).toHaveLength(1);
    sim.setIntensity('pesada');
    sim.player.teleport({ x: 0, y: -1, z: -26 }); // sobre o vão
    run(sim, 3);
    const drained = sim.drainEvents();
    expect(drained.some((e) => e.type === 'respawn')).toBe(true);
    expect(drained).toContainEqual({ type: 'life-lost', reason: 'void', lives: 2 });
    expect(sim.lives).toBe(2);
    expect(sim.player.position.z).toBeCloseTo(-19, 0);
    expect(sim.gravity.state).toEqual({ axis: '-y', level: 'normal' });
  });

  it('objetos que saem da área voltam ao ponto inicial', () => {
    const sim = new Simulation(leveza);
    const cube = sim.objects.find((o) => o.def.kind === 'denso')!;
    cube.body.position.set(0, 0.5, -5); // caiu da plataforma
    sim.step(IDLE);
    expect(cube.body.position.y).toBeCloseTo(cube.def.center[1]);
    expect(sim.drainEvents()).toContainEqual({ type: 'object-reset', id: 'cubo-denso' });
  });

  it('entrar no portal conclui o desafio e para a simulação', () => {
    const sim = new Simulation(leveza);
    const [x, y, z] = leveza.portal.center;
    sim.player.teleport({ x, y, z });
    sim.step(IDLE);
    expect(sim.completed).toBe(true);
    const complete = sim.drainEvents().find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    const t = sim.time;
    sim.step(IDLE);
    expect(sim.time).toBe(t);
  });

  it('reiniciar devolve tudo ao estado inicial', () => {
    const sim = new Simulation(orientacao);
    sim.view.pitch = 0;
    sim.aimGravity();
    sim.setIntensity('leve');
    run(sim, 2);
    sim.reset();
    expect(sim.gravity.state).toEqual({ axis: '-y', level: 'normal' });
    expect(sim.time).toBe(0);
    expect(sim.player.position.z).toBeCloseTo(orientacao.spawn[2]);
    expect(sim.up().y).toBe(1);
    const cube = sim.objects[0]!;
    expect(cube.body.position.x).toBeCloseTo(cube.def.center[0]);
    expect(sim.drainEvents()).toEqual([]);
  });
});

describe('vidas, feixes de energia e objetivos', () => {
  /** Coloca a sonda bem no meio de um feixe, no instante atual. */
  function intoHazard(sim: Simulation, id: string) {
    const hazard = sim.hazard(id)!;
    const [x, y, z] = hazardCenter(hazard, sim.time + 1 / 60);
    sim.player.teleport({ x, y, z });
    sim.step(IDLE);
  }

  it('tocar um feixe custa uma vida e volta ao ponto seguro, com proteção curta', () => {
    const sim = new Simulation(leveza);
    sim.player.teleport({ x: 0, y: 3.8, z: -13.5 }); // ponto seguro da plataforma
    run(sim, 0.2);
    sim.drainEvents();
    intoHazard(sim, 'feixe-plataforma');
    expect(sim.lives).toBe(2);
    expect(sim.drainEvents()).toContainEqual({ type: 'life-lost', reason: 'hazard', lives: 2 });
    expect(sim.player.position.z).toBeCloseTo(-13.5, 0);
    expect(sim.invulnerable).toBeCloseTo(RESPAWN_INVULNERABILITY, 1);
    // Protegida, a sonda não perde outra vida de imediato.
    intoHazard(sim, 'feixe-plataforma');
    expect(sim.lives).toBe(2);
  });

  it('sem vidas, o desafio termina em derrota e a simulação para', () => {
    const sim = new Simulation(leveza);
    for (let i = 0; i < 3; i++) {
      sim.invulnerable = 0;
      intoHazard(sim, 'feixe-plataforma');
    }
    expect(sim.lives).toBe(0);
    expect(sim.defeated).toBe(true);
    expect(sim.drainEvents().some((e) => e.type === 'defeat')).toBe(true);
    const t = sim.time;
    run(sim, 0.5);
    expect(sim.time).toBe(t);
    sim.reset();
    expect(sim.lives).toBe(3);
    expect(sim.defeated).toBe(false);
  });

  it('feixe piscante só fere quando aceso', () => {
    const sim = new Simulation(inversao);
    const curtain = sim.hazard('cortina-teto')!;
    // Fase apagada: meio do trecho apagado do ciclo.
    sim.time = curtain.blink!.period * 0.75;
    intoHazard(sim, 'cortina-teto');
    expect(sim.lives).toBe(3);
    sim.time = curtain.blink!.period * 1.2; // aceso
    intoHazard(sim, 'cortina-teto');
    expect(sim.lives).toBe(2);
  });

  it('ponto seguro na parede devolve a gravidade apontada para ela', () => {
    const sim = new Simulation(orientacao);
    sim.view.yaw = 0;
    sim.view.pitch = 0;
    sim.aimGravity();
    sim.player.teleport({ x: 4.5, y: 11.7, z: -7.5 });
    run(sim, 0.2);
    expect(sim.drainEvents()).toContainEqual({ type: 'checkpoint', id: 'parede-alta' });
    sim.flipGravity(); // erra: cai para longe da parede...
    sim.player.teleport({ x: 0, y: 40, z: 0 }); // ...e sai da área do desafio
    sim.step(IDLE);
    expect(sim.lives).toBe(2);
    expect(sim.gravity.state.axis).toBe('-z');
    expect(sim.up().z).toBe(1);
    run(sim, 1);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.position.z).toBeCloseTo(-7.5, 1);
  });

  it('objetivos são cumpridos pela simulação, em ordem livre', () => {
    const sim = new Simulation(leveza);
    expect(sim.currentObjective()?.def.id).toBe('subir');
    sim.player.teleport({ x: 0, y: 3.8, z: -14 });
    sim.step(IDLE);
    expect(sim.objectives.find((o) => o.def.id === 'subir')?.done).toBe(true);
    expect(sim.drainEvents()).toContainEqual({ type: 'objective', id: 'subir', text: 'Suba na plataforma de 3,2 m' });
    expect(sim.currentObjective()?.def.id).toBe('barreira');
    sim.reset();
    expect(sim.objectives.every((o) => !o.done)).toBe(true);
  });
});
