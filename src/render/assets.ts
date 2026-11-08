import type { CanvasTexture } from 'three';
import {
  createDotTexture,
  createFrameTexture,
  createGridTexture,
  createPortalTexture,
  createStripeTexture,
} from './textures';

/** Texturas geradas uma vez e reaproveitadas por todos os desafios. */
export interface SharedTextures {
  readonly grid: CanvasTexture;
  readonly frame: CanvasTexture;
  readonly stripes: CanvasTexture;
  readonly portal: CanvasTexture;
  readonly dot: CanvasTexture;
}

export function createSharedTextures(): SharedTextures {
  return {
    grid: createGridTexture(),
    frame: createFrameTexture(),
    stripes: createStripeTexture(),
    portal: createPortalTexture(),
    dot: createDotTexture(),
  };
}
