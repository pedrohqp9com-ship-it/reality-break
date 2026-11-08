/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Caminho relativo: o mesmo build funciona na raiz de um domínio, numa subpasta
  // ou dentro de um .zip enviado para portais de jogos HTML5 (ex.: itch.io).
  base: './',
  build: {
    target: 'es2022',
    // Three.js sozinho passa de 500 kB minificado; o aviso padrão não ajuda aqui.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Bibliotecas em arquivos separados: mudam pouco, então ficam no cache do
        // navegador entre uma versão do jogo e outra.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/cannon-es')) return 'physics';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
