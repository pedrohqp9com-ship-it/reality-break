import './ui/styles.css';
import { Game } from './game/Game';
import { installDebugHooks } from './game/debug';
import { webglAvailable } from './render/Renderer';
import { Screens } from './ui/Screens';

const root = document.getElementById('app');
const canvas = document.getElementById('scene');

if (!(root instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Estrutura da página incompleta');
}

if (!webglAvailable()) {
  const noop = () => undefined;
  new Screens(
    root,
    {
      play: noop, begin: noop, resume: noop, restart: noop, menu: noop, next: noop,
      settingsChanged: noop, openSettings: noop, fullscreen: noop,
    },
    false,
  ).error(
    'Este navegador ou aparelho não oferece WebGL, necessário para o 3D. Tente o Chrome ou o Firefox atualizados, ou ative a aceleração por hardware.',
  );
} else {
  const game = new Game(root, canvas);
  installDebugHooks(game);
  game.start();
}
