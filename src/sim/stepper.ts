/**
 * Acumulador de passo fixo: a física sempre avança em passos iguais, não importa a
 * taxa de quadros do aparelho (30, 60 ou 120 Hz). Devolve quantos passos rodar e a
 * fração restante, usada para interpolar a imagem entre dois passos.
 */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    readonly step: number,
    private readonly maxSteps: number,
  ) {}

  advance(frameSeconds: number): { steps: number; alpha: number } {
    const safe = Number.isFinite(frameSeconds) && frameSeconds > 0 ? frameSeconds : 0;
    this.accumulator += Math.min(safe, this.step * this.maxSteps);
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSteps) {
      this.accumulator -= this.step;
      steps++;
    }
    if (steps === this.maxSteps) this.accumulator = Math.min(this.accumulator, this.step);
    return { steps, alpha: this.accumulator / this.step };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
