import { ACESFilmicToneMapping, SRGBColorSpace, WebGLRenderer } from 'three';
import { FrameTimer, nextResolutionScale, qualityProfile, type QualityProfile, type QualitySetting } from './quality';

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Renderizador WebGL com resolução adaptativa ao desempenho do aparelho. */
export class Renderer {
  readonly webgl: WebGLRenderer;
  profile: QualityProfile;
  private scale = 1;
  private readonly timer = new FrameTimer();

  constructor(
    readonly canvas: HTMLCanvasElement,
    quality: QualitySetting,
    private readonly touch: boolean,
  ) {
    this.webgl = new WebGLRenderer({
      canvas,
      // Antisserrilhado custa caro em telas densas de celular; lá a densidade já suaviza.
      antialias: !touch || window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.webgl.outputColorSpace = SRGBColorSpace;
    this.webgl.toneMapping = ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.15;
    this.profile = qualityProfile(quality, window.devicePixelRatio, touch);
    this.applySize();
  }

  setQuality(quality: QualitySetting): void {
    this.profile = qualityProfile(quality, window.devicePixelRatio, this.touch);
    this.scale = 1;
    this.applySize();
  }

  get pixelRatio(): number {
    return this.webgl.getPixelRatio();
  }

  /** Registra o tempo do quadro e ajusta a resolução se necessário. */
  trackFrame(frameSeconds: number): void {
    if (!this.profile.adaptive) return;
    const average = this.timer.add(frameSeconds);
    if (average === null) return;
    const next = nextResolutionScale(this.scale, average);
    if (next !== this.scale) {
      this.scale = next;
      this.applySize();
    }
  }

  applySize(): void {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.webgl.setPixelRatio(Math.max(0.5, this.profile.maxPixelRatio * this.scale));
    this.webgl.setSize(width, height, false);
  }

  dispose(): void {
    this.webgl.dispose();
  }
}
