import type { Game } from './Game';

declare global {
  interface Window {
    __REALITY_BREAK__?: {
      state: () => ReturnType<Game['debugState']>;
      teleport: (x: number, y: number, z: number) => void;
      setView: (yaw: number, pitch: number) => void;
    };
  }
}

/**
 * Ganchos de depuração, ativados só com `?debug` na URL. Usados pelos testes de
 * ponta a ponta para ler o estado real do jogo.
 */
export function installDebugHooks(game: Game): void {
  if (!new URLSearchParams(window.location.search).has('debug')) return;
  window.__REALITY_BREAK__ = {
    state: () => game.debugState(),
    teleport: (x, y, z) => game.sim?.player.teleport({ x, y, z }),
    setView: (yaw, pitch) => {
      if (!game.sim) return;
      game.sim.view.yaw = yaw;
      game.sim.view.pitch = pitch;
    },
  };
}
