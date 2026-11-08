import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, repeat: boolean): CanvasTexture {
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.minFilter = LinearMipmapLinearFilter;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }
  return texture;
}

/**
 * Grade luminosa (linhas brancas sobre preto), usada como mapa emissivo: as
 * linhas brilham na cor de destaque do desafio. Um quadro = 4 m, com divisões de 1 m.
 */
export function createGridTexture(): CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const cell = size / 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, size, size);
  // Pequenas marcas nos cruzamentos dão escala ao cenário.
  ctx.fillStyle = '#fff';
  for (let i = 1; i < 4; i++) {
    for (let j = 1; j < 4; j++) ctx.fillRect(i * cell - 3, j * cell - 3, 6, 6);
  }
  return finish(c, true);
}

/** Moldura brilhante para as bordas dos cubos. */
export function createFrameTexture(): CanvasTexture {
  const size = 128;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, size - 10, size - 10);
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, size - 52, size - 52);
  return finish(c, false);
}

/** Faixas diagonais das barreiras de energia (rolam com o tempo). */
export function createStripeTexture(): CanvasTexture {
  const size = 128;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = -size; i < size * 2; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 12, 0);
    ctx.lineTo(i + 12 - size, size);
    ctx.lineTo(i - size, size);
    ctx.closePath();
    ctx.fill();
  }
  return finish(c, true);
}

/** Vórtice do portal: gradiente radial com braços em espiral. */
export function createPortalTexture(): CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  const mid = size / 2;
  const gradient = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 5;
  for (let arm = 0; arm < 4; arm++) {
    ctx.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const angle = arm * (Math.PI / 2) + t * Math.PI * 1.6;
      const r = t * mid * 0.95;
      const x = mid + Math.cos(angle) * r;
      const y = mid + Math.sin(angle) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finish(c, false);
}

/** Ponto suave e redondo para partículas. */
export function createDotTexture(): CanvasTexture {
  const size = 64;
  const [c, ctx] = canvas(size);
  const mid = size / 2;
  const gradient = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return finish(c, false);
}
