/**
 * Gera os ícones PNG a partir de public/icons/icon.svg.
 * Uso: npm run icons   (usa o Chromium do Playwright)
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'public', 'icons');
const svg = await readFile(path.join(iconsDir, 'icon.svg'), 'utf8');

const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    const output = path.join(iconsDir, `icon-${size}.png`);
    await page.screenshot({ path: output });
    await page.close();
    console.log(`✔ icon-${size}.png`);
  }
} finally {
  await browser.close();
}
