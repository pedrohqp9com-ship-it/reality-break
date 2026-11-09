# Arquitetura

## Visão geral

```
entrada (teclado, mouse, toque) ──► Game (laço) ──► Simulation (passo fixo 60 Hz)
                                       │                 ├─ GravityController  (estado e poderes)
                                       │                 ├─ GravityFrame       (referencial "para cima")
                                       │                 ├─ Player             (esfera física)
                                       │                 └─ cannon-es World    (corpos, contatos)
                                       ▼
                         LevelView + CameraRig (Three.js) ──► tela
                         Hud + Screens (DOM)
```

- **`src/sim/` não importa nada de renderização nem do DOM.** Usa apenas a matemática do Three.js
  (`Vector3`, `Quaternion`) e o cannon-es. Por isso os testes rodam a simulação completa no Node.
- **A tela só lê a simulação.** `LevelView` copia posições (interpoladas entre dois passos) para os
  objetos 3D; nada no visual altera a física.

## Gravidade

- `GravityState = { axis, level }`: um dos 6 eixos do mundo e uma intensidade (0,35 / 1 / 2 g).
- `GravityController` aplica só os poderes liberados no desafio (`powers`), e devolve uma
  `GravityChange` (ou `null`, se nada mudou).
- `GravityFrame` guarda um quaternion que leva o "para cima" local (Y) ao oposto da gravidade. Na
  troca de eixo, aplica a menor rotação entre o "para cima" antigo e o novo; na inversão (180°),
  gira em torno da direção em que o jogador olha. O yaw/pitch da câmera é medido dentro desse
  referencial, então andar na parede ou no teto usa os mesmos controles.
- Apontar: a direção do olhar (`frame × yaw × pitch`) é arredondada para o eixo mais próximo.

## Jogador

Uma esfera (raio 0,5 m, 70 kg) sem rotação e sem atrito com o cenário. A cada passo:

1. calcula a velocidade desejada no plano perpendicular à gravidade (direcional × 6 m/s);
2. aplica uma **força** limitada para se aproximar dela (50 m/s² no chão, 14 m/s² no ar) — é essa
   força, resolvida pelo motor, que empurra os cubos;
3. pulo: define a componente "para cima" da velocidade em 6 m/s (com tolerâncias de 0,1 s
   "coyote time" e 0,12 s de memória do botão);
4. depois do passo, está no chão se algum contato empurra a esfera "para cima" (normal a menos de
   ~56°) e ela não está subindo.

## Placas e barreiras

`surfaceForceInRegion` percorre os contatos resolvidos no último passo (`world.contacts`); o
solucionador do cannon-es guarda em `multiplier` a força de cada contato. A placa soma os contatos
com o cenário fixo cujo ponto cai dentro da sua área, projetados na normal da placa. Assim:

- a leitura é física (m·g em repouso, picos em impactos, soma de pilhas de objetos);
- a placa é só uma área marcada em um piso ou parede contínuo, sem emendas;
- a placa ativa com força ≥ limite **por 0,5 s** e desativa abaixo de 95% do limite.

Barreiras desligam as colisões (`collisionFilterMask = 0`) quando abertas e não se fecham enquanto
algo está dentro delas.

## Desafios

`src/levels/*.ts` são dados (`LevelDef`): blocos fixos, objetos, placas, barreiras, portal, pontos
seguros, dicas por zona e limites. Sair dos limites leva o jogador ao último ponto seguro com a
gravidade inicial; objetos que saem da sua área (`home`) voltam ao início — nada fica impossível.

Os testes em `src/levels/levels.test.ts` validam a geometria, provam que cada desafio exige o poder
que apresenta e rodam os robôs de `src/test/bots.ts`, que resolvem os três desafios com os comandos
do jogador. **Ao mudar um desafio, rode `npm test`: se um robô falhar, o desafio pode ter ficado
impossível.**

## Renderização e desempenho

- Blocos fixos agrupados por estilo e mesclados (`mergeGeometries`): ~3 malhas + 1 conjunto de
  linhas para todo o cenário.
- Texturas geradas em canvas (grade, moldura, faixas, portal); coordenadas de textura calculadas
  pela posição no mundo, para a grade continuar alinhada entre blocos.
- Sem sombras dinâmicas nem pós-processamento. O "marcador de queda" (um anel onde a sonda cairia,
  por raio na direção da gravidade) dá a noção de profundidade que a sombra daria.
- `Renderer` ajusta a densidade de pixels pelo tempo médio de quadro (`nextResolutionScale`).

## Entrada

`InputManager` junta teclado, mouse (com captura do cursor; sem captura, arrastar) e toque em
comandos por quadro: movimento, giro da câmera e uma fila de ações. `TouchControls` desenha o
direcional dinâmico e os botões — só dos poderes liberados. O tipo de controle em uso (teclado ou
toque) muda os textos das dicas e mostra/esconde os botões de tela.

## Vidas, feixes e objetivos (2.0)

- `src/sim/hazards.ts`: posição (`hazardCenter`) e estado aceso/apagado (`hazardActive`) de cada
  feixe dependem só do tempo de jogo; `hazardHits` testa esfera × caixa. Os robôs usam as mesmas
  funções para prever a travessia, como uma pessoa que observa o ritmo.
- `Simulation` guarda `lives`, `invulnerable` e `objectives`. Vazio ou feixe → `loseLife`: perde
  uma vida e volta ao ponto seguro (com a gravidade daquele ponto, `CheckpointDef.gravity`); sem
  vidas → `defeated` e a simulação para. Objetivos (`zone`, `gate`, `portal`) são marcados a cada
  passo e geram eventos para o HUD.

## Tela horizontal e controles (2.0)

- `src/ui/orientation.ts`: `isPortraitBlocked` (aparelho de toque com altura > largura) e
  `OrientationGuard`, que mostra o aviso para girar e pausa o jogo.
- `src/ui/fullscreen.ts`: tela cheia + `screen.orientation.lock('landscape')` quando o navegador
  permite.
- Correr: `SimInput.sprint` troca a velocidade máxima (6 → 9,5 m/s); Shift no teclado,
  `InputManager.setTouchSprint` no celular.
- `src/input/haptics.ts`: vibração opcional (`navigator.vibrate`), desligável nos ajustes.
