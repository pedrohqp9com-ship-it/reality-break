# REALITY BREAK

**Aventura 3D no navegador em que você altera as leis da física.**

Você controla uma sonda esférica num complexo de testes futurista. Para avançar, muda a
intensidade da gravidade, inverte "para cima" e "para baixo" e escolhe qual parede é o chão.
Tudo — você, os cubos, as caixas — obedece à mesma física, simulada de verdade.

> **Estado atual: protótipo jogável (Etapa 1).** Três desafios progressivos, controles de PC e
> Android, testes automatizados. Ainda **não** foi testado em aparelhos Android reais, só em
> emulação; veja [limitações](docs/ETAPAS.md#limitações-conhecidas).

## Como jogar

| Desafio | Poder novo | O que pede |
| --- | --- | --- |
| 1 · Leveza | **Intensidade**: Leve (0,35 g), Normal (1 g), Pesada (2 g) | Subir numa plataforma de 3,2 m (o salto normal chega a ~1,8 m; o Leve, a ~5,2 m) e abrir uma barreira com uma placa de pressão de 1500 N — o Cubo Denso (100 kg) só passa disso na gravidade Pesada. |
| 2 · Inversão | **Inverter** a gravidade | Atravessar uma fresta junto ao teto, alternar entre teto e chão por cima de vãos e chegar ao portal preso ao teto. |
| 3 · Orientação | **Apontar** a gravidade para qualquer um dos 6 eixos | Fazer da parede norte o chão, levar o Cubo Denso à placa embutida nela, subir pela parede e pousar na sacada do portal. |

Cada desafio só é liberado depois do anterior; os poderes se acumulam.

### Controles

| Ação | PC | Celular (Android) |
| --- | --- | --- |
| Mover | W A S D ou setas | Direcional que aparece onde o polegar toca (metade esquerda) |
| Olhar | Mouse (clique na tela para capturar) | Arrastar na metade direita |
| Pular | Espaço | PULAR |
| Intensidade | 1 / 2 / 3 | LEVE / NORMAL / PESADA |
| Inverter | F | INVERTER |
| Apontar | G ou clique | APONTAR (mire com a câmera antes) |
| Zoom da câmera | Roda do mouse | — |
| Reiniciar / pausar | R / Esc ou P | Botão ❙❙ |

Na tela de jogo, a **bússola** mostra para onde a gravidade puxa em relação à câmera, e o painel da
placa mostra a força medida em newtons.

## Princípio: nenhuma mecânica falsa

- A gravidade é aplicada no motor de física (cannon-es); o jogador é um corpo físico, como os cubos.
- A placa de pressão soma as **forças de contato resolvidas** pelo motor dentro da área dela
  (não um "detector de presença"). Por isso a mesma placa lê 343 N, 981 N ou 1962 N para o mesmo
  cubo em cada intensidade, e uma placa na parede só sente algo quando a gravidade aponta para ela.
- Botões de poderes ainda não liberados não aparecem e não fazem nada.
- Os testes provam isso: medem alturas de salto (`h = v²/2g`) e forças (`m·g`), mostram que cada
  desafio **não** se resolve sem o poder novo e usam "robôs" que **resolvem os três desafios
  usando só os comandos do jogador** (direcional, pulo, poderes e câmera).

Duas regras de jogo foram escolhidas conscientemente e estão documentadas no código:
velocidade terminal de 30 m/s (o papel do arrasto do ar; também evita atravessar paredes) e
placas que exigem força **sustentada por 0,5 s** (o pico de força de uma queda é real, mas curto).

## Rodar no computador

Requisitos: Node.js 20.19+ (recomendado 22).

```bash
cd reality-break
npm install
npm run dev          # http://localhost:5173
npm run dev:host     # idem, acessível pelo celular na mesma rede Wi-Fi
npm run build        # gera dist/ (o que vai para a internet)
npm run preview      # serve dist/ em http://localhost:4173
```

## Testes

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Vitest: física, gravidade, desafios, robôs, interface (78 testes)
npm run test:e2e     # Playwright no build: 14 cenários em PC + Android (paisagem e em pé) = 30 execuções
npm run check        # typecheck + lint + test + build
```

No GitHub, `.github/workflows/reality-break.yml` roda tudo isso a cada mudança na pasta.

## Publicar

Resumo — detalhes, inclusive como publicar **só pelo celular**, em [docs/PUBLICAR.md](docs/PUBLICAR.md):

- **Vercel** (recomendado): novo projeto apontando para este repositório com
  *Root Directory* = `reality-break`. O `vercel.json` desta pasta já configura o resto.
- **Netlify / Cloudflare Pages**: diretório base `reality-break`, build `npm run build`, saída `dist`.
- **itch.io**: `npm run build`, compacte o **conteúdo** de `dist/` em um .zip e envie como jogo HTML.

## Desempenho

- Cenário mesclado por material (poucas chamadas de desenho), materiais Lambert, sem sombras
  dinâmicas nem pós-processamento.
- Física em passo fixo de 60 Hz, interpolada na tela; no máximo 5 passos por quadro.
- Resolução adaptativa: se o quadro passa de ~22 ms, a densidade de pixels cai 10% (até 55%).
- Download: ~185 kB comprimidos no total (Three.js 134 kB, física 24 kB, jogo ~22 kB).
- Qualidade Baixa / Automática / Alta e contador de FPS em **Ajustes**.

## Estrutura

```
src/
├── sim/        # simulação sem renderização: gravidade, referencial, física, jogador, desafio
├── levels/     # os três desafios (dados) e utilitários de construção
├── render/     # Three.js: cena do desafio, câmera, texturas, qualidade adaptativa
├── input/      # teclado/mouse, toque (direcional e botões), mapeamento de ações
├── ui/         # HUD, menus e formatação
├── state/      # progresso e ajustes salvos no aparelho
├── game/       # laço principal e ganchos de teste (?debug)
└── test/       # utilitários e robôs que resolvem os desafios
e2e/            # testes Playwright
docs/           # etapas, arquitetura, publicação
```

Mais detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md) e o plano das próximas etapas em
[docs/ETAPAS.md](docs/ETAPAS.md).

## Créditos e licenças de terceiros

- [Three.js](https://threejs.org) (MIT) e [cannon-es](https://github.com/pmndrs/cannon-es) (MIT).
- Todo o visual é gerado por código (texturas em canvas, formas geométricas); não há imagens,
  modelos, fontes ou sons de terceiros. Nada é baixado de servidores externos durante o jogo.

A licença do próprio REALITY BREAK ainda será definida pelo autor do projeto.
