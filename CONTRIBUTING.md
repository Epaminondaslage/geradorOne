# Como contribuir com o GeradorOne

Obrigado pelo interesse. Este guia explica o fluxo e as regras que valem para qualquer mudança.

## Fluxo

1. Para um erro ou uma ideia, abra uma issue descrevendo o problema ou a proposta. Para mudanças grandes, espere a conversa na issue antes de começar.
2. Faça um fork, crie uma branch a partir da `main` e trabalhe nela.
3. Abra um pull request para a `main`, explicando o que mudou e como você testou. Cite a issue relacionada.

## Regras

- **Commits em português**, no estilo `feat:`, `fix:` ou `docs:` (por exemplo, `fix: corrige o filtro da BNCC por ano`).
- **Testes:** rode `npm test` antes de abrir o PR. Ele sobe um Postgres descartável em Docker, então o Docker precisa estar disponível. Mudança de comportamento vem acompanhada de teste.
- **Sem segredos:** nunca inclua `.env`, chaves de API, senhas ou `APP_SECRET` em commits, issues ou PRs.
- **Idioma:** interface, mensagens de erro, comentários, documentação e nomes de teste em português do Brasil.
- **Interface:** o visual segue [docs/DESIGN.md](docs/DESIGN.md) e os tokens de `public/design.css`; ações de linha usam botões só com ícone, conforme [docs/PADRAO_ICONES.md](docs/PADRAO_ICONES.md). Confira os seis temas e a tela do celular.
- **CSP restrita:** nada de `style=` nem de scripts inline. Os endereços da API são relativos e sem barra inicial (`'api/projects'`).
- **Documentação:** se mudar rotas, fluxos ou a estrutura, atualize o [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md). Se mudar um botão ou fluxo da interface, atualize a FAQ em `public/faq-data.js`.
- **Dados:** não invente códigos da BNCC, fontes, normas ou citações.

## Licença das contribuições

O projeto é licenciado sob a [AGPL-3.0](LICENSE). Ao enviar uma contribuição, você concorda que ela seja distribuída sob a mesma licença.
