# Publicar o REALITY BREAK

O jogo é um site estático: `npm run build` gera a pasta `dist/` (HTML, CSS, JavaScript e ícones), que
pode ser hospedada em qualquer serviço de páginas estáticas. Os caminhos são relativos, então o mesmo
build funciona na raiz de um domínio, numa subpasta ou dentro de um .zip.

> Os passos abaixo seguem a documentação das plataformas, cujos menus mudam com o tempo. O jogo foi
> testado em Chromium (PC e emulação de Android, via Playwright), **não em aparelhos reais**.

## Opção A — Vercel (recomendada; dá para fazer só pelo celular)

O arquivo `vercel.json` na raiz deste repositório define tudo o que a Vercel precisa:

| Configuração | Valor (em `vercel.json`) |
| --- | --- |
| Framework | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` (verifica os tipos e gera o build) |
| Output directory | `dist` |
| Root Directory (no painel) | deixe o padrão, `./` |

Também define cache longo para `assets/` (os nomes têm hash) e cabeçalhos de segurança.

1. No Chrome do celular, abra <https://vercel.com/new> (ative "Site para computador" no menu ⋮ se
   a página ficar apertada) e entre com a conta do GitHub.
2. Em **Import Git Repository**, escolha **`reality-break`** → **Import**. Se ele não aparecer,
   use **Adjust GitHub App Permissions** e libere o repositório para a Vercel.
3. Não é preciso mudar nada em *Build and Output Settings* nem em *Root Directory*.
4. Toque em **Deploy**. O endereço fica algo como `https://reality-break.vercel.app`
   (ou com um sufixo, se o nome já estiver em uso).

- **Produção = branch `main`.** Outras branches e pull requests geram links de pré-visualização.
- **Versão do Node:** o `package.json` pede Node `>=20.19.0`; a Vercel usa a versão mais recente
  disponível que atende a isso (o build funciona em 20, 22 e 24).
- **Se a página abrir em branco ou com 404:** em Vercel → Deployments, abra o deploy e confira se
  o *Build Logs* mostra `vite build` gerando `dist/index.html`.

## Opção B — Netlify ou Cloudflare Pages

Importe o repositório do GitHub e configure:

| Campo | Valor |
| --- | --- |
| Build command | `npm run build` |
| Publish / output directory | `dist` |
| Variável de ambiente | `NODE_VERSION` = `22` |

## Opção C — itch.io (portal de jogos, aceita jogos HTML)

1. No computador: `npm ci && npm run build`.
2. Compacte o **conteúdo** de `dist/` (o `index.html` precisa ficar na raiz do .zip):
   `cd dist && zip -r ../reality-break.zip .`
3. Em itch.io → **Upload new project** → *Kind of project*: **HTML** → envie o .zip e marque
   **This file will be played in the browser**.
4. Sugestões: tamanho 1280 × 720, **Mobile friendly** (orientação paisagem) e
   **Fullscreen button** ativados.

## Opção D — GitHub Pages

Como o jogo agora tem um repositório próprio, o GitHub Pages também serve (em repositórios
privados ele exige um plano pago). Ainda não há workflow de publicação para isso; o build é o mesmo
(`npm run build` → `dist/`).

## Depois de publicar

- **Jogar no Android:** abra o link no Chrome, toque em **Tela cheia** no menu do jogo e gire o
  aparelho para a horizontal.
- **Ícone na tela inicial:** menu ⋮ → **Adicionar à tela inicial** (ou **Instalar app**). O
  manifesto abre o jogo em tela cheia e na horizontal. O modo offline ainda **não** existe (veja
  [ETAPAS.md](ETAPAS.md)); sem internet, o jogo não abre.
- **Conferir:** a tela inicial mostra "REALITY BREAK"; em **Ajustes**, ative **Mostrar FPS** para
  ver o desempenho no aparelho. Se ficar lento, use **Qualidade: Baixa**.
