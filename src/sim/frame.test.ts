import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AXES, axisVector, oppositeAxis, type Axis } from './axis';
import { GravityFrame } from './frame';

function expectVec(v: Vector3, x: number, y: number, z: number) {
  expect(v.x).toBeCloseTo(x, 6);
  expect(v.y).toBeCloseTo(y, 6);
  expect(v.z).toBeCloseTo(z, 6);
}

describe('referencial da gravidade', () => {
  it('começa com o "para cima" do mundo', () => {
    const frame = new GravityFrame();
    expectVec(frame.up(), 0, 1, 0);
  });

  it('o "para cima" sempre fica oposto à gravidade, em qualquer sequência', () => {
    const frame = new GravityFrame();
    let current: Axis = '-y';
    const sequence: Axis[] = ['+y', '-z', '+x', '-x', '+z', '-y', '+x', '+y', '-z', '-y'];
    for (const next of sequence) {
      frame.rotateTo(current, next, { x: 0.3, y: 0.2, z: -0.9 });
      current = next;
      const expected = axisVector(oppositeAxis(next));
      expectVec(frame.up(), expected.x, expected.y, expected.z);
    }
  });

  it('inverter mantém a direção para onde se olha', () => {
    const frame = new GravityFrame();
    const before = new Vector3();
    const right = new Vector3();
    frame.moveBasis(0.7, before, right);
    frame.rotateTo('-y', '+y', before);
    const after = new Vector3();
    frame.moveBasis(0.7, after, right);
    expectVec(after, before.x, before.y, before.z);
    expectVec(frame.up(), 0, -1, 0);
  });

  it('apontar para a parede da frente: a frente passa a ser "subir a parede"', () => {
    const frame = new GravityFrame();
    frame.rotateTo('-y', '-z', { x: 0, y: 0, z: -1 });
    const forward = new Vector3();
    const right = new Vector3();
    frame.moveBasis(0, forward, right);
    expectVec(forward, 0, 1, 0);
    expectVec(right, 1, 0, 0);
  });

  it('a base de movimento é perpendicular ao "para cima"', () => {
    for (const axis of AXES) {
      const frame = new GravityFrame(axis);
      const up = frame.up();
      const forward = new Vector3();
      const right = new Vector3();
      for (const yaw of [0, 1, 2.5, -2]) {
        frame.moveBasis(yaw, forward, right);
        expect(Math.abs(forward.dot(up))).toBeLessThan(1e-9);
        expect(Math.abs(right.dot(up))).toBeLessThan(1e-9);
        expect(Math.abs(forward.dot(right))).toBeLessThan(1e-9);
      }
    }
  });

  it('a direção do olhar inclui a inclinação', () => {
    const frame = new GravityFrame();
    const look = frame.lookDirection(0, -Math.PI / 2 + 0.01);
    expect(look.y).toBeLessThan(-0.99);
  });
});
