# Etapas do projeto

O jogo cresce em etapas pequenas e verificáveis. Cada etapa termina com: tudo funcionando de
verdade (sem botões ou mecânicas de enfeite), testes passando (incluindo os robôs que resolvem os
desafios) e o histórico registrado em commits.

## ✅ Etapa 1 — Protótipo jogável (atual)

Commits no histórico: *etapa 1* (simulação), *etapa 2* (renderização, controles, interface) e
*etapa 3* (testes ponta a ponta, CI e documentação).

- Movimento, pulo e câmera em terceira pessoa que gira com a gravidade.
- Gravidade: intensidade (Leve/Normal/Pesada), inversão e apontar para 6 eixos.
- Objetos físicos (Cubo Denso de 100 kg, caixas de 8 kg), placas de pressão por força real,
  barreiras de energia, portal, vazio com pontos seguros.
- 3 desafios progressivos; progresso e ajustes salvos no aparelho.
- Controles de PC e de Android; HUD; menus; resolução adaptativa.
- 78 testes de unidade/integração e 14 cenários de ponta a ponta (30 execuções em PC e Android
  emulado); CI no GitHub Actions.

## Limitações conhecidas

- **Não testado em aparelhos reais.** Os testes usam Chromium (PC) e emulação de Android. O
  desempenho em celulares de entrada ainda precisa ser medido (use **Ajustes → Mostrar FPS**).
- Sem som e sem vibração.
- Sem modo offline: o manifesto permite adicionar à tela inicial, mas o jogo precisa de internet.
- iPhone/Safari não foi testado (o botão "Tela cheia" não existe no iPhone).
- No PC, se o navegador não permitir capturar o cursor (alguns iframes), a câmera gira arrastando
  com o botão pressionado.
- Câmera: em cantos muito apertados ela se aproxima bastante da sonda.

## Próximas etapas (uma de cada vez)

Ordem sugerida; cada item deve virar uma etapa própria, com testes:

1. **Etapa 2 — Sensações:** efeitos sonoros sintetizados (Web Audio, sem arquivos de terceiros),
   vibração curta ao pousar/trocar a gravidade no Android, e teste em aparelhos reais com ajuste de
   desempenho a partir das medições.
2. **Etapa 3 — Instalação completa:** service worker para jogar offline e workflow que gera o .zip
   para o itch.io.
3. **Etapa 4 — Um poder novo:** por exemplo, *atrito* (superfícies sem atrito, como gelo) ou
   *massa* (mudar a massa de um objeto). Escolher **um**, com 2 ou 3 desafios que o exijam e robôs
   que provem a solução.
4. **Etapa 5 — Conteúdo:** mais desafios combinando os poderes, contagem de estrelas por tempo,
   controle por gamepad.
5. **Etapa 6 — Visual "Alta":** brilho (bloom) e sombras opcionais para aparelhos potentes,
   mantendo a qualidade Baixa leve.
