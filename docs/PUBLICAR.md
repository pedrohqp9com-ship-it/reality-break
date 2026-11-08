# Publicar o REALITY BREAK

O jogo é um site estático: `npm run build` gera a pasta `dist/` (HTML, CSS, JavaScript e ícones), que
pode ser hospedada em qualquer serviço de páginas estáticas. Os caminhos são relativos, então o mesmo
build funciona na raiz de um domínio, numa subpasta ou dentro de um .zip.

> Os passos abaixo seguem a documentação das plataformas, cujos menus mudam com o tempo. O jogo foi
> testado em Chromium (PC e emulação de Android, via Playwright), **não em aparelhos reais**.

O jogo fica na pasta `reality-break/` do repositório `voz-universal`. Em todas as opções, o ponto
principal é dizer à plataforma que **o projeto começa nessa pasta**.

## Opção A — Vercel (recomendada; dá para fazer só pelo celular)

O arquivo `reality-break/vercel.json` já define instalação (`npm ci`), build (`npm run build`),
saída (`dist`) e cabeçalhos de cache. Crie um **projeto novo** — o projeto existente da Vercel
continua publicando o Voz Universal.

1. No Chrome do celular, abra <https://vercel.com/new> (ative "Site para computador" no menu ⋮ se
   a página ficar apertada) e entre com a conta do GitHub.
2. Em **Import Git Repository**, escolha `voz-universal` → **Import**.
3. Em **Root Directory**, toque em **Edit** e escolha a pasta **`reality-break`**.
4. Dê um nome ao projeto (ex.: `reality-break`) e toque em **Deploy**.
5. O endereço fica algo como `https://reality-break.vercel.app`.

Produção = branch `main`. Antes de juntar esta branch na `main`, a Vercel gera um link de
**pré-visualização** para cada push da branch — dá para jogar por ele.

Para evitar builds desnecessários, em **Settings → Git → Ignored Build Step** você pode usar
`git diff --quiet HEAD^ HEAD -- .` (só reconstrói quando a pasta do jogo muda).

## Opção B — Netlify ou Cloudflare Pages

Importe o repositório do GitHub e configure:

| Campo | Valor |
| --- | --- |
| Base directory (Netlify) / Root directory (Cloudflare) | `reality-break` |
| Build command | `npm run build` |
| Publish / output directory | `dist` |
| Variável de ambiente | `NODE_VERSION` = `22` |

## Opção C — itch.io (portal de jogos, aceita jogos HTML)

1. No computador: `cd reality-break && npm ci && npm run build`.
2. Compacte o **conteúdo** de `dist/` (o `index.html` precisa ficar na raiz do .zip):
   `cd dist && zip -r ../reality-break.zip .`
3. Em itch.io → **Upload new project** → *Kind of project*: **HTML** → envie o .zip e marque
   **This file will be played in the browser**.
4. Sugestões: tamanho 1280 × 720, **Mobile friendly** (orientação paisagem) e
   **Fullscreen button** ativados.

Sem computador, o .zip pode ser obtido do GitHub Actions no futuro (ainda não configurado — veja
[ETAPAS.md](ETAPAS.md)).

## Opção D — GitHub Pages

Cada repositório tem um único site no GitHub Pages, e o deste já é usado pelo Voz Universal
(`.github/workflows/deploy-pages.yml`). Para usar o Pages, mova o jogo para um repositório próprio:

```bash
# na raiz do voz-universal: cria uma branch só com a história da pasta do jogo
git subtree split --prefix reality-break -b reality-break-only
# crie o repositório vazio "reality-break" no GitHub e envie
git push https://github.com/<usuário>/reality-break.git reality-break-only:main
```

No repositório novo, a pasta do jogo vira a raiz; o workflow `reality-break.yml` precisaria ser
adaptado (remover o `working-directory`).

## Depois de publicar

- **Jogar no Android:** abra o link no Chrome, toque em **Tela cheia** no menu do jogo e gire o
  aparelho para a horizontal.
- **Ícone na tela inicial:** menu ⋮ → **Adicionar à tela inicial** (ou **Instalar app**). O
  manifesto abre o jogo em tela cheia e na horizontal. O modo offline ainda **não** existe (veja
  [ETAPAS.md](ETAPAS.md)); sem internet, o jogo não abre.
- **Conferir:** a tela inicial mostra "REALITY BREAK"; em **Ajustes**, ative **Mostrar FPS** para
  ver o desempenho no aparelho. Se ficar lento, use **Qualidade: Baixa**.
