# Etapas do projeto

O jogo cresce em etapas pequenas e verificáveis. Cada etapa termina com: tudo funcionando de
verdade (sem botões ou mecânicas de enfeite), testes passando (incluindo os robôs que resolvem os
desafios) e o histórico registrado em commits.

## ✅ Etapa 1 — Protótipo jogável

Commits no histórico: *etapa 1* (simulação), *etapa 2* (renderização, controles, interface) e
*etapa 3* (testes ponta a ponta, CI e documentação). Feitos originalmente na pasta `reality-break/`
do repositório `voz-universal` e trazidos para este repositório com o histórico preservado.

- Movimento, pulo e câmera em terceira pessoa que gira com a gravidade.
- Gravidade: intensidade (Leve/Normal/Pesada), inversão e apontar para 6 eixos.
- Objetos físicos (Cubo Denso de 100 kg, caixas de 8 kg), placas de pressão por força real,
  barreiras de energia, portal, vazio com pontos seguros.
- 3 desafios progressivos; progresso e ajustes salvos no aparelho.
- Controles de PC e de Android; HUD; menus; resolução adaptativa.

## REALITY BREAK 2.0

Pedido completo: tela horizontal, controles profissionais, mundo 3D maior, cinco poderes novos,
inimigos, vidas e fases, visual premium e sons originais. Como o pedido começa por **tela
horizontal, controles e jogabilidade atual**, a 2.0 foi dividida em etapas — uma de cada vez.

### ✅ 2.0 · Etapa A — Tela horizontal

- Celular em pé: aviso "Gire o aparelho" que pausa o jogo; botão de tela cheia que trava na
  horizontal quando o navegador permite (Chrome do Android).
- Botão de tela cheia no HUD (celular) e no menu de pausa (PC).
- Layout para telas deitadas baixas (a partir de 640 × 360): menus em colunas, nada cortado.

### ✅ 2.0 · Etapa B — Controles

- Correr (9,5 m/s): Shift no PC, botão CORRER no celular.
- Direcional visível em repouso à esquerda; câmera arrastando à direita; arco de botões
  (CORRER, APONTAR, INVERTER) ao redor do PULAR; intensidade numa faixa sob o relógio.
- Vibração opcional no Android.

### ✅ 2.0 · Etapa C — Jogabilidade dos desafios atuais

- 3 vidas por desafio, proteção de 1,5 s ao voltar a um ponto seguro, tela de derrota.
- Feixes de energia (fixos no lugar, móveis ou piscantes) com dificuldade crescente.
- Pontos seguros novos, inclusive numa parede (guardam a direção da gravidade).
- Objetivos cumpridos pela simulação e mostrados no HUD; vitória com vidas restantes.

Testes ao fim da etapa C: 95 de unidade/integração e 26 cenários de ponta a ponta (PC e dois
celulares Android deitados, além de testes com o celular em pé).

### Próximas etapas da 2.0 (propostas, uma por vez)

Cada uma com seus testes e robôs que provem que os desafios novos têm solução:

1. **D — Mundo 3D:** ilhas flutuantes e uma cidade futurista como cenário de novos desafios,
   **plataformas móveis** (o jogador e os cubos são carregados por elas pela física) e portais
   entre dimensões ligando as fases.
2. **E — Poder: congelar objetos.** Um objeto congelado para no ar (vira estático por alguns
   segundos), com recarga — degrau no ar, bloqueio de feixe, etc.
3. **F — Poder: criar portais.** Par de portais colocados pelo jogador; o que entra por um sai pelo
   outro mantendo a velocidade (relativa à orientação).
4. **G — Poder: alterar o tamanho.** Aumentar/diminuir um objeto (massa proporcional ao volume),
   com limites para não atravessar paredes.
5. **H — Inimigos e onda de energia.** Drones com comportamentos diferentes (patrulha, perseguição,
   sentinela) e o poder de empurrá-los com uma onda (impulso físico real), com recarga.
6. **I — Som e visual premium:** efeitos sonoros originais sintetizados (Web Audio, sem arquivos de
   terceiros), partículas e efeitos de energia, com o modo de qualidade Baixa ainda leve.
7. **J — Instalação completa:** jogar offline (service worker) e .zip automático para o itch.io.

## Limitações conhecidas

- **Não testado em aparelhos reais.** Os testes usam Chromium (PC) e emulação de Android. O
  desempenho em celulares intermediários ainda precisa ser medido (use **Ajustes → Mostrar FPS**).
- A trava da horizontal depende do navegador: funciona no Chrome do Android em tela cheia; no
  iPhone/Safari não existe (lá vale o aviso para girar). iPhone não foi testado.
- Sem som. Sem modo offline: o manifesto permite adicionar à tela inicial, mas o jogo precisa de
  internet.
- No PC, se o navegador não permitir capturar o cursor (alguns iframes), a câmera gira arrastando
  com o botão pressionado.
- Câmera: em cantos muito apertados ela se aproxima bastante da sonda.
