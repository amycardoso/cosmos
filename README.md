# Cosmos

Um site pessoal e privado com o meu ano em leitura, música e séries e filmes, nas cores do Júpiter em ultravioleta fotografado pelo Hubble.

- `site/`: o layout (HTML, CSS e JS sem framework). Abra `site/index.html` no navegador.
- `site/data/sample.js`: dados de exemplo, no formato que o job vai gerar. Nada ali é real.
- `DESIGN.md`: o sistema visual. `PRODUCT.md`: o que o site é e para quem.
- `archive/webb/`: a primeira versão, com as nebulosas do Webb, guardada como referência (sem as imagens).

## Dados e privacidade

O repositório é público; os dados não. O job agendado (a fazer) lê as estatísticas do KOReader via WebDAV, o Spotify e o Bingers, gera os dados e publica direto no Cloudflare Pages, atrás do Cloudflare Access. Tokens ficam nos secrets do GitHub, e o job não commita, não imprime e não sobe artefatos com dados.

Imagem de Júpiter: NASA, ESA, Hubble.
